"use client";

import { FC, useState } from "react";
import type { AstroCard } from "@/types";
import { StarBackground } from "./StarBackground";

interface TradeConfirmProps {
    card: AstroCard;
    onBack: () => void;
    onExecute: (amount: number) => void;
}

// Derive trade direction from mood/vibe
function deriveDirection(vibeStatus: string): "LONG" | "SHORT" {
    const positiveKeywords = [
        "confident", "optimistic", "energetic", "creative", "happy",
        "excited", "bold", "adventurous", "passionate", "lucky",
    ];
    const vibe = vibeStatus.toLowerCase();
    return positiveKeywords.some((kw) => vibe.includes(kw)) ? "LONG" : "SHORT";
}

// Extract number from lucky number string
function extractNumber(numStr: string): number {
    const match = numStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 42;
}

const QUICK_AMOUNTS = [10, 25, 50, 100];

export const TradeConfirm: FC<TradeConfirmProps> = ({
    card,
    onBack,
    onExecute,
}) => {
    const [amount, setAmount] = useState(10);

    const luckyNumber = extractNumber(card.back.lucky_assets.number);
    const vibeStatus = card.front.vibe_status || "Confident";
    const direction = deriveDirection(vibeStatus);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:py-10">
            <StarBackground />

            {/* Back button */}
            <button
                onClick={onBack}
                className="absolute top-4 left-4 sm:top-10 sm:left-10 flex items-center gap-2 text-white/60 text-xs sm:text-sm hover:text-white transition-colors z-20"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-5 h-5"
                >
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
                            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wider mb-4 ${direction === "LONG"
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
                        <div className="font-display text-4xl sm:text-5xl font-bold mb-2">SOL</div>
                        <div className="text-base sm:text-xl text-white/60">
                            at <span className="text-[#f5c842] font-semibold">{luckyNumber}x</span> leverage
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
                                onChange={(e) => setAmount(Number(e.target.value))}
                                min={10}
                                className="w-full py-5 px-6 pl-11 bg-white/5 border border-white/10 rounded-xl text-2xl font-display font-semibold focus:outline-none focus:border-[#d4a017]/50"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {QUICK_AMOUNTS.map((qa) => (
                                <button
                                    key={qa}
                                    onClick={() => setAmount(qa)}
                                    className={`quick-btn flex-1 min-w-[60px] ${amount === qa ? "active" : ""}`}
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
                            <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="warning-text">
                            <strong>High leverage warning:</strong> {luckyNumber}x leverage means
                            small price movements result in amplified gains or losses.
                        </p>
                    </div>

                    {/* Buttons */}
                    <button
                        onClick={() => onExecute(amount)}
                        className="btn-primary w-full mb-3"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-5 h-5"
                        >
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        Confirm & Execute Trade
                    </button>
                    <button onClick={onBack} className="btn-secondary w-full">
                        Cancel
                    </button>
                </div>
            </div>
        </section>
    );
};
