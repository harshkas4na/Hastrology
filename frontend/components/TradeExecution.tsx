"use client";

import { FC, useEffect, useState, useRef, useCallback } from "react";
import type { AstroCard } from "@/types";
import { StarBackground } from "./StarBackground";

interface TradeExecutionProps {
    card: AstroCard;
    amount: number;
    leverage: number;
    direction: "LONG" | "SHORT";
    onComplete: (result: TradeResult) => void;
    onOpenPosition: () => Promise<{ txSig: string; entryPrice: number }>;
    onClosePosition: () => Promise<{ txSig: string; exitPrice: number; pnl: number }>;
    onGetPrice: () => Promise<number>;
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
    onOpenPosition,
    onClosePosition,
    onGetPrice,
}) => {
    const [timeLeft, setTimeLeft] = useState(TRADE_DURATION);
    const [pnl, setPnl] = useState(0);
    const [pnlPercent, setPnlPercent] = useState(0);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [entryPrice, setEntryPrice] = useState(0);
    const [phase, setPhase] = useState<"opening" | "active" | "closing" | "done">("opening");
    const [statusMessage, setStatusMessage] = useState("Opening position...");
    const hasExecutedRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Execute the full trade lifecycle
    const executeTrade = useCallback(async () => {
        if (hasExecutedRef.current) return;
        hasExecutedRef.current = true;

        try {
            // Phase 1: Open position
            setPhase("opening");
            setStatusMessage("🔮 Opening your position...");

            const openResult = await onOpenPosition();
            setEntryPrice(openResult.entryPrice);
            setCurrentPrice(openResult.entryPrice);

            // Phase 2: Active trade - start timer
            setPhase("active");
            setStatusMessage("🔮 The cosmos are aligning... Stay steady.");

            // Start price polling
            priceIntervalRef.current = setInterval(async () => {
                try {
                    const price = await onGetPrice();
                    setCurrentPrice(price);

                    // Calculate P&L
                    const priceDiff = direction === "LONG"
                        ? price - openResult.entryPrice
                        : openResult.entryPrice - price;
                    const positionSize = (amount * leverage) / openResult.entryPrice;
                    const unrealizedPnl = priceDiff * positionSize;
                    const percentPnl = (unrealizedPnl / amount) * 100;

                    setPnl(unrealizedPnl);
                    setPnlPercent(percentPnl);
                } catch (err) {
                    console.error("Price update failed:", err);
                }
            }, 2000);

            // Start countdown timer
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        // Time's up - close the position
                        if (timerRef.current) clearInterval(timerRef.current);
                        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
                        closePosition(openResult.entryPrice);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (error) {
            console.error("Trade execution error:", error);
            setStatusMessage("❌ Trade failed. Please try again.");
            // Return error result
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
    }, [onOpenPosition, onGetPrice, amount, leverage, direction]);

    const closePosition = async (entry: number) => {
        setPhase("closing");
        setStatusMessage("💫 Closing position...");

        try {
            const closeResult = await onClosePosition();

            setPhase("done");
            setStatusMessage("✨ Trade complete!");

            // Final result
            const finalPnl = closeResult.pnl;
            const finalPercent = (finalPnl / amount) * 100;

            setTimeout(() => {
                onComplete({
                    success: finalPnl > 0,
                    pnl: finalPnl,
                    pnlPercent: finalPercent,
                    entryPrice: entry,
                    exitPrice: closeResult.exitPrice,
                    direction,
                    leverage,
                    txSig: closeResult.txSig,
                });
            }, 1000);
        } catch (error) {
            console.error("Close position error:", error);
            // Still complete with best available data
            onComplete({
                success: pnl > 0,
                pnl,
                pnlPercent,
                entryPrice: entry,
                exitPrice: currentPrice,
                direction,
                leverage,
            });
        }
    };

    // Start trade on mount
    useEffect(() => {
        executeTrade();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
        };
    }, [executeTrade]);

    const progress = ((TRADE_DURATION - timeLeft) / TRADE_DURATION) * 100;
    const timerClass = timeLeft <= 5 ? "critical" : timeLeft <= 10 ? "warning" : "";

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:py-10">
            <StarBackground />

            <div className="relative z-10 w-full max-w-[560px] screen-fade-in">
                {/* Live badge */}
                <div className="flex justify-center mb-6">
                    <div className="badge-live">
                        <span className="live-dot" />
                        <span className="live-text">
                            {phase === "opening" ? "Opening" : phase === "closing" ? "Closing" : "Trade Active"}
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
                                    className={`text-xs font-semibold ${direction === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]"
                                        }`}
                                >
                                    {direction === "LONG" ? "↑" : "↓"} {direction}
                                </span>
                                <p className="text-[11px] text-white/50">{leverage}x Leverage</p>
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
                                className={`pnl-percent ${pnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                                    }`}
                            >
                                {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%
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
                    <div className="text-center p-4 bg-[#d4a017]/10 border border-[#d4a017]/20 rounded-xl">
                        <p className="text-sm text-white/70">{statusMessage}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};
