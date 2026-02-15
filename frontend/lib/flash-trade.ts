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
	CustodyConfig,
	isVariant,
	OraclePrice,
	PerpetualsClient,
	PoolAccount,
	PoolConfig,
	PoolDataClient,
	Privilege,
	Side,
	Token,
	uiDecimalsToNative,
} from "flash-sdk";
import type { AstroCard } from "@/types";

export interface PrivyWalletAdapter {
	publicKey: string;
	signTransaction: (
		transaction: Transaction | VersionedTransaction,
		options?: { uiOptions?: any },
	) => Promise<Transaction | VersionedTransaction>;
	signAllTransactions: (
		transactions: (Transaction | VersionedTransaction)[],
	) => Promise<(Transaction | VersionedTransaction)[]>;
	sendTransaction: (
		transaction: Uint8Array,
		options?: { uiOptions?: any },
	) => Promise<string>;
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
	symbol: string;
}

export interface TradeResult {
	txSig: string;
	direction: "LONG" | "SHORT";
	size: number;
	estimatedPrice: number;
	inputToken: string;
	outputToken: string;
}

const POOL_NAMES = [
	"Crypto.1",
	"Virtual.1",
	"Governance.1",
	"Community.1",
	"Community.2",
	"Trump.1",
	"Ore.1",
	"Remora.1",
];

export const POOL_CONFIGS = POOL_NAMES.map((f) =>
	PoolConfig.fromIdsByName(f, "mainnet-beta"),
);
export const DUPLICATE_TOKENS = POOL_CONFIGS.map((f) => f.tokens).flat();

const tokenMap = new Map();
for (const token of DUPLICATE_TOKENS) {
	// Keep original symbol from SDK - don't normalize here
	tokenMap.set(token.symbol, token);
}

export const ALL_TOKENS: Token[] = Array.from(tokenMap.values());
export const JITOSOL_TOKEN: Token = ALL_TOKENS.find(
	(i) => i.symbol.toUpperCase() == "JITOSOL",
)!;
export const ALL_MARKET_CONFIGS = POOL_CONFIGS.map((f) => f.markets).flat();

export const getTradeExecutionDetails = (
	userInputToken: Token,
	targetToken: Token,
	side: Side,
) => {
	let requiredCollateralMint = null;

	if (targetToken.symbol === "SOL" && isVariant(side, "long")) {
		requiredCollateralMint = JITOSOL_TOKEN.mintKey;
	}

	let marketConfigs = ALL_MARKET_CONFIGS.filter(
		(f) =>
			f.targetMint.equals(targetToken.mintKey) &&
			JSON.stringify(f.side) === JSON.stringify(side),
	)!;

	if (marketConfigs.length === 0) {
		if (
			targetToken.mintKey.toBase58() ===
			"xaut1dB1uihYCwjReVgwZ4mBBJzwkXn4picqqmk4v2H"
		) {
			marketConfigs = ALL_MARKET_CONFIGS.filter(
				(f) =>
					f.targetMint.equals(
						new PublicKey("xaucSYSxjZF4EbsLqAGRvPcuD1uXAj9awmsxYkUAavx"),
					) && JSON.stringify(f.side) === JSON.stringify(side),
			)!;
		} else {
			console.error(
				`FLASH error: No marketConfig FOUND for targetToken ${targetToken.symbol} and side ${side}`,
			);
		}
	}
	// console.log("marketConfigs:",marketConfigs)

	const marketConfig = requiredCollateralMint
		? marketConfigs.find((f) =>
				f.collateralMint.equals(requiredCollateralMint),
			)!
		: marketConfigs[0];

	const positionPoolConfig = POOL_CONFIGS.find((p) =>
		p.poolAddress.equals(marketConfig.pool),
	)!;

	const collateralToken = positionPoolConfig.tokens.find((t) =>
		t.mintKey.equals(marketConfig.collateralMint),
	)!;

	const targetTokenCustodyConfig = positionPoolConfig.custodies.find((c) =>
		c.custodyAccount.equals(marketConfig.targetCustody),
	)!;
	const collateralCustodyConfig = positionPoolConfig.custodies.find(
		(c) => c.symbol === collateralToken.symbol,
	)!;

	const isSwapRequired = !collateralToken.mintKey.equals(
		userInputToken.mintKey,
	);
	let swapPoolConfig: PoolConfig | undefined = undefined;
	let swapInCustodyConfig: CustodyConfig | undefined = undefined;
	let swapOutCustodyConfig: CustodyConfig | undefined = undefined;

	if (isSwapRequired) {
		const inputTokenIsInPool = positionPoolConfig.tokens.some((i) =>
			i.mintKey.equals(userInputToken.mintKey),
		);
		const targetTokenIsInPool = positionPoolConfig.tokens.some((i) =>
			i.mintKey.equals(targetToken.mintKey),
		);

		if (inputTokenIsInPool && targetTokenIsInPool) {
			// same pool swap
			swapPoolConfig = positionPoolConfig;
		} else {
			swapPoolConfig = undefined;
		}
		// swapPoolConfig = positionPoolConfig
		swapInCustodyConfig = positionPoolConfig?.custodies.find((i) =>
			i.mintKey.equals(userInputToken.mintKey),
		);
		swapOutCustodyConfig = positionPoolConfig?.custodies.find((i) =>
			i.mintKey.equals(collateralToken.mintKey),
		);
	}

	return {
		marketConfig,
		collateralToken,
		targetTokenCustodyConfig,
		collateralCustodyConfig,
		positionPoolConfig,
		isSwapRequired,
		swapPoolConfig,
		swapInCustodyConfig,
		swapOutCustodyConfig,
		isTradeDisabled: isSwapRequired && !swapPoolConfig,
	};
};

/** Close flow: whether swap is needed after closing (collateral → receiving token). */
export const getTradeExecutionDetailsClose = (
	userRecievingToken: Token,
	targetMarketToken: Token,
	marketPubKey: PublicKey,
) => {
	const marketConfig = ALL_MARKET_CONFIGS.find((f) =>
		f.marketAccount.equals(marketPubKey),
	)!;
	const positionPoolConfig = POOL_CONFIGS.find((p) =>
		p.poolAddress.equals(marketConfig.pool),
	)!;
	const collateralToken = positionPoolConfig.tokens.find((t) =>
		t.mintKey.equals(marketConfig.collateralMint),
	)!;
	const targetTokenCustodyConfig = positionPoolConfig.custodies.find(
		(c) => c.symbol === targetMarketToken.symbol,
	)!;
	const collateralCustodyConfig = positionPoolConfig.custodies.find(
		(c) => c.symbol === collateralToken.symbol,
	)!;

	const isSwapRequired = !collateralToken.mintKey.equals(
		userRecievingToken.mintKey,
	);
	let swapPoolConfig: PoolConfig | undefined = undefined;
	let swapInCustodyConfig: CustodyConfig | undefined = undefined;
	let swapOutCustodyConfig: CustodyConfig | undefined = undefined;

	if (isSwapRequired) {
		const inputTokenIsInPool = positionPoolConfig.tokens.some((i) =>
			i.mintKey.equals(collateralToken.mintKey),
		);
		const outputTokenIsInPool = positionPoolConfig.tokens.some((i) =>
			i.mintKey.equals(userRecievingToken.mintKey),
		);
		if (inputTokenIsInPool && outputTokenIsInPool) {
			swapPoolConfig = positionPoolConfig;
		}
		swapInCustodyConfig = swapPoolConfig?.custodies.find((i) =>
			i.mintKey.equals(collateralToken.mintKey),
		);
		swapOutCustodyConfig = swapPoolConfig?.custodies.find((i) =>
			i.mintKey.equals(userRecievingToken.mintKey),
		);
	}

	return {
		marketConfig,
		collateralToken,
		targetTokenCustodyConfig,
		collateralCustodyConfig,
		positionPoolConfig,
		isSwapRequired,
		swapPoolConfig,
		swapInCustodyConfig,
		swapOutCustodyConfig,
		isTradeDisabled: isSwapRequired && !swapPoolConfig,
	};
};

export class FlashPrivyService {
	private flashClient: PerpetualsClient | null = null;
	private provider: AnchorProvider | null = null;
	private POOL_CONFIG: PoolConfig | null = null;
	private config: FlashPrivyConfig;
	private hermesClient: HermesClient | null = null;
	private static readonly POSITION_INIT_ERROR_CODE = "3012";

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
			this.provider as any,
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
			symbol: string; // ✅ Add symbol to return type
		}>
	> {
		if (!this.flashClient || !this.POOL_CONFIG) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const walletPubkey = new PublicKey(this.config.wallet.publicKey);

			// Search all pool configs for positions (not just Crypto.1)
			let rawPositions: any[] = [];

			for (const poolCfg of POOL_CONFIGS) {
				try {
					const poolPositions = await this.flashClient.getUserPositions(
						walletPubkey,
						poolCfg,
					);
					if (poolPositions.length > 0) {
						rawPositions = poolPositions;
						break;
					}
				} catch {
					// Pool may not support query; skip
				}
			}

			if (rawPositions.length === 0) {
				return [];
			}

			// Get current prices for ALL coins
			const priceMap = await this.getPrices();

			// Filter and transform positions
			const DEFAULT_KEY = PublicKey.default.toBase58();

			const humanReadablePositions = rawPositions
				.filter((position) => {
					// Filter out stale/empty positions with default market key
					const marketKey = position.market?.toBase58?.() ?? "";
					if (marketKey === "" || marketKey === DEFAULT_KEY) return false;

					// Filter for non-zero positions
					const size = Number(position.sizeAmount.toString());
					return Math.abs(size) > 0.01;
				})
				.map((position, index) => {
					// ✅ Find which token this position is for
					const marketKey = position.market;

					// Find the market config across all pools
					let marketConfig = ALL_MARKET_CONFIGS.find((m) =>
						m.marketAccount.equals(marketKey),
					);

					if (!marketConfig) {
						console.warn(
							`Market config not found for position ${marketKey.toBase58()}`,
						);
						return null;
					}

					// Find the pool that owns this market
					const poolConfig = POOL_CONFIGS.find((p) =>
						p.poolAddress.equals(marketConfig!.pool),
					);

					if (!poolConfig) {
						console.warn("Pool config not found for market");
						return null;
					}

					// ✅ Find the target token (this is the coin being traded)
					const targetToken = poolConfig.tokens.find((t) =>
						t.mintKey.equals(marketConfig!.targetMint),
					);

					if (!targetToken) {
						console.warn("Target token not found in pool");
						return null;
					}

					// ✅ Get current price for THIS specific token
					const tokenPriceData = priceMap.get(targetToken.symbol);
					if (!tokenPriceData) {
						console.warn(`No price data for ${targetToken.symbol}`);
						return null;
					}

					const currentPrice =
						Number(tokenPriceData.price.price.toString()) /
						10 ** Math.abs(tokenPriceData.price.exponent.toNumber());

					// Calculate human-readable values
					const direction: "LONG" | "SHORT" =
						Number(position.sizeAmount.toString()) >= 0 ? "LONG" : "SHORT";

					// ✅ Size in the target token's decimals
					const size =
						Number(position.sizeAmount.toString()) / 10 ** targetToken.decimals;
					const sizeUsd = Number(position.sizeUsd.toString()) / 10 ** 6;

					// Entry price
					const entryPrice =
						Number(position.entryPrice.price.toString()) /
						10 ** Math.abs(position.entryPrice.exponent);

					// ✅ P&L Calculation using the correct token's price
					const priceDifference =
						direction === "LONG"
							? currentPrice - entryPrice
							: entryPrice - currentPrice;

					const pnl = Math.abs(size) * priceDifference;
					const pnlPercent =
						entryPrice > 0 ? (pnl / (Math.abs(size) * entryPrice)) * 100 : 0;

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
						size: Math.abs(size),
						sizeUsd: Math.abs(sizeUsd),
						entryPrice,
						currentPrice,
						pnl,
						pnlPercent,
						collateral,
						unrealizedPnl: pnl,
						openTime: formattedOpenTime,
						market: `${targetToken.symbol}/USD`,
						symbol: targetToken.symbol,
					};
				})
				.filter((p) => p !== null) as Array<{
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
				symbol: string;
			}>;

			return humanReadablePositions;
		} catch (error) {
			console.error("Failed to fetch user positions:", error);
			throw error;
		}
	}

	async getCoinPrice(symbol: string): Promise<number> {
		if (!this.POOL_CONFIG || !this.flashClient) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const priceMap = await this.getPrices();

			const token = this.POOL_CONFIG.tokens.find((t) => t.symbol === symbol);

			if (!token) {
				throw new Error(`${symbol} token not found in pool config`);
			}

			const priceData = priceMap.get(token.symbol);

			if (!priceData) {
				throw new Error(`Price data not available for ${symbol}`);
			}

			const price =
				Number(priceData.price.price.toString()) /
				10 ** Math.abs(priceData.price.exponent.toNumber());

			return price;
		} catch (error) {
			console.error(`Failed to fetch ${symbol} price:`, error);
			throw error;
		}
	}

	// Custom transaction building and sending
	private async buildAndSendTransaction(
		instructions: TransactionInstruction[],
		addressLookupTables: AddressLookupTableAccount[],
		additionalSigners: Signer[] = [],
		uiOptions?: { signDescription?: string; sendDescription?: string },
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
		const signedTransaction = await this.config.wallet.signTransaction(
			transaction,
			uiOptions?.signDescription
				? { uiOptions: { description: uiOptions.signDescription } }
				: undefined,
		);

		if (!(signedTransaction instanceof VersionedTransaction)) {
			throw new Error("Expected VersionedTransaction after signing");
		}

		// Serialize and send
		const serialized = signedTransaction.serialize();
		const signature = await this.config.wallet.sendTransaction(
			serialized,
			uiOptions?.sendDescription
				? { uiOptions: { description: uiOptions.sendDescription } }
				: undefined,
		);

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

	private isPositionNotInitializedError(error: unknown): boolean {
		const message =
			error instanceof Error
				? error.message
				: typeof error === "string"
					? error
					: JSON.stringify(error);

		return (
			message.includes(
				`custom program error: ${FlashPrivyService.POSITION_INIT_ERROR_CODE}`,
			) ||
			message.includes("custom program error: 0xbc4") ||
			message.includes("already initialized") ||
			message.includes("expected this account to be already initialized")
		);
	}

	private async waitForPositionInitialization(
		timeoutMs: number = 15_000,
		pollMs: number = 700,
	): Promise<void> {
		if (!this.flashClient || !this.POOL_CONFIG) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		const walletPubkey = new PublicKey(this.config.wallet.publicKey);
		const startedAt = Date.now();

		while (Date.now() - startedAt < timeoutMs) {
			try {
				const positions = await this.flashClient.getUserPositions(
					walletPubkey,
					this.POOL_CONFIG,
				);
				if (positions.length > 0) {
					return;
				}
			} catch {}

			await new Promise((resolve) => setTimeout(resolve, pollMs));
		}

		throw new Error(
			"Position was not initialized in time. Try again with a longer auto-close delay.",
		);
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
				this.flashClient.provider.connection as any,
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

	async closeTrade(
		positionIndex: number = 0,
		receivingTokenSymbol: string = "USDC",
		uiOptions?: { signDescription?: string; sendDescription?: string },
	): Promise<{ txSig: string }> {
		if (!this.flashClient) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const slippageBps = 800; // 0.8%

			const instructions: TransactionInstruction[] = [];
			let additionalSigners: Signer[] = [];

			// Search ALL pool configs for user positions (not just Crypto.1)
			const walletPubkey = new PublicKey(this.config.wallet.publicKey);
			let positions: any[] = [];
			let positionPoolConfig: PoolConfig | null = null;

			for (const poolCfg of POOL_CONFIGS) {
				try {
					const poolPositions = await this.flashClient.getUserPositions(
						walletPubkey,
						poolCfg,
					);
					if (poolPositions.length > 0) {
						positions = poolPositions;
						positionPoolConfig = poolCfg;
						console.log(
							`Found ${poolPositions.length} position(s) in pool ${poolCfg.poolName}`,
						);
						break;
					}
				} catch (poolErr) {
					// This pool may not support the query; skip
					console.warn(
						`Pool ${poolCfg.poolName} position query failed:`,
						poolErr,
					);
				}
			}

			if (positions.length === 0 || !positionPoolConfig) {
				throw new Error("No positions found to close");
			}

			// Filter out stale/empty positions (market = PublicKey.default or zero size)
			const DEFAULT_KEY = PublicKey.default.toBase58();
			const validPositions = positions.filter((p: any) => {
				const marketKey = p.market?.toBase58?.() ?? "";
				const hasValidMarket = marketKey !== "" && marketKey !== DEFAULT_KEY;
				const hasSize = p.sizeAmount && !p.sizeAmount.isZero?.();
				return hasValidMarket && hasSize;
			});

			console.log(
				`${positions.length} raw position(s), ${validPositions.length} valid after filtering`,
			);

			if (validPositions.length === 0) {
				throw new Error(
					"No valid positions found to close (all positions have empty market or zero size)",
				);
			}

			// Choose the position to close
			const effectiveIndex = Math.min(positionIndex, validPositions.length - 1);
			const positionToClose = validPositions[effectiveIndex];

			console.log(
				`Closing position ${effectiveIndex} with market ${positionToClose.market.toBase58()}`,
			);

			// Find market config across ALL known markets (not just one pool)
			let marketConfig = positionPoolConfig.markets.find((f: any) =>
				f.marketAccount.equals(positionToClose.market),
			);

			// Fallback: search all market configs across all pools
			if (!marketConfig) {
				marketConfig = ALL_MARKET_CONFIGS.find((f) =>
					f.marketAccount.equals(positionToClose.market),
				);

				// Update positionPoolConfig to match the pool that owns this market
				if (marketConfig) {
					const matchingPool = POOL_CONFIGS.find((p) =>
						p.poolAddress.equals(marketConfig!.pool),
					);
					if (matchingPool) {
						positionPoolConfig = matchingPool;
						console.log(`Market found in pool ${positionPoolConfig.poolName}`);
					}
				}
			}

			if (!marketConfig) {
				throw new Error(
					`Market config not found for position market ${positionToClose.market.toBase58()}`,
				);
			}

			// Determine effective receiving token (fallback to SOL if not in pool)
			const effectiveReceivingSymbol = positionPoolConfig.tokens.find(
				(t) => t.symbol === receivingTokenSymbol,
			)
				? receivingTokenSymbol
				: "SOL";

			if (effectiveReceivingSymbol !== receivingTokenSymbol) {
				console.warn(
					`${receivingTokenSymbol} not in pool ${positionPoolConfig.poolName}, falling back to SOL`,
				);
			}

			const side = marketConfig.side!;

			const targetToken = positionPoolConfig.tokens.find((t) =>
				t.mintKey.equals(marketConfig!.targetMint),
			);

			const collateralToken = positionPoolConfig.tokens.find((t) =>
				t.mintKey.equals(marketConfig!.collateralMint),
			);

			const receivingToken = positionPoolConfig.tokens.find(
				(t) => t.symbol === effectiveReceivingSymbol,
			);

			if (!targetToken || !collateralToken || !receivingToken) {
				throw new Error("Target, collateral, or receiving token not found");
			}

			// Use getTradeExecutionDetailsClose to determine if swap is needed
			// (e.g., JitoSOL collateral → SOL receiving requires closeAndSwap)
			const closeDetails = getTradeExecutionDetailsClose(
				receivingToken,
				targetToken,
				positionToClose.market,
			);

			if (closeDetails.isTradeDisabled) {
				throw new Error(
					"Close not supported: swap required but not available for this pair",
				);
			}

			const CLOSE_POOL = closeDetails.positionPoolConfig;
			const SWAP_POOL = closeDetails.swapPoolConfig;
			const closeCollateralToken = closeDetails.collateralToken;

			const priceMap = await this.getPrices();

			const targetTokenPrice = priceMap.get(targetToken.symbol)!.price;

			const priceAfterSlippage = this.flashClient.getPriceAfterSlippage(
				false,
				new BN(slippageBps),
				targetTokenPrice,
				side,
			);

			const privilege = Privilege.None;

			let closeData: {
				instructions: TransactionInstruction[];
				additionalSigners: Signer[];
			};

			if (closeDetails.isSwapRequired && SWAP_POOL) {
				// Collateral differs from receiving token — need closeAndSwap
				console.log(
					`Close requires swap: ${closeCollateralToken.symbol} → ${effectiveReceivingSymbol}`,
				);
				closeData = await this.flashClient.closeAndSwap(
					targetToken.symbol,
					effectiveReceivingSymbol,
					closeCollateralToken.symbol,
					priceAfterSlippage,
					side,
					CLOSE_POOL,
					privilege,
				);
			} else {
				// No swap needed — simple close
				console.log(`Simple close: receiving ${effectiveReceivingSymbol}`);
				closeData = await this.flashClient.closePosition(
					targetToken.symbol,
					effectiveReceivingSymbol,
					priceAfterSlippage,
					side,
					CLOSE_POOL,
					privilege,
				);
			}

			instructions.push(...closeData.instructions);
			additionalSigners.push(...closeData.additionalSigners);

			// Add compute budget
			instructions.unshift(
				ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
			);

			instructions.unshift(
				ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
			);

			// Get address lookup tables from the correct pool
			await this.flashClient.loadAddressLookupTable(CLOSE_POOL);
			const addressLookupTables: AddressLookupTableAccount[] = (
				await this.flashClient.getOrLoadAddressLookupTable(CLOSE_POOL)
			).addressLookupTables;

			// Build and send transaction
			const trxId = await this.buildAndSendTransaction(
				instructions,
				addressLookupTables,
				additionalSigners,
				uiOptions,
			);

			return { txSig: trxId };
		} catch (error: any) {
			console.error("❌ Close trade failed:", error);

			if (error.message?.includes("No positions found")) {
				throw new Error("No open positions found to close");
			}
			if (error.message?.includes("insufficient")) {
				throw new Error("Insufficient balance to close position");
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

	async executeTradeWithAutoClose(
		params: TradeParams,
		autoCloseDelaySeconds: number = 30,
	): Promise<{
		openTxSig: string;
		direction: "LONG" | "SHORT";
		size: number;
		estimatedPrice: number;
		signedCloseTransaction: Uint8Array;
		closeAtTimestamp: number;
		blockhash: string;
		lastValidBlockHeight: number;
		targetCoin: string;
	}> {
		if (!this.POOL_CONFIG || !this.flashClient) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		try {
			const { side: normalSide, inputAmount, leverage, symbol } = params;
			const side = normalSide === "long" ? Side.Long : Side.Short;

			const targetCoinSymbol = symbol;

			const userInputToken = this.POOL_CONFIG.tokens.find(
				(t) => t.symbol === "SOL",
			)!;
			const targetToken = this.POOL_CONFIG.tokens.find(
				(t) => t.symbol === targetCoinSymbol,
			);

			if (!userInputToken || !targetToken) {
				throw new Error("Token not found in pool config");
			}

			const tradeExecutionDetails = getTradeExecutionDetails(
				userInputToken,
				targetToken,
				side,
			);

			if (tradeExecutionDetails.isTradeDisabled) {
				throw new Error(
					"Trade not supported: swap required but not available for this pair",
				);
			}

			const POOL_CONFIG_POSITION = tradeExecutionDetails.positionPoolConfig;
			const POOL_CONFIG_SWAP = tradeExecutionDetails.swapPoolConfig;
			const targetTokenCustodyConfig =
				tradeExecutionDetails.targetTokenCustodyConfig;
			const collateralCustodyConfig =
				tradeExecutionDetails.collateralCustodyConfig;
			const collateralToken = tradeExecutionDetails.collateralToken;

			if (
				POOL_CONFIG_SWAP &&
				POOL_CONFIG_SWAP.poolAddress.toBase58() !==
					POOL_CONFIG_POSITION.poolAddress.toBase58()
			) {
				throw new Error(
					"Multipool swap and open not supported. Swap and position pool must be the same.",
				);
			}

			const slippageBps = 800;
			const slippageBpsBN = new BN(slippageBps);

			const priceMap = await this.getPrices();

			const targetTokenPriceData = priceMap.get(
				targetTokenCustodyConfig.symbol,
			);
			const collateralTokenPriceData = priceMap.get(collateralToken.symbol);

			if (!targetTokenPriceData || !collateralTokenPriceData) {
				throw new Error(
					`Price data not available for ${targetTokenCustodyConfig.symbol} or ${collateralToken.symbol}`,
				);
			}

			const targetTokenPrice = targetTokenPriceData.price;
			const targetTokenPriceEma = targetTokenPriceData.emaPrice;
			const collateralTokenPrice = collateralTokenPriceData.price;
			const collateralTokenPriceEma = collateralTokenPriceData.emaPrice;

			const estimatedPrice =
				Number(targetTokenPrice.price.toString()) /
				10 ** Math.abs(targetTokenPrice.exponent.toNumber());

			const priceAfterSlippage = this.flashClient.getPriceAfterSlippage(
				true,
				slippageBpsBN,
				targetTokenPrice,
				side,
			);

			const inputAmountWithFee = uiDecimalsToNative(
				inputAmount.toString(),
				userInputToken.decimals,
			);

			const discountBps = uiDecimalsToNative("5", 2);

			let sizeAmount: BN;
			let targetTokenFromPool = POOL_CONFIG_POSITION.tokens.find(
				(t) => t.symbol === targetTokenCustodyConfig.symbol,
			)!;

			if (
				tradeExecutionDetails.isSwapRequired &&
				POOL_CONFIG_SWAP &&
				tradeExecutionDetails.swapInCustodyConfig &&
				tradeExecutionDetails.swapOutCustodyConfig
			) {
				// Open position with different collateral (swap then open) — per Flash docs:
				// https://docs.flash.trade/flash-trade/flash-trade-protocol/build-on-flash/trader-interactions#open-position-with-different-collateral
				const swapInCustodyConfig = tradeExecutionDetails.swapInCustodyConfig;
				const swapOutCustodyConfig = tradeExecutionDetails.swapOutCustodyConfig;

				const custodies =
					await this.flashClient.program.account.custody.fetchMultiple([
						swapInCustodyConfig.custodyAccount,
						swapOutCustodyConfig.custodyAccount,
						targetTokenCustodyConfig.custodyAccount,
					]);

				const inputCustodyAccount = CustodyAccount.from(
					swapInCustodyConfig.custodyAccount,
					custodies[0]!,
				);
				const collateralCustodyAccount = CustodyAccount.from(
					swapOutCustodyConfig.custodyAccount,
					custodies[1]!,
				);
				const targetCustodyAccount = CustodyAccount.from(
					targetTokenCustodyConfig.custodyAccount,
					custodies[2]!,
				);

				const poolAccount = PoolAccount.from(
					POOL_CONFIG_POSITION.poolAddress,
					await this.flashClient.program.account.pool.fetch(
						POOL_CONFIG_POSITION.poolAddress,
					),
				);
				const allCustodies =
					await this.flashClient.program.account.custody.all();
				const lpMintData = await getMint(
					this.flashClient.provider.connection as any,
					POOL_CONFIG_POSITION.stakedLpTokenMint,
				);
				const poolDataClient = new PoolDataClient(
					POOL_CONFIG_POSITION,
					poolAccount,
					lpMintData,
					allCustodies.map((c) => CustodyAccount.from(c.publicKey, c.account)),
				);
				const lpStats = poolDataClient.getLpStats(priceMap);

				const userInputTokenPriceData = priceMap.get(userInputToken.symbol);
				if (!userInputTokenPriceData) {
					throw new Error(
						`Price data not available for ${userInputToken.symbol}`,
					);
				}

				sizeAmount = this.flashClient.getSizeAmountWithSwapSync(
					inputAmountWithFee,
					leverage.toString(),
					side,
					poolAccount,
					userInputTokenPriceData.price,
					userInputTokenPriceData.emaPrice,
					inputCustodyAccount,
					collateralTokenPrice,
					collateralTokenPriceEma,
					collateralCustodyAccount,
					collateralTokenPrice,
					collateralTokenPriceEma,
					collateralCustodyAccount,
					targetTokenPrice,
					targetTokenPriceEma,
					targetCustodyAccount,
					lpStats.totalPoolValueUsd,
					POOL_CONFIG_POSITION,
					discountBps,
				);
			} else {
				// Same collateral (no swap) — use getSizeAmountFromLeverageAndCollateral
				const custodies =
					await this.flashClient.program.account.custody.fetchMultiple([
						targetTokenCustodyConfig.custodyAccount,
						collateralCustodyConfig.custodyAccount,
					]);

				const targetCustodyAccount = CustodyAccount.from(
					targetTokenCustodyConfig.custodyAccount,
					custodies[0]!,
				);
				const collateralCustodyAccount = CustodyAccount.from(
					collateralCustodyConfig.custodyAccount,
					custodies[1]!,
				);

				sizeAmount = this.flashClient.getSizeAmountFromLeverageAndCollateral(
					inputAmountWithFee,
					leverage.toString(),
					targetTokenFromPool,
					collateralToken,
					side,
					targetTokenPrice,
					targetTokenPriceEma,
					targetCustodyAccount,
					collateralTokenPrice,
					collateralTokenPriceEma,
					collateralCustodyAccount,
					discountBps,
				);
			}

			const privilege = Privilege.None;
			const refTokenStakeAccountPk = PublicKey.default;
			const userReferralAccountPk = PublicKey.default;

			let openPositionData: {
				instructions: TransactionInstruction[];
				additionalSigners: Signer[];
			};

			if (tradeExecutionDetails.isSwapRequired && POOL_CONFIG_SWAP) {
				openPositionData = await this.flashClient.swapAndOpen(
					targetTokenCustodyConfig.symbol,
					collateralCustodyConfig.symbol,
					userInputToken.symbol,
					inputAmountWithFee,
					priceAfterSlippage,
					sizeAmount,
					side,
					POOL_CONFIG_POSITION,
					privilege,
					refTokenStakeAccountPk,
					userReferralAccountPk,
					true,
					undefined,
				);
			} else {
				openPositionData = await this.flashClient.openPosition(
					targetTokenCustodyConfig.symbol,
					userInputToken.symbol,
					priceAfterSlippage,
					inputAmountWithFee,
					sizeAmount,
					side,
					POOL_CONFIG_POSITION,
					privilege,
					refTokenStakeAccountPk,
					userReferralAccountPk,
					true,
					undefined,
				);
			}

			await this.flashClient.loadAddressLookupTable(POOL_CONFIG_POSITION);
			const addressLookupTablesData =
				await this.flashClient.getOrLoadAddressLookupTable(
					POOL_CONFIG_POSITION,
				);
			const addressLookupTables = addressLookupTablesData.addressLookupTables;

			const { blockhash, lastValidBlockHeight } =
				await this.config.connection.getLatestBlockhash("confirmed");

			const walletPubkey = new PublicKey(this.config.wallet.publicKey);

			const openInstructions: TransactionInstruction[] = [];
			openInstructions.push(
				ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
			);
			openInstructions.push(
				ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
			);
			openInstructions.push(...openPositionData.instructions);

			const openMessageV0 = new TransactionMessage({
				payerKey: walletPubkey,
				recentBlockhash: blockhash,
				instructions: openInstructions,
			}).compileToV0Message(addressLookupTables);

			const openTransaction = new VersionedTransaction(openMessageV0);

			if (openPositionData.additionalSigners.length > 0) {
				openTransaction.sign(openPositionData.additionalSigners);
			}

			const closeInstructions = await this.buildCloseInstructionsOptimistic(
				params,
				"SOL",
				blockhash,
				addressLookupTables,
				POOL_CONFIG_POSITION,
				collateralToken.symbol,
			);

			const closeMessageV0 = new TransactionMessage({
				payerKey: walletPubkey,
				recentBlockhash: blockhash,
				instructions: closeInstructions.instructions,
			}).compileToV0Message(addressLookupTables);

			const closeTransaction = new VersionedTransaction(closeMessageV0);

			if (closeInstructions.additionalSigners.length > 0) {
				closeTransaction.sign(closeInstructions.additionalSigners);
			}

			const signedOpenTransaction = await this.config.wallet.signTransaction(
				openTransaction,
				{
					uiOptions: {
						description: `Opening ${params.side.toUpperCase()} position: ${inputAmount} ${params.symbol} at ${leverage}x leverage`,
						buttonText: "Sign Open Trade Transaction",
						transactionInfo: {
							title: "Open Position",
							description: `This will open a ${params.side.toUpperCase()} position with ${inputAmount} SOL collateral at ${leverage}x leverage`,
						},
					},
				},
			);

			const signedCloseTransaction = await this.config.wallet.signTransaction(
				closeTransaction,
				{
					uiOptions: {
						description: `Pre-signing auto-close transaction (will execute in ${autoCloseDelaySeconds}s)`,
						buttonText: "Sign Auto-Close Transaction",
						transactionInfo: {
							title: "Auto-Close Position",
							description: `This transaction will automatically close your position after ${autoCloseDelaySeconds} seconds`,
						},
					},
				},
			);

			if (
				!(signedOpenTransaction instanceof VersionedTransaction) ||
				!(signedCloseTransaction instanceof VersionedTransaction)
			) {
				throw new Error("Expected VersionedTransaction after signing");
			}

			const serializedOpen = signedOpenTransaction.serialize();

			const openTxSig = await this.config.connection.sendRawTransaction(
				serializedOpen,
				{
					skipPreflight: false,
					preflightCommitment: "confirmed",
					maxRetries: 3,
				},
			);

			const openConfirmation = await this.config.connection.confirmTransaction(
				{
					signature: openTxSig,
					blockhash,
					lastValidBlockHeight,
				},
				"confirmed",
			);

			if (openConfirmation.value.err) {
				throw new Error(
					`Open transaction failed: ${JSON.stringify(openConfirmation.value.err)}`,
				);
			}

			await this.waitForPositionInitialization();

			const serializedCloseTransaction = signedCloseTransaction.serialize();
			const closeAtTimestamp = Date.now() + autoCloseDelaySeconds * 1000;

			return {
				openTxSig,
				direction: side === Side.Long ? "LONG" : "SHORT",
				size:
					Number(sizeAmount.toString()) / 10 ** targetTokenFromPool.decimals,
				estimatedPrice,
				signedCloseTransaction: serializedCloseTransaction,
				closeAtTimestamp,
				blockhash,
				lastValidBlockHeight,
				targetCoin: targetToken.symbol,
			};
		} catch (error) {
			console.error("❌ Trade with auto-close failed:", error);
			throw error;
		}
	}

	private async buildCloseInstructionsOptimistic(
		params: TradeParams,
		receivingTokenSymbol: string = "SOL",
		blockhash: string,
		addressLookupTables?: AddressLookupTableAccount[],
		poolConfig?: PoolConfig,
		/** Position's collateral token symbol (for market lookup). Defaults to receivingTokenSymbol. */
		positionCollateralSymbol?: string,
	): Promise<{
		instructions: TransactionInstruction[];
		additionalSigners: Signer[];
		addressLookupTables: AddressLookupTableAccount[];
	}> {
		const slippageBps = 800;
		const pool = poolConfig ?? this.POOL_CONFIG!;

		const instructions: TransactionInstruction[] = [];
		let additionalSigners: Signer[] = [];

		const targetTokenSymbol = params.symbol;
		const side = params.side === "long" ? Side.Long : Side.Short;

		const targetToken = pool.tokens.find((t) => t.symbol === targetTokenSymbol);
		const receivingToken = pool.tokens.find(
			(t) => t.symbol === receivingTokenSymbol,
		);
		const collateralSymbol = positionCollateralSymbol ?? receivingTokenSymbol;
		const collateralToken = pool.tokens.find(
			(t) => t.symbol === collateralSymbol,
		);

		if (!targetToken || !receivingToken || !collateralToken) {
			throw new Error("Target, receiving or collateral token not found");
		}

		const targetCustodyConfig = pool.custodies.find((c) =>
			c.mintKey.equals(pool.getTokenFromSymbol(targetTokenSymbol).mintKey),
		)!;
		const collateralCustodyConfig = pool.custodies.find((c) =>
			c.mintKey.equals(collateralToken.mintKey),
		)!;

		const marketAccount = pool.getMarketPk(
			targetCustodyConfig.custodyAccount,
			collateralCustodyConfig.custodyAccount,
			side,
		);

		const tradeExecutionDetails = getTradeExecutionDetailsClose(
			receivingToken,
			targetToken,
			marketAccount,
		);

		if (tradeExecutionDetails.isTradeDisabled) {
			throw new Error(
				"Close not supported: swap required but not available for this pair",
			);
		}

		const POOL_CONFIG_POSITION = tradeExecutionDetails.positionPoolConfig;
		const POOL_CONFIG_SWAP = tradeExecutionDetails.swapPoolConfig;
		const collateralTokenFromDetails = tradeExecutionDetails.collateralToken;

		if (
			POOL_CONFIG_SWAP &&
			POOL_CONFIG_SWAP.poolAddress.toBase58() !==
				POOL_CONFIG_POSITION.poolAddress.toBase58()
		) {
			throw new Error(
				"Multipool close and swap not supported. Swap and position pool must be the same.",
			);
		}

		const priceMap = await this.getPrices();
		const marketTokenPriceData = priceMap.get(targetToken.symbol);
		if (!marketTokenPriceData) {
			throw new Error(`Price not available for ${targetToken.symbol}`);
		}
		const marketTokenPrice = marketTokenPriceData.price;

		const slippageBpsBN = new BN(slippageBps);
		const priceAfterSlippage = this.flashClient!.getPriceAfterSlippage(
			false,
			slippageBpsBN,
			marketTokenPrice,
			side,
		);

		const privilege = Privilege.None;
		const refTokenStakeAccountPk = PublicKey.default;
		const userReferralAccountPk = PublicKey.default;

		let closeData: {
			instructions: TransactionInstruction[];
			additionalSigners: Signer[];
		};

		if (tradeExecutionDetails.isSwapRequired && POOL_CONFIG_SWAP) {
			closeData = await this.flashClient!.closeAndSwap(
				targetToken.symbol,
				receivingToken.symbol,
				collateralTokenFromDetails.symbol,
				priceAfterSlippage,
				side,
				POOL_CONFIG_POSITION,
				privilege,
				refTokenStakeAccountPk,
				userReferralAccountPk,
				undefined,
			);
		} else {
			closeData = await this.flashClient!.closePosition(
				targetToken.symbol,
				receivingToken.symbol,
				priceAfterSlippage,
				side,
				POOL_CONFIG_POSITION,
				privilege,
				refTokenStakeAccountPk,
				userReferralAccountPk,
				true,
				false,
				undefined,
			);
		}

		instructions.push(...closeData.instructions);
		additionalSigners.push(...closeData.additionalSigners);

		instructions.unshift(
			ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
		);
		instructions.unshift(
			ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
		);

		let lookupTables: AddressLookupTableAccount[];
		if (addressLookupTables) {
			lookupTables = addressLookupTables;
		} else {
			const lookupTablesData =
				await this.flashClient!.getOrLoadAddressLookupTable(
					POOL_CONFIG_POSITION,
				);
			lookupTables = lookupTablesData.addressLookupTables;
		}

		return {
			instructions,
			additionalSigners,
			addressLookupTables: lookupTables,
		};
	}

	async sendPreSignedCloseTransaction(
		serializedTransaction: Uint8Array,
		blockhash: string,
		lastValidBlockHeight: number,
	): Promise<string> {
		try {
			console.log("⏰ Sending pre-signed close transaction...");
			let signature = "";
			let sendError: unknown = null;

			for (let attempt = 1; attempt <= 3; attempt++) {
				try {
					// skipPreflight on first attempt to avoid blockhash-not-found simulation failures
					// when the blockhash is marginally expired but may still land on-chain
					signature = await this.config.connection.sendRawTransaction(
						serializedTransaction,
						{
							skipPreflight: attempt === 1,
							preflightCommitment: "confirmed",
							maxRetries: 3,
						},
					);
					sendError = null;
					break;
				} catch (error) {
					sendError = error;

					if (attempt < 3 && this.isPositionNotInitializedError(error)) {
						console.warn(
							`⚠️ Close attempt ${attempt} failed with position-not-initialized. Retrying...`,
						);
						await new Promise((resolve) => setTimeout(resolve, 1200));
						continue;
					}

					// On blockhash expiry, don't retry the pre-signed tx — let fallback handle it
					const errMsg = error instanceof Error ? error.message : String(error);
					if (
						errMsg.includes("Blockhash not found") ||
						errMsg.includes("block height exceeded")
					) {
						console.warn(
							"⚠️ Pre-signed close blockhash expired, deferring to manual fallback",
						);
						throw error;
					}

					throw error;
				}
			}

			if (!signature) {
				throw sendError ?? new Error("Failed to send close transaction");
			}

			console.log("✅ Close transaction sent:", signature);

			try {
				console.log("🔍 Checking if position is already closed...");
				const positions = await this.getUserPositions();

				if (positions.length === 0) {
					console.log(
						"✅ Position already closed, no need to wait for confirmation",
					);
					return signature;
				}
			} catch (checkError) {
				console.log(
					"⚠️ Could not check position status, proceeding with confirmation",
				);
			}

			// Wait for confirmation with timeout
			const confirmationPromise = this.config.connection.confirmTransaction(
				{
					signature,
					blockhash,
					lastValidBlockHeight,
				},
				"confirmed",
			);

			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(
					() => reject(new Error("Transaction confirmation timeout")),
					30000, // Reduced from 60000 to 30000
				);
			});

			try {
				const confirmation = (await Promise.race([
					confirmationPromise,
					timeoutPromise,
				])) as any;

				if (confirmation.value?.err) {
					// Check if error is due to blockhash expiration
					if (
						confirmation.value.err.toString().includes("BlockhashNotFound") ||
						confirmation.value.err.toString().includes("block height exceeded")
					) {
						console.log(
							"⚠️ Blockhash expired, checking if position was actually closed...",
						);

						// Verify position status one more time
						const finalPositions = await this.getUserPositions();
						if (finalPositions.length === 0) {
							console.log(
								"✅ Position was closed successfully despite confirmation timeout",
							);
							return signature;
						}
					}

					throw new Error(
						`Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
					);
				}

				return signature;
			} catch (error: any) {
				// Handle timeout or other confirmation errors
				if (
					error.message?.includes("timeout") ||
					error.message?.includes("blockhash") ||
					error.message?.includes("block height")
				) {
					console.log(
						"⚠️ Confirmation timed out, checking if position was actually closed...",
					);

					// Verify if position was actually closed
					const positions = await this.getUserPositions();
					if (positions.length === 0) {
						console.log(
							"✅ Position was closed successfully despite confirmation error",
						);
						return signature;
					}
				}

				// Re-throw if we can't confirm position was closed
				throw error;
			}
		} catch (error: any) {
			console.error("❌ Auto-close failed:", error);

			// More descriptive error messages
			if (this.isPositionNotInitializedError(error)) {
				throw new Error(
					"Position account was not ready when auto-close executed. Retry with a slightly longer auto-close delay.",
				);
			}
			if (error.message?.includes("blockhash not found")) {
				throw new Error(
					"Transaction expired. The 30-second window has passed.",
				);
			}
			if (error.message?.includes("timeout")) {
				throw new Error(
					"Transaction confirmation timed out. Position may still be open.",
				);
			}

			throw error;
		}
	}

	async cleanup() {
		console.log("✅ Flash client cleanup complete");
	}
}
