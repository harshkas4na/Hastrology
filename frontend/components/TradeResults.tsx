"use client";

import { FC } from "react";
import type { AstroCard } from "@/types";
import type { TradeResult } from "./TradeExecution";
import { StarBackground } from "./StarBackground";
import { Confetti } from "./Confetti";

interface TradeResultsProps {
    card: AstroCard;
    result: TradeResult;
    onReturnHome: () => void;
}

// Map color names to CSS gradients
const colorGradients: Record<string, string> = {
    "fire red": "linear-gradient(135deg, #ef4444, #f97316)",
    red: "linear-gradient(135deg, #ef4444, #dc2626)",
    orange: "linear-gradient(135deg, #f97316, #ea580c)",
    yellow: "linear-gradient(135deg, #eab308, #ca8a04)",
    gold: "linear-gradient(135deg, #d4a017, #f5c842)",
    green: "linear-gradient(135deg, #22c55e, #16a34a)",
    blue: "linear-gradient(135deg, #3b82f6, #2563eb)",
    purple: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    pink: "linear-gradient(135deg, #ec4899, #db2777)",
    white: "linear-gradient(135deg, #ffffff, #e5e5e5)",
};

// Get zodiac symbol from sign name
const zodiacSymbols: Record<string, string> = {
    aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋",
    leo: "♌", virgo: "♍", libra: "♎", scorpio: "♏",
    sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓",
};

export const TradeResults: FC<TradeResultsProps> = ({
    card,
    result,
    onReturnHome,
}) => {
    const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const zodiacSign = card.front.zodiac_sign || "Aries";
    const zodiacSymbol = zodiacSymbols[zodiacSign.toLowerCase()] || "♈";
    const luckyNumber = result.leverage;
    const luckyColor = card.back.lucky_assets.color || "Gold";
    const vibeStatus = card.front.vibe_status || "Confident";
    const energyEmoji = card.front.energy_emoji || "✨";
    const reading = `${card.front.hook_1} ${card.front.hook_2}`;

    const colorKey = luckyColor.toLowerCase();
    const colorGradient =
        colorGradients[colorKey] ||
        colorGradients[Object.keys(colorGradients).find((k) => colorKey.includes(k)) || "gold"];

    const handleShareX = () => {
        const text = `My ${zodiacSign} horoscope was verified by a trade on Solana! 🔮\n\n${result.pnl >= 0 ? "Profit" : "Loss"}: ${result.pnl >= 0 ? "+" : ""}$${result.pnl.toFixed(2)} (${result.pnlPercent.toFixed(1)}%)\n\nVerify yours at hashtro.fun`;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-10">
            <StarBackground showSuccessOrb={result.success} />
            {result.success && <Confetti />}

            <div className="relative z-10 w-full max-w-[520px] screen-fade-in">
                {/* Header */}
                <div className="text-center mb-8">
                    <p className="text-sm text-white/50 uppercase tracking-[2px] mb-2">
                        {today}
                    </p>
                    <h1 className="zodiac-title">
                        <span className="zodiac-symbol">{zodiacSymbol}</span>
                        {zodiacSign}
                    </h1>
                </div>

                {/* Card */}
                <div className="card-glass relative overflow-hidden">
                    {/* Top gradient bar */}
                    <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{
                            background:
                                "linear-gradient(90deg, #22c55e, #10b981, #d4a017)",
                        }}
                    />

                    {/* Verified badge */}
                    <div className="flex justify-center mb-6 pt-2">
                        <div className="badge-verified">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                            <span>Verified by Trade</span>
                        </div>
                    </div>

                    {/* Reading */}
                    <div className="text-center mb-6 pb-6 border-b border-white/[0.08]">
                        <p className="reading-text">"{reading}"</p>
                    </div>

                    {/* Lucky Grid */}
                    <div className="lucky-grid mb-6">
                        <div className="lucky-item">
                            <p className="lucky-label">Lucky Number</p>
                            <p className="lucky-value">{luckyNumber}</p>
                        </div>
                        <div className="lucky-item">
                            <p className="lucky-label">Lucky Color</p>
                            <div
                                className="lucky-color-swatch"
                                style={{ background: colorGradient }}
                            />
                            <p className="lucky-color-name">{luckyColor}</p>
                        </div>
                        <div className="lucky-item">
                            <p className="lucky-label">Mood</p>
                            <p className="mood-emoji">{energyEmoji}</p>
                            <p className="mood-text">{vibeStatus}</p>
                        </div>
                    </div>

                    {/* Trade Result */}
                    <div className="trade-result mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] text-white/50 uppercase tracking-[1.5px]">
                                Verification Trade
                            </span>
                            <span
                                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${result.pnl >= 0
                                    ? "bg-[#22c55e]/20 text-[#22c55e]"
                                    : "bg-[#ef4444]/20 text-[#ef4444]"
                                    }`}
                            >
                                {result.pnl >= 0 ? "Profitable" : "Loss"}
                            </span>
                        </div>
                        <div className="flex items-center justify-center gap-4 flex-wrap">
                            <div className="text-center">
                                <p className="font-display text-lg font-semibold">SOL</p>
                                <p className="text-[10px] text-white/40 uppercase mt-1">
                                    Ticker
                                </p>
                            </div>
                            <span className="text-white/20">•</span>
                            <div className="text-center">
                                <p className="font-display text-lg font-semibold">
                                    {result.leverage}x
                                </p>
                                <p className="text-[10px] text-white/40 uppercase mt-1">
                                    Leverage
                                </p>
                            </div>
                            <span className="text-white/20">•</span>
                            <div className="text-center">
                                <p
                                    className={`font-display text-lg font-semibold ${result.direction === "LONG"
                                        ? "text-[#22c55e]"
                                        : "text-[#ef4444]"
                                        }`}
                                >
                                    {result.direction}
                                </p>
                                <p className="text-[10px] text-white/40 uppercase mt-1">
                                    Direction
                                </p>
                            </div>
                            <span className="text-white/20">•</span>
                            <div className="text-center">
                                <p
                                    className={`font-display text-lg font-semibold ${result.pnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                                        }`}
                                >
                                    {result.pnl >= 0 ? "+" : ""}${result.pnl.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-white/40 uppercase mt-1">
                                    Result
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-5 border-t border-white/[0.08]">
                        <span className="font-display text-lg font-bold bg-gradient-to-r from-white to-[#d4a017] bg-clip-text text-transparent">
                            hashtro
                        </span>
                        <span className="text-sm text-white/40">hashtro.fun</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-7">
                    <button onClick={handleShareX} className="btn-share">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Share on X
                    </button>
                    <button className="btn-copy">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-[18px] h-[18px]"
                        >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        Copy Image
                    </button>
                </div>

                <button
                    onClick={onReturnHome}
                    className="w-full mt-5 py-3.5 text-sm text-white/50 hover:text-white transition-colors"
                >
                    Return to Home
                </button>
            </div>
        </section>
    );
};
