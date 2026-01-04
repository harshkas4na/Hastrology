import { AnimatePresence, motion } from "framer-motion";
import * as htmlToImage from "html-to-image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import type { AstroCard as AstroCardType } from "@/types";
import { getPlanetaryTheme } from "./HoroscopeSection";
import { TwitterSignInButton } from "./TwitterButton";

interface AstroCardProps {
	card: AstroCardType;
	showShare: boolean;
}

// Get zodiac emoji mapping
const getZodiacEmoji = (sign: string): string => {
	const zodiacMap: Record<string, string> = {
		aries: "♈",
		taurus: "♉",
		gemini: "♊",
		cancer: "♋",
		leo: "♌",
		virgo: "♍",
		libra: "♎",
		scorpio: "♏",
		sagittarius: "♐",
		capricorn: "♑",
		aquarius: "♒",
		pisces: "♓",
	};
	return zodiacMap[sign.toLowerCase()] || "✨";
};

// Get planetary gradient
const getPlanetaryGradient = (planet: string): string => {
	const gradients: Record<string, string> = {
		sun: "from-amber-500 via-orange-500 to-yellow-600",
		moon: "from-blue-400 via-indigo-500 to-purple-600",
		mars: "from-red-500 via-rose-600 to-orange-600",
		mercury: "from-cyan-400 via-teal-500 to-blue-600",
		jupiter: "from-emerald-400 via-green-500 to-teal-600",
		venus: "from-pink-400 via-rose-500 to-purple-600",
		saturn: "from-purple-500 via-violet-600 to-indigo-700",
		uranus: "from-sky-400 via-blue-500 to-indigo-600",
		neptune: "from-violet-400 via-purple-500 to-fuchsia-600",
	};
	return gradients[planet.toLowerCase()] || gradients.mars;
};

// Get planetary accent color
const getPlanetaryAccent = (planet: string): string => {
	const accents: Record<string, string> = {
		sun: "#F59E0B",
		moon: "#3B82F6",
		mars: "#EF4444",
		mercury: "#06B6D4",
		jupiter: "#22C55E",
		venus: "#EC4899",
		saturn: "#9333EA",
		uranus: "#0EA5E9",
		neptune: "#8B5CF6",
	};
	return accents[planet.toLowerCase()] || accents.mars;
};

// Get vibe color
const getVibeColor = (
	vibe: string,
): { bg: string; text: string; border: string } => {
	const vibeMap: Record<string, { bg: string; text: string; border: string }> =
		{
			stellar: {
				bg: "bg-emerald-500/20",
				text: "text-emerald-300",
				border: "border-emerald-500/30",
			},
			ascending: {
				bg: "bg-blue-500/20",
				text: "text-blue-300",
				border: "border-blue-500/30",
			},
			shaky: {
				bg: "bg-amber-500/20",
				text: "text-amber-300",
				border: "border-amber-500/30",
			},
			eclipse: {
				bg: "bg-purple-500/20",
				text: "text-purple-300",
				border: "border-purple-500/30",
			},
		};
	return vibeMap[vibe.toLowerCase()] || vibeMap.stellar;
};

export const AstroCard: React.FC<AstroCardProps> = ({
	card,
	showShare = true,
}) => {
	const [isFlipped, setIsFlipped] = useState(false);
	const [shareStatus, setShareStatus] = useState<{
		show: boolean;
		message: string;
		type: "success" | "error" | "info";
	}>({ show: false, message: "", type: "info" });
	const [tweetUrl, setTweetUrl] = useState<string | null>(null);
	const [showTweetSuccess, setShowTweetSuccess] = useState(false);
	const { user } = useStore();

	const gradient = getPlanetaryGradient(card.ruling_planet_theme || "mars");
	const accent = getPlanetaryAccent(card.ruling_planet_theme || "mars");
	const vibeColors = getVibeColor(card.front.vibe_status);
	const zodiacEmoji = getZodiacEmoji(card.front.zodiac_sign);
	const router = useRouter();

	const shareOnTwitter = async () => {
		try {
			const cardElement = document.querySelector("[data-card-front]");
			if (!cardElement) {
				setShareStatus({
					show: true,
					message: "Card element not found",
					type: "error",
				});
				return;
			}

			setShareStatus({
				show: true,
				message: "📸 Generating your cosmic card...",
				type: "info",
			});

			// Temporarily remove border radius for the screenshot
			const originalBorderRadius = (cardElement as HTMLElement).style
				.borderRadius;
			(cardElement as HTMLElement).style.borderRadius = "0";

			// Generate high-quality image with increased pixel ratio
			const blob = await htmlToImage.toBlob(cardElement as HTMLElement, {
				quality: 1.0,
				pixelRatio: 3,
				cacheBust: true,
				backgroundColor: "transparent",
			});

			// Restore original border radius
			(cardElement as HTMLElement).style.borderRadius = originalBorderRadius;

			if (!blob) {
				throw new Error("Failed to generate image");
			}

			if (!user?.id) {
				setShareStatus({
					show: true,
					message: "Please log in to share on Twitter",
					type: "error",
				});
				return;
			}

			const formData = new FormData();
			formData.append("image", blob, "hastrology-card.png");
			formData.append(
				"text",
				`My cosmic reading: ${card.front.tagline} 🌟\n\nLuck Score: ${card.front.luck_score}%\nZodiac: ${card.front.zodiac_sign}\n\n#Hastrology`,
			);
			formData.append("walletAddress", user.walletAddress);

			setShareStatus({
				show: true,
				message: "Posting to Twitter...",
				type: "info",
			});

			const response = await fetch("/api/auth/twitter/share", {
				method: "POST",
				body: formData,
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to share on Twitter");
			}

			setShareStatus({
				show: false,
				message: "",
				type: "success",
			});

			if (data.tweetUrl) {
				setTweetUrl(data.tweetUrl);
				setShowTweetSuccess(true);
				setTimeout(() => {
					setShowTweetSuccess(false);
					setTweetUrl(null);
				},15000);
			}
		} catch (error: any) {
			console.error("Failed to share:", error);

			setShareStatus({
				show: true,
				message:
					error.message || "Failed to share on Twitter. Please try again.",
				type: "error",
			});
		}
	};

	const theme = card
		? getPlanetaryTheme(card.ruling_planet_theme || "mars")
		: getPlanetaryTheme("mars");

	const isTwitterExpired =
		!user?.twitterTokenExpiresAt ||
		new Date(user.twitterTokenExpiresAt).getTime() <= Date.now();

	return (
		<div
			className={`w-full h-full grid grid-cols-1 ${showShare ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-30 items-center`}
		>
			{/* LEFT SIDE - Heading & Share Button */}
			{/* LEFT SIDE */}
			{showShare && (
				<motion.div
					initial={{ opacity: 0, x: -50 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.2 }}
					className="flex flex-col justify-center space-y-8 mt-18"
				>
					{!showTweetSuccess ? (
						/* ================= NORMAL SHARE STATE ================= */
						<>
							{/* Heading */}
							<div className="space-y-4">
								<h1 className="text-3xl md:text-4xl font-bold text-white">
									Share Your Card On X
								</h1>
								<p className="text-slate-400 text-lg md:text-xl max-w-lg">
									Get your personalized daily horoscope cards. 10 cards covering
									your vibe, health, wealth, love & more.
								</p>
							</div>

							{/* Share Button */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 1.0 }}
								className="w-full"
							>
								{isTwitterExpired ? (
									<TwitterSignInButton
										onError={(err) =>
											setShareStatus({
												show: true,
												message: err || "Failed to connect X account",
												type: "error",
											})
										}
										userId={user?.id || ""}
									/>
								) : (
									<button
										onClick={shareOnTwitter}
										disabled={shareStatus.show && shareStatus.type === "info"}
										className="group relative w-full px-8 py-4
border border-[#FC5411]
bg-white/5 hover:bg-white/10
rounded-2xl transition-all
hover:scale-105
hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
										type="button"
									>
										<span className="text-white text-lg font-medium tracking-wide group-hover:text-[#FC5411]">
											{shareStatus.show && shareStatus.type === "info"
												? shareStatus.message
												: "Share on X"}
										</span>
									</button>
								)}
							</motion.div>

							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 1.0 }}
								className="w-full mt-2 pb-12"
							>
								<button
									onClick={() => router.push("/lottery")}
									className="text-center w-full border border-[#FC5411] group flex items-center justify-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all hover:scale-105"
									type="button"
								>
									<span className="text-white text-center font-medium tracking-wide group-hover:text-[#FC5411]">
										Check Your Lottery Luck
									</span>
									<span className="text-xl group-hover:translate-x-1 transition-transform">
										→
									</span>
								</button>
							</motion.div>
						</>
					) : (
						/* ================= SUCCESS STATE ================= */
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ type: "spring", stiffness: 120 }}
							className="space-y-8"
						>
							{/* Copy */}
							<div className="space-y-3">
								<h2 className="text-5xl text-white">
									Your cosmic signal is live
								</h2>
								<p className="text-slate-400 text-lg max-w-xl">
									Your horoscope card has been successfully shared on X.
								</p>
							</div>

							{/* CTA */}
							{tweetUrl && (
								<a
									href={tweetUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="w-full bg-[#1F1F1F] border border-[#FC5411] flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white transition-all hover:scale-105"
								>
									View on X
									<svg
										className="w-5 h-5 mt-2"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M14 3h7v7m0-7L10 14"
										/>
									</svg>
								</a>
							)}
						</motion.div>
					)}
				</motion.div>
			)}

			{/* RIGHT SIDE - Card Display */}
			<div
				className={`w-full h-[700px] perspective-1000 relative ${!showShare ? "mx-auto max-w-xl" : ""}`}
			>
				{/* Card Content */}
				<div
					className="w-full max-w-md h-full cursor-pointer"
					onClick={() => !showTweetSuccess && setIsFlipped(!isFlipped)}
				>
					<motion.div
						animate={{ rotateY: isFlipped ? 180 : 0 }}
						className="relative w-full h-full preserve-3d"
						style={{ transformStyle: "preserve-3d" }}
						transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
					>
						<motion.div
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							className="mb-8 text-center"
						>
							<div className="inline-flex items-center gap-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-full px-6 py-3 shadow-lg">
								<span className="text-2xl">{theme.emoji}</span>
								<span className="text-sm font-bold uppercase tracking-wider text-white/80">
									{card.ruling_planet_theme} Energy
								</span>
							</div>
						</motion.div>
						{/* ==================== FRONT FACE ==================== */}
						<motion.div
							data-card-front
							className="absolute w-full h-full backface-hidden rounded-[2.5rem] overflow-hidden shadow-2xl"
							style={{
								backfaceVisibility: "hidden",
								WebkitBackfaceVisibility: "hidden",
								boxShadow: `0 25px 50px -12px ${accent}40`,
							}}
						>
							{/* Background Gradient */}
							<div
								className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`}
							></div>

							{/* Noise Texture Overlay */}
							<div className="absolute inset-0 opacity-30 mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]"></div>

							{/* Decorative Orbs */}
							<div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
							<div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-2xl"></div>

							{/* Content */}
							<div className="relative h-full flex flex-col p-8">
								{/* Header */}
								<div className="flex justify-between items-start mb-auto">
									<div
										className={`${vibeColors.bg} ${vibeColors.text} ${vibeColors.border} backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border`}
									>
										{card.front.vibe_status}
									</div>
									<div className="text-right">
										<div className="text-5xl mb-2 filter drop-shadow-lg">
											{card.front.energy_emoji}
										</div>
										<div className="text-xs text-white/60 font-mono uppercase tracking-widest">
											{card.front.zodiac_sign}
										</div>
									</div>
								</div>

								{/* Center Content */}
								<div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 my-8">
									{/* Giant Zodiac Symbol */}
									<motion.div
										animate={{ scale: 1 }}
										className="text-[120px] leading-none text-white/90 drop-shadow-2xl font-serif"
										initial={{ scale: 0 }}
										transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
									>
										{zodiacEmoji}
									</motion.div>

									{/* Luck Score */}
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="space-y-2"
										initial={{ opacity: 0, y: 20 }}
										transition={{ delay: 0.4 }}
									>
										<div className="text-sm uppercase tracking-[0.3em] text-white/70 font-medium">
											Luck Index
										</div>
										<div className="text-6xl font-black text-white drop-shadow-lg tracking-tight">
											{card.front.luck_score}
											<span className="text-3xl text-white/80">%</span>
										</div>
									</motion.div>

									{/* Tagline */}
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="max-w-sm"
										initial={{ opacity: 0, y: 20 }}
										transition={{ delay: 0.6 }}
									>
										<div className="text-sm uppercase tracking-[0.25em] text-white/60 font-medium mb-3">
											The Message
										</div>
										<h3 className="text-2xl font-serif italic text-white/95 leading-snug drop-shadow-md">
											"{card.front.tagline}"
										</h3>
									</motion.div>
								</div>

								{/* Footer */}
								<motion.div
									animate={{ opacity: 1 }}
									className="bg-black/30 backdrop-blur-xl rounded-2xl p-4 border border-white/10 flex items-center justify-center"
									initial={{ opacity: 0 }}
									transition={{ delay: 0.8 }}
								>
									<div className="flex items-center gap-2 text-white/80">
										<svg
											fill="none"
											height="16"
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											viewBox="0 0 24 24"
											width="16"
										>
											<circle cx="12" cy="12" r="10"></circle>
											<path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"></path>
										</svg>
										<span className="text-sm font-medium">
											Tap to flip for deep insight
										</span>
									</div>
								</motion.div>
							</div>
						</motion.div>

						{/* ==================== BACK FACE ==================== */}
						<motion.div
							className="absolute w-full h-full backface-hidden rounded-[2.5rem] overflow-hidden shadow-2xl"
							style={{
								transform: "rotateY(180deg)",
								backfaceVisibility: "hidden",
								WebkitBackfaceVisibility: "hidden",
								background: "#0D0D15",
								boxShadow: `0 25px 50px -12px ${accent}30`,
							}}
						>
							{/* Ambient Glow */}
							<div
								className="absolute top-[-30%] right-[-30%] w-[80%] h-[80%] rounded-full blur-[100px] opacity-20"
								style={{ background: accent }}
							></div>

							{/* Content */}
							<div className="relative h-full flex flex-col p-8">
								{/* Header */}
								<div className="flex justify-between items-center mb-6">
									<div className="flex items-center gap-2">
										<div
											className="w-3 h-3 rounded-full animate-pulse"
											style={{ background: accent }}
										></div>
										<span className="text-xs font-bold text-white/40 uppercase tracking-widest">
											Cosmic Download
										</span>
									</div>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setIsFlipped(false);
										}}
										className="bg-white/5 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10"
									>
										<svg
											className="text-white/60"
											fill="none"
											height="16"
											stroke="currentColor"
											strokeWidth="2"
											viewBox="0 0 24 24"
											width="16"
										>
											<path d="M19 12H5M12 19l-7-7 7-7" />
										</svg>
									</button>
								</div>

								{/* Scrollable Content */}
								<div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
									{/* Detailed Reading */}
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="space-y-3"
										initial={{ opacity: 0, y: 10 }}
										transition={{ delay: 0.2 }}
									>
										<div className="flex items-center gap-2">
											<svg
												fill="currentColor"
												height="16"
												style={{ color: accent }}
												viewBox="0 0 24 24"
												width="16"
											>
												<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
											</svg>
											<h4 className="text-sm font-bold text-white/90 uppercase tracking-wider">
												Deep Insight
											</h4>
										</div>
										<p className="text-base leading-relaxed text-white/70 font-light">
											{card.back.detailed_reading}
										</p>
									</motion.div>

									{/* Hustle Alpha */}
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="relative"
										initial={{ opacity: 0, y: 10 }}
										transition={{ delay: 0.3 }}
									>
										<div
											className="absolute inset-0 rounded-2xl blur-xl opacity-20"
											style={{
												background: `linear-gradient(135deg, ${accent}, transparent)`,
											}}
										></div>
										<div className="relative p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm space-y-3">
											<div className="flex items-center gap-2">
												<svg
													className="text-emerald-400"
													fill="none"
													height="14"
													stroke="currentColor"
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="2.5"
													viewBox="0 0 24 24"
													width="14"
												>
													<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
												</svg>
												<h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">
													Hustle Alpha
												</h4>
											</div>
											<p className="text-sm text-white/90 font-medium leading-relaxed">
												{card.back.hustle_alpha}
											</p>
										</div>
									</motion.div>

									{/* Shadow Warning */}
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 backdrop-blur-sm space-y-2"
										initial={{ opacity: 0, y: 10 }}
										transition={{ delay: 0.4 }}
									>
										<div className="flex items-center gap-2">
											<svg
												className="text-red-400"
												fill="none"
												height="14"
												stroke="currentColor"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2.5"
												viewBox="0 0 24 24"
												width="14"
											>
												<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
												<line x1="12" x2="12" y1="9" y2="13" />
												<line x1="12" x2="12.01" y1="17" y2="17" />
											</svg>
											<h4 className="text-xs font-black uppercase tracking-widest text-red-400">
												Shadow Warning
											</h4>
										</div>
										<p className="text-xs text-white/70 italic leading-relaxed">
											{card.back.shadow_warning}
										</p>
									</motion.div>

									{/* Lucky Assets */}
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="space-y-3"
										initial={{ opacity: 0, y: 10 }}
										transition={{ delay: 0.5 }}
									>
										<h4 className="text-xs font-black uppercase tracking-widest text-white/40">
											Lucky Assets
										</h4>
										<div className="grid grid-cols-3 gap-3">
											<div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
												<div className="text-[10px] text-white/40 uppercase mb-2 tracking-wider font-medium">
													Number
												</div>
												<div className="text-xl font-black text-white">
													{card.back.lucky_assets.number}
												</div>
											</div>
											<div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
												<div className="text-[10px] text-white/40 uppercase mb-2 tracking-wider font-medium">
													Color
												</div>
												<div className="text-sm font-black text-white">
													{card.back.lucky_assets.color}
												</div>
											</div>
											<div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
												<div className="text-[10px] text-white/40 uppercase mb-2 tracking-wider font-medium">
													Power Hour
												</div>
												<div className="text-xs font-black text-white">
													{card.back.lucky_assets.power_hour}
												</div>
											</div>
										</div>
									</motion.div>
								</div>
							</div>
						</motion.div>
					</motion.div>
				</div>

				{/* Custom Scrollbar Styles */}
				<style jsx>{`
					.custom-scrollbar::-webkit-scrollbar {
						width: 4px;
					}
					.custom-scrollbar::-webkit-scrollbar-track {
						background: rgba(255, 255, 255, 0.05);
						border-radius: 10px;
					}
					.custom-scrollbar::-webkit-scrollbar-thumb {
						background: rgba(255, 255, 255, 0.1);
						border-radius: 10px;
					}
					.custom-scrollbar::-webkit-scrollbar-thumb:hover {
						background: rgba(255, 255, 255, 0.2);
					}
					.perspective-1000 {
						perspective: 1000px;
					}
					.preserve-3d {
						transform-style: preserve-3d;
					}
					.backface-hidden {
						backface-visibility: hidden;
						-webkit-backface-visibility: hidden;
					}
				`}</style>
			</div>
		</div>
	);
};
