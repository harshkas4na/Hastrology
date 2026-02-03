"use client";

import { Connection } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { FlashPrivyService } from "@/lib/flash-trade";
import type { AstroCard } from "@/types";

interface TradeModalProps {
	card: AstroCard;
	onClose: () => void;
	onTradeComplete?: (result: any) => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({ card, onClose }) => {
	const [isTrading, setIsTrading] = useState(false);
	const [isFetchingPrice, setIsFetchingPrice] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<any | null>(null);
	const [tradeAmount, setTradeAmount] = useState(10);
	const leverage = parseInt(card.back.lucky_assets.number, 10) ?? 1;
	const [tradeDetails, setTradeDetails] = useState<{
		direction: "LONG" | "SHORT";
		size: number;
		estimatedPrice: number;
		collateral: string;
		outputToken: string;
		totalValue: string;
	} | null>(null);
	const flashServiceRef = useRef<FlashPrivyService | null>(null);
	const [flashReady, setFlashReady] = useState(false);
	type UserPosition = Awaited<
		ReturnType<FlashPrivyService["getUserPositions"]>
	>[number];

	const [latestPosition, setLatestPosition] = useState<UserPosition | null>(
		null,
	);

	const [isFetchingPosition, setIsFetchingPosition] = useState(false);

	const wallet = usePrivyWallet(false);

	const loadLatestPosition = useCallback(async () => {
		if (!flashServiceRef.current) return;

		try {
			setIsFetchingPosition(true);

			const positions = await flashServiceRef.current.getUserPositions();

			if (positions.length > 0) {
				setLatestPosition(positions[0]);
			} else {
				setLatestPosition(null);
			}
		} catch (err) {
			console.error("Failed to load positions", err);
		} finally {
			setIsFetchingPosition(false);
		}
	}, []);

	useEffect(() => {
		if (!wallet.publicKey || flashServiceRef.current) return;

		const init = async () => {
			const endpoint =
				process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
				"https://solana-rpc.publicnode.com";

			const connection = new Connection(endpoint, "confirmed");

			const service = new FlashPrivyService({
				connection,
				wallet: {
					publicKey: wallet.publicKey,
					signTransaction: wallet.signTransaction,
					signAllTransactions: wallet.signAllTransactions,
					sendTransaction: wallet.sendTransaction,
				},
				env: "mainnet-beta",
			});

			await service.initialize();

			flashServiceRef.current = service;
			setFlashReady(true);

			await loadLatestPosition();
		};

		init();
	}, [
		wallet.publicKey,
		wallet.signTransaction,
		wallet.signAllTransactions,
		wallet.sendTransaction,
		loadLatestPosition,
	]);

	const fetchSolPriceAndCalculateDetails = useCallback(async () => {
		try {
			setIsFetchingPrice(true);
			setError(null);

			let solPrice = 100;

			console.log(flashServiceRef.current);

			if (flashServiceRef.current) {
				solPrice = await flashServiceRef.current.getSolPrice();
				const pos = await flashServiceRef.current.getUserPositions();
				console.log(pos);
			}

			const direction: "LONG" | "SHORT" =
				card.front.luck_score > 50 ? "LONG" : "SHORT";

			const luckDeviation = Math.abs(card.front.luck_score - 50);
			const size = (luckDeviation / 5).toFixed(2);

			setTradeDetails({
				direction,
				size: parseFloat(size),
				estimatedPrice: solPrice,
				collateral: "USDC",
				outputToken: "SOL-USDC",
				totalValue: (parseFloat(size) * solPrice).toFixed(2),
			});
		} catch (err) {
			console.error(err);
			setError("Failed to fetch market data.");
		} finally {
			setIsFetchingPrice(false);
		}
	}, [card.front.luck_score]);

	useEffect(() => {
		console.log(flashReady);
		if (!wallet.publicKey || !flashReady) return;

		fetchSolPriceAndCalculateDetails();

		const interval = setInterval(fetchSolPriceAndCalculateDetails, 20000);
		return () => clearInterval(interval);
	}, [wallet.publicKey, flashReady, fetchSolPriceAndCalculateDetails]);

	const executeTrade = async () => {
		if (!wallet.connected || !flashServiceRef.current) {
			setError("Please connect your wallet first");
			return;
		}

		try {
			setIsTrading(true);
			setError(null);

			const result = await flashServiceRef.current.executeTrade({
				card,
				side: "long",
				inputAmount: tradeAmount,
				leverage,
			});

			setSuccess(result);
			setIsFetchingPosition(true);
			const positions = await flashServiceRef.current.getUserPositions();

			if (positions.length > 0) {
				setLatestPosition(positions[0]);
			}
		} catch (err: any) {
			console.error(err);
			setError(err.message ?? "Trade failed");
		} finally {
			setIsTrading(false);
			setIsFetchingPosition(false);
		}
	};

	return (
		<AnimatePresence>
			<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
				{/* Backdrop */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
					className="absolute inset-0 bg-black/70 backdrop-blur-sm"
				/>

				{/* Modal */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 20 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 20 }}
					className="relative w-full max-w-lg bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
				>
					{/* Header */}
					<div className="p-6 border-b border-white/10">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-xl font-bold text-white">
									Confirm Your Trade
								</h2>
								<p className="text-neutral-400 text-sm mt-1">
									Review the details before verifying your horoscope
								</p>
							</div>
							<button
								onClick={onClose}
								className="text-neutral-400 hover:text-white transition-colors"
							>
								<svg
									className="w-6 h-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
					</div>

					{/* Content */}
					<div className="p-6 space-y-6">
						{/* Card Summary */}

						{!latestPosition && tradeDetails && (
							<div className="space-y-6">
								{/* Hero */}
								<div className="text-center space-y-3">
									<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-bold">
										↑ LONG
									</div>

									<h1 className="text-5xl font-extrabold text-white tracking-tight">
										SOL
									</h1>

									<p className="text-neutral-400">
										at{" "}
										<span className="text-yellow-400 font-bold">
											{card.back.lucky_assets.number}x
										</span>{" "}
										leverage
									</p>
								</div>

								{/* Trade Amount */}
								<div className="space-y-3">
									<label className="text-neutral-400 text-xs uppercase tracking-wider">
										Trade Amount (USD)
									</label>

									<div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
										<span className="text-neutral-400 text-2xl mr-2">$</span>
										<input
											type="number"
											value={tradeAmount}
											onChange={(e) => setTradeAmount(Number(e.target.value))}
											className="bg-transparent w-full text-white text-3xl font-bold outline-none"
										/>
									</div>

									{/* Presets */}
									<div className="grid grid-cols-4 gap-3">
										{[10, 25, 50, 100].map((amt) => (
											<button
												key={amt}
												onClick={() => setTradeAmount(amt)}
												className={`py-2 rounded-xl font-semibold transition ${
													tradeAmount === amt
														? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
														: "bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10"
												}`}
											>
												${amt}
											</button>
										))}
									</div>
								</div>

								{/* Warning */}
								<div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
									<span className="text-red-400 text-lg">⛔</span>
									<p>
										<span className="font-semibold">
											High leverage warning:
										</span>{" "}
										{card.back.lucky_assets.number}x leverage means small price
										movements result in amplified gains or losses.
									</p>
								</div>
							</div>
						)}

						{latestPosition && (
							<PositionDetailsView position={latestPosition} />
						)}

						{isFetchingPrice && !tradeDetails && (
							<div className="flex items-center justify-center py-8">
								<div className="flex flex-col items-center gap-3">
									<div className="w-8 h-8 border-4 border-neutral-700 border-t-blue-500 rounded-full animate-spin" />
									<p className="text-neutral-400 text-sm">
										Fetching market data...
									</p>
								</div>
							</div>
						)}

						{/* Error Display */}
						{error && (
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm"
							>
								❌ {error}
							</motion.div>
						)}

						{/* Success Display */}
						{success && (
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3"
							>
								<p className="text-green-200 text-sm font-medium">
									✅ Position opened successfully!
								</p>
								<a
									href={`https://solscan.io/tx/${success.txSig}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-400 hover:text-blue-300 text-xs underline block"
								>
									View Transaction →
								</a>
							</motion.div>
						)}
					</div>

					{/* Footer with Action Buttons */}
					<div className="px-6 pb-6 pt-3">
						<div className="flex flex-col items-center gap-3">
							<button
								onClick={executeTrade}
								disabled={
									isTrading ||
									!wallet.connected ||
									!tradeDetails ||
									isFetchingPrice
								}
								className="w-full flex-1 px-4 py-3 bg-yellow-500 hover:from-yellow-700 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-black font-bold transition-all flex items-center justify-center gap-2"
								type="button"
							>
								{isTrading ? (
									<>
										<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
												fill="none"
											/>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											/>
										</svg>
										<span>Processing your trade...</span>
									</>
								) : (
									<span>Confirm and execute trade</span>
								)}
							</button>
							<button
								onClick={onClose}
								disabled={isTrading}
								className="w-full flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors disabled:opacity-50"
								type="button"
							>
								Cancel
							</button>
						</div>
						<p className="text-xs text-neutral-500 text-center mt-4">
							Trade executed on Flash.trade
						</p>
					</div>
				</motion.div>
			</div>
		</AnimatePresence>
	);
};

const PositionDetailsView = ({ position }: { position: any }) => {
	const isProfit = position.pnl >= 0;

	return (
		<div className="space-y-6">
			{/* Hero */}
			<div className="text-center space-y-2">
				<div
					className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-bold ${
						position.direction === "LONG"
							? "bg-green-500/10 border-green-500/30 text-green-400"
							: "bg-red-500/10 border-red-500/30 text-red-400"
					}`}
				>
					{position.direction}
				</div>

				<h1 className="text-5xl font-extrabold text-white tracking-tight">
					SOL / USD
				</h1>

				<p className="text-neutral-400 text-sm">Opened {position.openTime}</p>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 gap-4">
				<Stat label="Size" value={`${position.size.toFixed(2)} SOL`} />
				<Stat
					label="Entry Price"
					value={`$${position.entryPrice.toFixed(2)}`}
				/>
				<Stat
					label="Mark Price"
					value={`$${position.currentPrice.toFixed(2)}`}
				/>
				<Stat label="Collateral" value={`$${position.collateral.toFixed(2)}`} />
			</div>

			{/* PnL */}
			<div
				className={`rounded-2xl p-4 border ${
					isProfit
						? "bg-green-500/10 border-green-500/30"
						: "bg-red-500/10 border-red-500/30"
				}`}
			>
				<div className="text-neutral-400 text-sm">Unrealized PnL</div>
				<div
					className={`text-3xl font-extrabold ${
						isProfit ? "text-green-400" : "text-red-400"
					}`}
				>
					${position.pnl.toFixed(2)}
				</div>
				<div className="text-xs text-neutral-400">
					{position.pnlPercent.toFixed(2)}%
				</div>
			</div>
		</div>
	);
};

const Stat = ({ label, value }: { label: string; value: string }) => (
	<div className="bg-white/5 border border-white/10 rounded-xl p-4">
		<div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">
			{label}
		</div>
		<div className="text-white font-bold">{value}</div>
	</div>
);
