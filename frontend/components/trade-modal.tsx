"use client";

import { Connection } from "@solana/web3.js";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { FlashPrivyService } from "@/lib/flash-trade";
import type { AstroCard } from "@/types";
import { StarBackground } from "./StarBackground";
import { TradeResult } from "./TradeExecution";

interface TradeModalProps {
	card: AstroCard;
	onClose: () => void;
	onComplete: (result: TradeResult) => void;
	direction: "LONG" | "SHORT";
}

type SuccessState = {
	type: "close" | "open";
	txSig: string;
	direction: "LONG" | "SHORT";
	leverage: number;
	pnl?: number;
	size?: number;
	entryPrice?: number;
	exitPrice?: number;
	message: string;
	closeAtTimestamp?: number;
	closeTxSig?: string;
};

const TRADE_DURATION = 30; // seconds

const QUICK_AMOUNTS = [0.1, 0.25, 0.5, 1];

export const TradeModal: React.FC<TradeModalProps> = ({
	card,
	onClose,
	direction,
	onComplete,
}) => {
	const [isTrading, setIsTrading] = useState(false);
	const [isFetchingPrice, setIsFetchingPrice] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<SuccessState | null>(null);
	const [amount, setTradeAmount] = useState(0.1);
	const [pnl, setPnl] = useState(0);
	const [pnlPercent, setPnlPercent] = useState(0);
	const [currentPrice, setCurrentPrice] = useState(0);
	const [entryPrice, setEntryPrice] = useState(0);
	const leverage = parseInt(card.back.lucky_assets.number, 10) ?? 1;
	const [statusMessage, setStatusMessage] = useState("Opening position...");
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
	const [countdown, setCountdown] = useState<number | null>(null);
	const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const [phase, setPhase] = useState<"opening" | "active" | "closing" | "done">(
		"opening",
	);
	const [timeLeft, setTimeLeft] = useState(TRADE_DURATION);

	const wallet = usePrivyWallet(false);

	const loadLatestPosition = useCallback(async () => {
		if (!flashServiceRef.current) return;

		try {
			setIsFetchingPosition(true);

			const positions = await flashServiceRef.current.getUserPositions();

			if (positions.length > 0) {
				setEntryPrice(positions[0].entryPrice);
				setPnl(positions[0].unrealizedPnl);
				setPnlPercent(positions[0].pnlPercent);
				setCurrentPrice(positions[0].currentPrice);
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
					publicKey: wallet.publicKey as string,
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

			if (flashServiceRef.current) {
				solPrice = await flashServiceRef.current.getSolPrice();
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

			const result = await flashServiceRef.current.executeTradeWithAutoClose(
				{
					card,
					side: card.front.luck_score > 50 ? "long" : "short",
					inputAmount: amount,
					leverage,
				},
				30,
			);

			setPhase("active");
			setStatusMessage("Trade is live...");
			setTimeLeft(TRADE_DURATION);

			const initialCountdown = Math.ceil(
				(result.closeAtTimestamp - Date.now()) / 1000,
			);
			setCountdown(initialCountdown);

			setSuccess({
				type: "open",
				txSig: result.openTxSig,
				direction: result.direction,
				leverage,
				size: result.size,
				entryPrice: result.estimatedPrice,
				message: "Position opened! Auto-closing in 30s",
				closeAtTimestamp: result.closeAtTimestamp,
			});

			setTimeout(async () => {
				await loadLatestPosition();
			}, 3000);

			countdownIntervalRef.current = setInterval(() => {
				const remaining = Math.max(
					0,
					Math.ceil((result.closeAtTimestamp - Date.now()) / 1000),
				);

				setCountdown(remaining);
				setTimeLeft(remaining);

				if (remaining === 0 && countdownIntervalRef.current) {
					clearInterval(countdownIntervalRef.current);
				}
			}, 100);

			// Schedule auto-close
			const delay = result.closeAtTimestamp - Date.now();
			autoCloseTimeoutRef.current = setTimeout(async () => {
				try {
					setPhase("closing");
					setStatusMessage("Closing position...");

					const closeTxSig =
						await flashServiceRef.current!.sendPreSignedCloseTransaction(
							result.signedCloseTransaction,
							result.blockhash,
							result.lastValidBlockHeight,
						);

					// Get final price for PnL calculation
					const exitPrice = await flashServiceRef.current!.getSolPrice();

					// Calculate final PnL
					const finalPriceDiff =
						direction === "LONG"
							? exitPrice - result.estimatedPrice
							: result.estimatedPrice - exitPrice;
					const finalPnl = finalPriceDiff * result.size;
					const finalPercent = (finalPnl / amount) * 100;

					setStatusMessage("✨ Trade complete!");

					if (countdownIntervalRef.current) {
						clearInterval(countdownIntervalRef.current);
					}

					// Complete with results
					setTimeout(() => {
						onComplete({
							success: finalPnl > 0,
							pnl: finalPnl,
							pnlPercent: finalPercent,
							entryPrice: result.estimatedPrice,
							exitPrice: exitPrice,
							direction,
							leverage,
							txSig: closeTxSig,
						});
					}, 1000);

					// Update success state with close info
					setSuccess((prev) => {
						if (!prev) return null;

						// Calculate PnL
						const priceDiff =
							prev.direction === "LONG"
								? exitPrice - (prev.entryPrice || 0)
								: (prev.entryPrice || 0) - exitPrice;
						const pnl = (prev.size || 0) * priceDiff;

						return {
							...prev,
							type: "close",
							closeTxSig,
							exitPrice,
							pnl,
							message: "Position automatically closed!",
						};
					});

					// Stop countdown
					setCountdown(null);
					if (countdownIntervalRef.current) {
						clearInterval(countdownIntervalRef.current);
					}

					// Reload positions to confirm closure
					await loadLatestPosition();
				} catch (error: any) {
					console.error("❌ Auto-close failed:", error);
					setError(
						error.message ??
							"Auto-close failed. Please close position manually.",
					);
					setCountdown(null);
					if (countdownIntervalRef.current) {
						clearInterval(countdownIntervalRef.current);
					}
				}
			}, delay);
		} catch (err: any) {
			console.error("❌ Trade execution failed:", err);
			setError(err.message ?? "Trade failed");
		} finally {
			setIsTrading(false);
		}
	};

	const closePosition = async () => {
		if (!wallet.connected || !flashServiceRef.current || !latestPosition) {
			setError("Please connect your wallet first");
			return;
		}

		try {
			setIsTrading(true);
			setError(null);

			const result = await flashServiceRef.current.closeTrade(0, "USDC");

			const solPrice = await flashServiceRef.current.getSolPrice();

			// Create success state
			setSuccess({
				type: "close",
				txSig: result.txSig,
				direction: latestPosition.direction,
				leverage: parseInt(card.back.lucky_assets.number, 10) ?? 1,
				pnl: latestPosition.pnl,
				size: latestPosition.size,
				entryPrice: latestPosition.entryPrice,
				exitPrice: solPrice,
				message: "Position closed successfully!",
			});

			setLatestPosition(null);
		} catch (err: any) {
			console.error(err);
			setError(err.message ?? "Failed to close position");
		} finally {
			setIsTrading(false);
		}
	};

	const handleAction = () => {
		if (latestPosition) {
			closePosition();
		} else {
			executeTrade();
		}
	};

	const progress = ((TRADE_DURATION - timeLeft) / TRADE_DURATION) * 100;

	const timerClass =
		timeLeft <= 5 ? "critical" : timeLeft <= 10 ? "warning" : "";

	const luckyNumber = extractNumber(card.back.lucky_assets.number);

	return (
		<>
			{(phase === "active" || phase === "closing") && (
				<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:py-10">
					<StarBackground />

					<div className="relative z-10 w-full max-w-[560px] screen-fade-in">
						<div className="flex justify-center mb-6">
							<div className="badge-live">
								<span className="live-dot" />
								<span className="live-text">
									{phase === "closing" ? "Closing" : "Trade Active"}
								</span>
							</div>
						</div>

						{/* Timer */}
						<div className="text-center mb-8">
							<p className="text-sm text-white/50 mb-2">Time Remaining</p>
							<div className={`timer-display ${timerClass}`}>{timeLeft}</div>
						</div>

						{/* Card */}
						<div className="card-glass w-full" style={{ maxWidth: "560px" }}>
							{/* Trade Header */}
							<div className="flex justify-between items-center pb-5 mb-5 border-b border-white/[0.08]">
								<div className="flex items-center gap-3">
									<span className="font-display text-2xl font-bold">SOL</span>
									<div>
										<span
											className={`text-xs font-semibold ${
												direction === "LONG"
													? "text-[#22c55e]"
													: "text-[#ef4444]"
											}`}
										>
											{direction === "LONG" ? "↑" : "↓"} {direction}
										</span>
										<p className="text-[11px] text-white/50">
											{leverage}x Leverage
										</p>
									</div>
								</div>
								<div className="text-right">
									<p className="text-[10px] text-white/40 uppercase">
										Position
									</p>
									<p className="font-display text-lg font-semibold">
										${amount.toFixed(2)}
									</p>
								</div>
							</div>

							{/* Chart placeholder */}
							<div className="h-[180px] bg-white/[0.02] rounded-2xl flex items-center justify-center mb-6">
								<div className="text-center">
									<p className="text-3xl mb-2">📈</p>
									<p className="text-white/30 text-sm">
										Live trade in progress
									</p>
								</div>
							</div>

							{/* PnL Section */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
								<div className="pnl-card">
									<p className="pnl-label">Unrealized P&L</p>
									<p
										className={`pnl-value ${pnl >= 0 ? "positive" : "negative"}`}
									>
										{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
									</p>
									<p
										className={`pnl-percent ${
											pnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
										}`}
									>
										{pnl >= 0 ? "+" : ""}
										{pnlPercent.toFixed(1)}%
									</p>
								</div>
								<div className="pnl-card">
									<p className="pnl-label">Current Price</p>
									<p className="pnl-value" style={{ color: "#fff" }}>
										${currentPrice.toFixed(2)}
									</p>
									<p className="pnl-percent text-white/50">
										Entry: ${entryPrice.toFixed(2)}
									</p>
								</div>
							</div>

							{/* Progress bar */}
							<div className="mb-5">
								<div className="progress-bar-bg">
									<div
										className="progress-bar-fill"
										style={{ width: `${progress}%` }}
									/>
								</div>
								<div className="flex justify-between text-xs text-white/40 mt-2">
									<span>Started</span>
									<span>{timeLeft}s remaining</span>
								</div>
							</div>

							{/* Status message */}
							<div
								className={`text-center p-4 rounded-xl ${
									error
										? "bg-red-500/10 border border-red-500/20"
										: "bg-[#d4a017]/10 border border-[#d4a017]/20"
								}`}
							>
								<p className="text-sm text-white/70">{statusMessage}</p>
								{error && <p className="text-xs text-red-300 mt-2">{error}</p>}
							</div>
						</div>
					</div>
				</section>
			)}

			{phase === "opening" && (
				<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:py-10">
					<StarBackground />

					{/* Back button */}
					<button
						onClick={onClose}
						className="absolute top-4 left-4 sm:top-10 sm:left-10 flex items-center gap-2 text-white/60 text-xs sm:text-sm hover:text-white transition-colors z-20"
						type="button"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							className="w-5 h-5"
						>
							<title>svg</title>
							<path d="M19 12H5M12 19l-7-7 7-7" />
						</svg>
						Back to Horoscope
					</button>

					<div className="relative z-10 w-full max-w-[520px] screen-fade-in">
						{/* Header */}
						<div className="text-center mb-6 sm:mb-8">
							<h1 className="font-display text-2xl sm:text-3xl font-semibold mb-3 bg-gradient-to-r from-white to-[#d4a017] bg-clip-text text-transparent">
								Confirm Your Trade
							</h1>
							<p className="text-xs sm:text-sm text-white/50">
								Review the details before verifying your horoscope
							</p>
						</div>

						{/* Card */}
						<div className="card-glass">
							{/* Trade Summary */}
							<div className="text-center pb-7 mb-7 border-b border-white/[0.08]">
								{/* Direction badge */}
								<div
									className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wider mb-4 ${
										direction === "LONG"
											? "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30"
											: "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30"
									}`}
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="w-4 h-4"
									>
										<title>svg</title>
										<path
											d={
												direction === "LONG"
													? "M12 19V5M5 12l7-7 7 7"
													: "M12 5v14M5 12l7 7 7-7"
											}
										/>
									</svg>
									{direction}
								</div>

								{/* Ticker */}
								<div className="font-display text-4xl sm:text-5xl font-bold mb-2">
									SOL
								</div>
								<div className="text-base sm:text-xl text-white/60">
									at{" "}
									<span className="text-[#f5c842] font-semibold">
										{luckyNumber}x
									</span>{" "}
									leverage
								</div>
							</div>

							{/* Amount Section */}
							<div className="mb-6">
								<p className="text-xs text-white/50 uppercase tracking-wider mb-3">
									Trade Amount (USD)
								</p>
								<div className="relative">
									<span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl text-white/40 font-display">
										$
									</span>
									<input
										type="number"
										value={amount}
										onChange={(e) => setTradeAmount(Number(e.target.value))}
										min={10}
										className="w-full py-5 px-6 pl-11 bg-white/5 border border-white/10 rounded-xl text-2xl font-display font-semibold focus:outline-none focus:border-[#d4a017]/50"
									/>
								</div>
								<div className="flex flex-wrap gap-2 mt-3">
									{QUICK_AMOUNTS.map((qa) => (
										<button
											key={qa}
											onClick={() => setTradeAmount(qa)}
											className={`quick-btn flex-1 min-w-[60px] ${amount === qa ? "active" : ""}`}
											type="button"
										>
											${qa}
										</button>
									))}
								</div>
							</div>

							{/* Warning Box */}
							<div className="warning-box mb-6">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<title>svg</title>
									<path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<p className="warning-text">
									<strong>High leverage warning:</strong> {luckyNumber}x
									leverage means small price movements result in amplified gains
									or losses.
								</p>
							</div>
							<button
								onClick={handleAction}
								disabled={isTrading}
								className="btn-primary w-full mb-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
								type="button"
							>
								{isTrading ? (
									<>
										<span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
										Preparing transaction...
									</>
								) : (
									<>
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											className="w-5 h-5"
										>
											<title>svg</title>
											<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
										</svg>
										Confirm & Execute Trade
									</>
								)}
							</button>

							<button
								onClick={onClose}
								className="btn-secondary w-full"
								type="button"
							>
								Cancel
							</button>
						</div>
					</div>
				</section>
			)}
		</>
	);
};

// Extract number from lucky number string
function extractNumber(numStr: string): number {
	const match = numStr.match(/\d+/);
	return match ? parseInt(match[0], 10) : 42;
}
