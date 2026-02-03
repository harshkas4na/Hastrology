// lib/flash-privy.ts - Add custom transaction sending

import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { HermesClient } from "@pythnetwork/hermes-client";
import { getMint } from "@solana/spl-token";
import {
	AddressLookupTableAccount,
	ComputeBudgetProgram,
	Connection,
	PublicKey,
	Signer,
	Transaction,
	TransactionInstruction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import {
	BN_ZERO,
	BPS_DECIMALS,
	CustodyAccount,
	OraclePrice,
	PerpetualsClient,
	PoolAccount,
	PoolConfig,
	PoolDataClient,
	Privilege,
	Side,
	uiDecimalsToNative,
} from "flash-sdk";
import type { AstroCard } from "@/types";

export interface PrivyWalletAdapter {
	publicKey: string;
	signTransaction: (
		transaction: Transaction | VersionedTransaction,
	) => Promise<Transaction | VersionedTransaction>;
	signAllTransactions: (
		transactions: (Transaction | VersionedTransaction)[],
	) => Promise<(Transaction | VersionedTransaction)[]>;
	sendTransaction: (transaction: Uint8Array) => Promise<string>;
}

export interface FlashPrivyConfig {
	connection: Connection;
	wallet: PrivyWalletAdapter;
	env: "devnet" | "mainnet-beta";
}

export interface TradeParams {
	card: AstroCard;
	side: "long" | "short";
	inputAmount: number;
	leverage: number;
}

export interface TradeResult {
	txSig: string;
	direction: "LONG" | "SHORT";
	size: number;
	estimatedPrice: number;
	inputToken: string;
	outputToken: string;
}

export class FlashPrivyService {
	private flashClient: PerpetualsClient | null = null;
	private provider: AnchorProvider | null = null;
	private POOL_CONFIG: PoolConfig | null = null;
	private config: FlashPrivyConfig;
	private hermesClient: HermesClient | null = null;

	constructor(config: FlashPrivyConfig) {
		this.config = config;
	}

	async initialize(): Promise<PerpetualsClient> {
		const walletAdapter = {
			publicKey: new PublicKey(this.config.wallet.publicKey),
			signTransaction: async (
				tx: Transaction | VersionedTransaction,
			): Promise<Transaction | VersionedTransaction> => {
				return await this.config.wallet.signTransaction(tx);
			},
			signAllTransactions: async (
				txs: (Transaction | VersionedTransaction)[],
			): Promise<(Transaction | VersionedTransaction)[]> => {
				return await this.config.wallet.signAllTransactions(txs);
			},
		};

		this.provider = new AnchorProvider(
			this.config.connection,
			walletAdapter as Wallet,
			{
				commitment: "confirmed",
				preflightCommitment: "confirmed",
				skipPreflight: false,
			},
		);

		this.POOL_CONFIG = PoolConfig.fromIdsByName(
			"Crypto.1",
			this.config.env === "mainnet-beta" ? "mainnet-beta" : "devnet",
		);

		this.flashClient = new PerpetualsClient(
			this.provider,
			this.POOL_CONFIG.programId,
			this.POOL_CONFIG.perpComposibilityProgramId,
			this.POOL_CONFIG.fbNftRewardProgramId,
			this.POOL_CONFIG.rewardDistributionProgram.programId,
			{
				prioritizationFee: 100000,
			},
		);

		this.hermesClient = new HermesClient("https://hermes.pyth.network", {});

		return this.flashClient;
	}

	async getPrices() {
		if (!this.hermesClient || !this.POOL_CONFIG) {
			throw new Error(
				"Hermes client not initialized. Call initialize() first.",
			);
		}

		const priceMap = new Map<
			string,
			{ price: OraclePrice; emaPrice: OraclePrice }
		>();

		const priceIds = this.POOL_CONFIG.tokens.map((token) =>
			token.pythPriceId.toString(),
		);

		const priceUpdates =
			await this.hermesClient.getLatestPriceUpdates(priceIds);

		if (!priceUpdates || !priceUpdates.parsed) {
			throw new Error("Failed to fetch price updates from Hermes");
		}

		for (const token of this.POOL_CONFIG.tokens) {
			let priceIdStr = token.pythPriceId.toString();
			if (priceIdStr.startsWith("0x")) {
				priceIdStr = priceIdStr.slice(2);
			}

			const priceFeed = priceUpdates.parsed.find(
				(feed) => feed.id === priceIdStr,
			);

			if (!priceFeed) {
				throw new Error(`Price feed not found for ${token.symbol}`);
			}

			const priceData = priceFeed.price;
			const emaPriceData = priceFeed.ema_price;

			const priceOracle = new OraclePrice({
				price: new BN(priceData.price),
				exponent: new BN(priceData.expo),
				confidence: new BN(priceData.conf),
				timestamp: new BN(priceData.publish_time),
			});

			const emaPriceOracle = new OraclePrice({
				price: new BN(emaPriceData.price),
				exponent: new BN(emaPriceData.expo),
				confidence: new BN(emaPriceData.conf),
				timestamp: new BN(priceData.publish_time),
			});

			priceMap.set(token.symbol, {
				price: priceOracle,
				emaPrice: emaPriceOracle,
			});
		}

		return priceMap;
	}

	async getSolPrice(): Promise<number> {
		if (!this.POOL_CONFIG || !this.flashClient) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const priceMap = await this.getPrices();

			const solToken = this.POOL_CONFIG.tokens.find((t) => t.symbol === "SOL");

			if (!solToken) {
				throw new Error("SOL token not found in pool config");
			}

			const solPriceData = priceMap.get(solToken.symbol);

			if (!solPriceData) {
				throw new Error("Price data not available for SOL");
			}

			const solPrice =
				Number(solPriceData.price.price.toString()) /
				10 ** Math.abs(solPriceData.price.exponent.toNumber());

			return solPrice;
		} catch (error) {
			console.error("Failed to fetch SOL price:", error);
			throw error;
		}
	}

	async getUserPositions(): Promise<
		Array<{
			positionId: string;
			direction: "LONG" | "SHORT";
			size: number;
			sizeUsd: number;
			entryPrice: number;
			currentPrice: number;
			pnl: number;
			pnlPercent: number;
			collateral: number;
			unrealizedPnl: number;
			openTime: string;
			market: string;
		}>
	> {
		if (!this.flashClient || !this.POOL_CONFIG) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const walletPubkey = new PublicKey(this.config.wallet.publicKey);

			// Get raw positions from SDK
			const rawPositions = await this.flashClient.getUserPositions(
				walletPubkey,
				this.POOL_CONFIG,
			);

			// Get current prices for P&L calculation
			const priceMap = await this.getPrices();

			// Find SOL token info
			const solToken = this.POOL_CONFIG.tokens.find((t) => t.symbol === "SOL");
			if (!solToken) {
				throw new Error("SOL token not found in pool config");
			}

			const solCustody = this.POOL_CONFIG.custodies.find(
				(c) => c.symbol === "SOL",
			);
			if (!solCustody) {
				throw new Error("SOL custody not found");
			}

			// Get SOL price data
			const solPriceData = priceMap.get("SOL");
			if (!solPriceData) {
				throw new Error("Current SOL price not available");
			}

			const currentSolPrice =
				Number(solPriceData.price.price.toString()) /
				10 ** Math.abs(solPriceData.price.exponent.toNumber());

			// Filter and transform positions
			const humanReadablePositions = rawPositions
				.filter((position) => {
					// Filter for SOL market only
					// We'll assume any position with SOL in its metadata or check the market address
					// Since we can't easily determine the market from position object,
					// we'll filter by size amount (non-zero SOL positions)
					const sizeInSol =
						Number(position.sizeAmount.toString()) / 10 ** solToken.decimals;
					return Math.abs(sizeInSol) > 0.01; // Only positions with significant SOL size
				})
				.map((position, index) => {
					// Calculate human-readable values
					const direction: "LONG" | "SHORT" =
						Number(position.sizeAmount.toString()) >= 0 ? "LONG" : "SHORT";

					// Size in SOL
					const sizeInSol =
						Number(position.sizeAmount.toString()) / 10 ** solToken.decimals;
					const sizeUsd = Number(position.sizeUsd.toString()) / 10 ** 6; // USD with 6 decimals

					// Entry price
					const entryPrice =
						Number(position.entryPrice.price.toString()) /
						10 ** Math.abs(position.entryPrice.exponent);

					// P&L Calculation
					const priceDifference =
						direction === "LONG"
							? currentSolPrice - entryPrice
							: entryPrice - currentSolPrice;

					const pnl = Math.abs(sizeInSol) * priceDifference;
					const pnlPercent =
						entryPrice > 0
							? (pnl / (Math.abs(sizeInSol) * entryPrice)) * 100
							: 0;

					// Collateral in USD
					const collateral =
						Number(position.collateralUsd.toString()) / 10 ** 6;

					// Format open time
					const openTime = new Date(
						Number(position.openTime.toString()) * 1000,
					);
					const formattedOpenTime = openTime.toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					});

					return {
						positionId: `${walletPubkey.toBase58().slice(0, 8)}-${index}`,
						direction,
						size: Math.abs(sizeInSol),
						sizeUsd: Math.abs(sizeUsd),
						entryPrice,
						currentPrice: currentSolPrice,
						pnl,
						pnlPercent,
						collateral,
						unrealizedPnl: pnl,
						openTime: formattedOpenTime,
						market: "SOL/USD",
					};
				});

			return humanReadablePositions;
		} catch (error) {
			console.error("Failed to fetch user positions:", error);
			throw error;
		}
	}

	// Custom transaction building and sending
	private async buildAndSendTransaction(
		instructions: TransactionInstruction[],
		addressLookupTables: AddressLookupTableAccount[],
		additionalSigners: Signer[] = [],
	): Promise<string> {
		if (!this.config.connection) {
			throw new Error("Connection not initialized");
		}

		const walletPubkey = new PublicKey(this.config.wallet.publicKey);

		// Get latest blockhash
		const { blockhash, lastValidBlockHeight } =
			await this.config.connection.getLatestBlockhash("confirmed");

		// Create v0 message
		const messageV0 = new TransactionMessage({
			payerKey: walletPubkey,
			recentBlockhash: blockhash,
			instructions,
		}).compileToV0Message(addressLookupTables);

		// Create versioned transaction
		const transaction = new VersionedTransaction(messageV0);

		// Sign with additional signers if any
		if (additionalSigners.length > 0) {
			transaction.sign(additionalSigners);
		}

		// Sign with wallet
		const signedTransaction =
			await this.config.wallet.signTransaction(transaction);

		if (!(signedTransaction instanceof VersionedTransaction)) {
			throw new Error("Expected VersionedTransaction after signing");
		}

		// Serialize and send
		const serialized = signedTransaction.serialize();
		const signature = await this.config.wallet.sendTransaction(serialized);

		// Wait for confirmation
		const confirmation = await this.config.connection.confirmTransaction(
			{
				signature,
				blockhash,
				lastValidBlockHeight,
			},
			"confirmed",
		);

		if (confirmation.value.err) {
			throw new Error(
				`Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
			);
		}

		return signature;
	}

	async executeTrade(params: TradeParams): Promise<TradeResult> {
		if (!this.POOL_CONFIG || !this.flashClient) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const { side: normalSide, inputAmount, leverage } = params;

			const side = normalSide === "long" ? Side.Long : Side.Short;

			const inputTokenSymbol = "USDC";
			const outputTokenSymbol = "SOL";
			const slippageBps = 800;

			const inputToken = this.POOL_CONFIG.tokens.find(
				(t) => t.symbol === inputTokenSymbol,
			);
			const outputToken = this.POOL_CONFIG.tokens.find(
				(t) => t.symbol === outputTokenSymbol,
			);

			if (!inputToken || !outputToken) {
				throw new Error("Token not found in pool config");
			}

			const priceMap = await this.getPrices();

			const inputTokenPrice = priceMap.get(inputToken.symbol)!.price;
			const inputTokenPriceEma = priceMap.get(inputToken.symbol)!.emaPrice;
			const outputTokenPrice = priceMap.get(outputToken.symbol)!.price;
			const outputTokenPriceEma = priceMap.get(outputToken.symbol)!.emaPrice;

			const estimatedPrice =
				Number(outputTokenPrice.price.toString()) /
				10 ** Math.abs(outputTokenPrice.exponent.toNumber());

			await this.flashClient.loadAddressLookupTable(this.POOL_CONFIG);

			const priceAfterSlippage = this.flashClient.getPriceAfterSlippage(
				true,
				new BN(slippageBps),
				outputTokenPrice,
				side,
			);

			const collateralWithFee = uiDecimalsToNative(
				inputAmount.toString(),
				inputToken.decimals,
			);

			const inputCustody = this.POOL_CONFIG.custodies.find(
				(c) => c.symbol === inputToken.symbol,
			);
			const outputCustody = this.POOL_CONFIG.custodies.find(
				(c) => c.symbol === outputToken.symbol,
			);

			if (!inputCustody || !outputCustody) {
				throw new Error("Custody account not found");
			}

			const custodies =
				await this.flashClient.program.account.custody.fetchMultiple([
					inputCustody.custodyAccount,
					outputCustody.custodyAccount,
				]);

			const poolAccount = PoolAccount.from(
				this.POOL_CONFIG.poolAddress,
				await this.flashClient.program.account.pool.fetch(
					this.POOL_CONFIG.poolAddress,
				),
			);

			const allCustodies = await this.flashClient.program.account.custody.all();

			const lpMintData = await getMint(
				this.flashClient.provider.connection,
				this.POOL_CONFIG.stakedLpTokenMint,
			);

			const poolDataClient = new PoolDataClient(
				this.POOL_CONFIG,
				poolAccount,
				lpMintData,
				[
					...allCustodies.map((c) =>
						CustodyAccount.from(c.publicKey, c.account),
					),
				],
			);

			const lpStats = poolDataClient.getLpStats(await this.getPrices());

			const inputCustodyAccount = CustodyAccount.from(
				inputCustody.custodyAccount,
				custodies[0]!,
			);
			const outputCustodyAccount = CustodyAccount.from(
				outputCustody.custodyAccount,
				custodies[1]!,
			);

			const size = this.flashClient.getSizeAmountWithSwapSync(
				collateralWithFee,
				leverage.toString(),
				side,
				poolAccount,
				inputTokenPrice,
				inputTokenPriceEma,
				inputCustodyAccount,
				outputTokenPrice,
				outputTokenPriceEma,
				outputCustodyAccount,
				outputTokenPrice,
				outputTokenPriceEma,
				outputCustodyAccount,
				outputTokenPrice,
				outputTokenPriceEma,
				outputCustodyAccount,
				lpStats.totalPoolValueUsd,
				this.POOL_CONFIG,
				uiDecimalsToNative("0", 2),
			);

			const minAmountOut = this.flashClient.getSwapAmountAndFeesSync(
				collateralWithFee,
				BN_ZERO,
				poolAccount,
				inputTokenPrice,
				inputTokenPriceEma,
				inputCustodyAccount,
				outputTokenPrice,
				outputTokenPriceEma,
				outputCustodyAccount,
				lpStats.totalPoolValueUsd,
				this.POOL_CONFIG,
			).minAmountOut;

			const openPositionData = await this.flashClient.swapAndOpen(
				outputToken.symbol,
				outputToken.symbol,
				inputToken.symbol,
				collateralWithFee,
				priceAfterSlippage,
				size,
				side,
				this.POOL_CONFIG,
				Privilege.None,
			);

			const instructions: TransactionInstruction[] = [];

			// Add compute budget instructions
			instructions.push(
				ComputeBudgetProgram.setComputeUnitLimit({
					units: 800_000,
				}),
			);

			instructions.push(
				ComputeBudgetProgram.setComputeUnitPrice({
					microLamports: 100000,
				}),
			);

			// Add swap and open instructions
			instructions.push(...openPositionData.instructions);

			// Get address lookup tables
			const addresslookupTables: AddressLookupTableAccount[] = (
				await this.flashClient.getOrLoadAddressLookupTable(this.POOL_CONFIG)
			).addressLookupTables;

			// Build and send transaction using our custom method
			const trxId = await this.buildAndSendTransaction(
				instructions,
				addresslookupTables,
				openPositionData.additionalSigners,
			);

			return {
				txSig: trxId,
				direction: side === Side.Long ? "LONG" : "SHORT",
				size: Number(size.toString()) / 10 ** outputToken.decimals,
				estimatedPrice,
				inputToken: inputTokenSymbol,
				outputToken: outputTokenSymbol,
			};
		} catch (error: any) {
			console.error("❌ Trade failed:", error);

			if (error.message?.includes("insufficient")) {
				throw new Error(
					"Insufficient balance. Please ensure you have enough USDC and SOL for fees.",
				);
			}
			if (error.message?.includes("slippage")) {
				throw new Error("Price moved too much. Please try again.");
			}
			if (error.message?.includes("User rejected")) {
				throw new Error("Transaction was cancelled.");
			}

			throw error;
		}
	}

	async cleanup() {
		console.log("✅ Flash client cleanup complete");
	}
}
