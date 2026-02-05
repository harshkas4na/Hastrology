"use client";

import { Connection } from "@solana/web3.js";
import { FC, useEffect, useState, useRef, useCallback } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { FlashPrivyService } from "@/lib/flash-trade";
import type { AstroCard } from "@/types";
import { StarBackground } from "./StarBackground";

interface TradeExecutionProps {
	card: AstroCard;
	amount: number;
	leverage: number;
	direction: "LONG" | "SHORT";
	onComplete: (result: TradeResult) => void;
}

export interface TradeResult {
	success: boolean;
	pnl: number;
	pnlPercent: number;
	entryPrice: number;
	exitPrice: number;
	direction: "LONG" | "SHORT";
	leverage: number;
	txSig?: string;
}

const TRADE_DURATION = 30; // seconds

export const TradeExecution: FC<TradeExecutionProps> = ({
	card,
	amount,
	leverage,
	direction,
	onComplete,
}) => {
	const [timeLeft, setTimeLeft] = useState(TRADE_DURATION);
	const [pnl, setPnl] = useState(0);
	const [pnlPercent, setPnlPercent] = useState(0);
	const [currentPrice, setCurrentPrice] = useState(0);
	const [entryPrice, setEntryPrice] = useState(0);
	const [phase, setPhase] = useState<"opening" | "active" | "closing" | "done">(
		"opening",
	);
	const [statusMessage, setStatusMessage] = useState("Opening position...");
	const [error, setError] = useState<string | null>(null);

	const hasExecutedRef = useRef(false);
	const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const flashServiceRef = useRef<FlashPrivyService | null>(null);
	const [flashReady, setFlashReady] = useState(false);

	const wallet = usePrivyWallet(false);

	// Initialize Flash service (copied from TradeModal)
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
		};

		init();
	}, [
		wallet.publicKey,
		wallet.signTransaction,
		wallet.signAllTransactions,
		wallet.sendTransaction,
	]);

	// Execute the full trade lifecycle with auto-close (copied from TradeModal)
	const executeTrade = useCallback(async () => {
		if (hasExecutedRef.current || !flashServiceRef.current) return;
		hasExecutedRef.current = true;

		try {
			// Phase 1: Open position with auto-close scheduled
			setPhase("opening");
			setStatusMessage("🔮 Opening your position...");

			console.log("📝 Preparing trade with auto-close...");

			const result = await flashServiceRef.current.executeTradeWithAutoClose(
				{
					card,
					side: direction.toLowerCase() as "long" | "short",
					inputAmount: amount,
					leverage,
				},
				30, // 30 seconds
			);

			setEntryPrice(result.estimatedPrice);
			setCurrentPrice(result.estimatedPrice);

			// Phase 2: Active trade - start countdown
			setPhase("active");
			setStatusMessage("🔮 The cosmos are aligning... Stay steady.");

			// Calculate initial countdown
			const initialCountdown = Math.ceil(
				(result.closeAtTimestamp - Date.now()) / 1000,
			);
			setTimeLeft(initialCountdown);

			// Start price polling
			priceIntervalRef.current = setInterval(async () => {
				try {
					const price = await flashServiceRef.current!.getSolPrice();
					setCurrentPrice(price);

					// Calculate P&L
					const priceDiff =
						direction === "LONG"
							? price - result.estimatedPrice
							: result.estimatedPrice - price;

					const positionSize = result.size;
					const unrealizedPnl = priceDiff * positionSize;
					const percentPnl = (unrealizedPnl / amount) * 100;

					setPnl(unrealizedPnl);
					setPnlPercent(percentPnl);
				} catch (err) {
					console.error("Price update failed:", err);
				}
			}, 2000);

			// Start countdown interval
			countdownIntervalRef.current = setInterval(() => {
				const remaining = Math.ceil(
					(result.closeAtTimestamp - Date.now()) / 1000,
				);
				if (remaining <= 0) {
					setTimeLeft(0);
					if (countdownIntervalRef.current) {
						clearInterval(countdownIntervalRef.current);
					}
				} else {
					setTimeLeft(remaining);
				}
			}, 100); // Update every 100ms for smooth countdown

			// Schedule auto-close
			const delay = result.closeAtTimestamp - Date.now();
			autoCloseTimeoutRef.current = setTimeout(async () => {
				try {
					console.log("⏰ Auto-closing position now...");

					// Stop price updates
					if (priceIntervalRef.current) {
						clearInterval(priceIntervalRef.current);
					}

					setPhase("closing");
					setStatusMessage("💫 Position closing automatically...");

					const closeTxSig =
						await flashServiceRef.current!.sendPreSignedCloseTransaction(
							result.signedCloseTransaction,
							result.blockhash,
							result.lastValidBlockHeight,
						);

					console.log("✅ Position closed:", closeTxSig);

					// Get final price for PnL calculation
					const exitPrice = await flashServiceRef.current!.getSolPrice();

					// Calculate final PnL
					const finalPriceDiff =
						direction === "LONG"
							? exitPrice - result.estimatedPrice
							: result.estimatedPrice - exitPrice;
					const finalPnl = finalPriceDiff * result.size;
					const finalPercent = (finalPnl / amount) * 100;

					setPhase("done");
					setStatusMessage("✨ Trade complete!");

					// Stop countdown
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
				} catch (error: any) {
					console.error("❌ Auto-close failed:", error);
					setError(error.message ?? "Auto-close failed");
					setStatusMessage("❌ Auto-close failed. Please try again.");

					// Still complete with best available data
					setTimeout(() => {
						onComplete({
							success: pnl > 0,
							pnl,
							pnlPercent,
							entryPrice: result.estimatedPrice,
							exitPrice: currentPrice,
							direction,
							leverage,
							txSig: result.openTxSig,
						});
					}, 2000);
				}
			}, delay);
		} catch (error: any) {
			console.error("Trade execution error:", error);
			setError(error.message ?? "Trade failed");
			setStatusMessage("❌ Trade failed. Please try again.");

			setTimeout(() => {
				onComplete({
					success: false,
					pnl: 0,
					pnlPercent: 0,
					entryPrice: 0,
					exitPrice: 0,
					direction,
					leverage,
				});
			}, 2000);
		}
	}, [
		card,
		amount,
		leverage,
		direction,
		onComplete,
		pnl,
		pnlPercent,
		currentPrice,
	]);

	// Start trade on mount when flash service is ready
	useEffect(() => {
		if (!flashReady) return;

		executeTrade();

		return () => {
			if (countdownIntervalRef.current)
				clearInterval(countdownIntervalRef.current);
			if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
			if (autoCloseTimeoutRef.current)
				clearTimeout(autoCloseTimeoutRef.current);
		};
	}, [flashReady, executeTrade]);

	const progress = ((TRADE_DURATION - timeLeft) / TRADE_DURATION) * 100;
	const timerClass =
		timeLeft <= 5 ? "critical" : timeLeft <= 10 ? "warning" : "";

	// Loading state while initializing
	if (!flashReady) {
		return (
			<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:py-10">
				<StarBackground />
				<div className="relative z-10 text-center">
					<div className="w-8 h-8 border-4 border-neutral-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
					<p className="text-white/50">Initializing trade...</p>
				</div>
			</section>
		);
	}

	return (
		<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:py-10">
			<StarBackground />

			<div className="relative z-10 w-full max-w-[560px] screen-fade-in">
				{/* Live badge */}
				<div className="flex justify-center mb-6">
					<div className="badge-live">
						<span className="live-dot" />
						<span className="live-text">
							{phase === "opening"
								? "Opening"
								: phase === "closing"
									? "Closing"
									: "Trade Active"}
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
										direction === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]"
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
							<p className="text-[10px] text-white/40 uppercase">Position</p>
							<p className="font-display text-lg font-semibold">
								${amount.toFixed(2)}
							</p>
						</div>
					</div>

					{/* Chart placeholder */}
					<div className="h-[180px] bg-white/[0.02] rounded-2xl flex items-center justify-center mb-6">
						<div className="text-center">
							<p className="text-3xl mb-2">📈</p>
							<p className="text-white/30 text-sm">Live trade in progress</p>
						</div>
					</div>

					{/* PnL Section */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
						<div className="pnl-card">
							<p className="pnl-label">Unrealized P&L</p>
							<p className={`pnl-value ${pnl >= 0 ? "positive" : "negative"}`}>
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
	);
};
