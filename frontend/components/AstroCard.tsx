import { AnimatePresence, motion } from "framer-motion";
import * as htmlToImage from "html-to-image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import type { AstroCard as AstroCardType } from "@/types";
import { getPlanetaryTheme } from "./HoroscopeSection";
import { TwitterSignInButton } from "./TwitterButton";
import { TradeModal } from "./trade-modal";

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

	// Draft state
	const [isDrafting, setIsDrafting] = useState(false);
	const [draftBlob, setDraftBlob] = useState<Blob | null>(null);
	const [draftText, setDraftText] = useState("");
	const [isPosting, setIsPosting] = useState(false);
	const [openModal, setOpenModal] = useState(false);

	const gradient = getPlanetaryGradient(card.ruling_planet_theme || "mars");
	const accent = getPlanetaryAccent(card.ruling_planet_theme || "mars");
	const vibeColors = getVibeColor(card.front.vibe_status);
	const zodiacEmoji = getZodiacEmoji(card.front.zodiac_sign);
	const router = useRouter();

	// Step 1: Generate the image and open the draft modal
	const handleGenerateDraft = async () => {
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
				pixelRatio: 3,
				quality: 1,
				cacheBust: true,
				filter: (node) => {
					// Filter out problematic nodes or styles
					if (node instanceof HTMLElement) {
						const computedStyle = window.getComputedStyle(node);
						// Skip nodes with undefined fonts
						if (!computedStyle.font || computedStyle.font === "") {
							return true;
						}
					}
					return true;
				},
				skipFonts: true,
			});

			// Restore original border radius
			(cardElement as HTMLElement).style.borderRadius = originalBorderRadius;

			if (!blob) {
				throw new Error("Failed to generate image");
			}

			// check auth early
			if (!user?.id) {
				setShareStatus({
					show: true,
					message: "Please log in to share on Twitter",
					type: "error",
				});
				return;
			}

			// Pre-fill text
			const defaultText = `My cosmic reading: ${card.front.tagline} 🌟\n\nLuck Score: ${card.front.luck_score}%\nZodiac: ${card.front.zodiac_sign}\n\n#Hashtro`;

			setDraftBlob(blob);
			setDraftText(defaultText);
			setIsDrafting(true);
			setShareStatus({
				show: false,
				message: "",
				type: "info",
			});
		} catch (error: any) {
			console.error("Failed to generate draft:", error);
			setShareStatus({
				show: true,
				message: "Failed to generate card image.",
				type: "error",
			});
		}
	};

	// Step 2: Actually post to Twitter
	const handlePostToTwitter = async () => {
		if (!draftBlob || !user?.walletAddress) return;

		try {
			setIsPosting(true);
			setShareStatus({
				show: true,
				message: "Posting to Twitter...",
				type: "info",
			});

			const formData = new FormData();
			formData.append("image", draftBlob, "hastrology-card.png");
			formData.append("text", draftText);
			formData.append("walletAddress", user.walletAddress);

			const response = await fetch("/api/auth/twitter/share", {
				method: "POST",
				body: formData,
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to share on Twitter");
			}

			// Success!
			setIsDrafting(false); // Close modal
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
				}, 15000);
			}
		} catch (error: any) {
			console.error("Failed to share:", error);
			setShareStatus({
				show: true,
				message:
					error.message || "Failed to share on Twitter. Please try again.",
				type: "error",
			});
		} finally {
			setIsPosting(false);
		}
	};

	const downloadFrontAndBackCard = async () => {
		try {
			setShareStatus({
				show: true,
				message: "📸 Generating card images...",
				type: "info",
			});

			const front = document.querySelector(
				"[data-card-front]",
			) as HTMLElement | null;
			const back = document.querySelector(
				"[data-card-back]",
			) as HTMLElement | null;

			if (!front || !back) {
				setShareStatus({
					show: true,
					message: "Card elements not found",
					type: "error",
				});
				return;
			}

			const frontOriginalBorderRadius = front.style.borderRadius;
			const backOriginalBorderRadius = back.style.borderRadius;
			const backOriginalTransform = back.style.transform;

			front.style.borderRadius = "0";
			back.style.borderRadius = "0";

			const frontBlob = await htmlToImage.toBlob(front, {
				pixelRatio: 3,
				cacheBust: true,
				quality: 1,
				filter: (node) => {
					// Filter out problematic nodes or styles
					if (node instanceof HTMLElement) {
						const computedStyle = window.getComputedStyle(node);
						// Skip nodes with undefined fonts
						if (!computedStyle.font || computedStyle.font === "") {
							return true;
						}
					}
					return true;
				},
				skipFonts: true,
			});

			if (!frontBlob) {
				front.style.borderRadius = frontOriginalBorderRadius;
				back.style.borderRadius = backOriginalBorderRadius;
				throw new Error("Failed to capture front");
			}

			// Flip to back
			const wasFlipped = isFlipped;
			setIsFlipped(true);

			await new Promise((resolve) => setTimeout(resolve, 1000));
			back.style.transform = "rotateY(0deg)";

			await new Promise((resolve) => setTimeout(resolve, 100));
			const backBlob = await htmlToImage.toBlob(back, {
				pixelRatio: 3,
				cacheBust: true,
				quality: 1,
				filter: (node) => {
					// Filter out problematic nodes or styles
					if (node instanceof HTMLElement) {
						const computedStyle = window.getComputedStyle(node);
						// Skip nodes with undefined fonts
						if (!computedStyle.font || computedStyle.font === "") {
							return true;
						}
					}
					return true;
				},
				skipFonts: true,
			});

			front.style.borderRadius = frontOriginalBorderRadius;
			back.style.borderRadius = backOriginalBorderRadius;
			back.style.transform = backOriginalTransform;

			setIsFlipped(wasFlipped);

			if (!backBlob) throw new Error("Failed to capture back");
			const frontUrl = URL.createObjectURL(frontBlob);
			const backUrl = URL.createObjectURL(backBlob);

			const frontImg = new Image();
			const backImg = new Image();

			await Promise.all([
				new Promise((resolve, reject) => {
					frontImg.onload = resolve;
					frontImg.onerror = reject;
					frontImg.src = frontUrl;
				}),
				new Promise((resolve, reject) => {
					backImg.onload = resolve;
					backImg.onerror = reject;
					backImg.src = backUrl;
				}),
			]);

			// Create canvas
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Could not get canvas context");

			const gap = 72; // 24px * 3 (pixelRatio)
			const padding = 72; // 24px * 3 (pixelRatio)

			canvas.width = frontImg.width + backImg.width + gap + padding * 2;
			canvas.height = Math.max(frontImg.height, backImg.height) + padding * 2;

			ctx.fillRect(0, 0, canvas.width, canvas.height);

			ctx.drawImage(frontImg, padding, padding);

			ctx.drawImage(backImg, frontImg.width + gap + padding, padding);

			URL.revokeObjectURL(frontUrl);
			URL.revokeObjectURL(backUrl);
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						setShareStatus({
							show: true,
							message: "Failed to generate image",
							type: "error",
						});
						return;
					}

					const link = document.createElement("a");
					link.download = "hastrology-card-front-back.png";
					link.href = URL.createObjectURL(blob);
					link.click();
					setTimeout(() => URL.revokeObjectURL(link.href), 100);

					setShareStatus({
						show: false,
						message: "",
						type: "success",
					});
				},
				"image/png",
				1,
			);
		} catch (err) {
			console.error("Download failed:", err);
			setShareStatus({
				show: true,
				message: "Failed to download card. Please try again.",
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
			className={`mt-0 md:mt-10 w-full h-full flex flex-col ${showShare ? "lg:grid lg:grid-cols-2" : ""} gap-6 lg:gap-16 items-center`}
		>
			{/* LEFT SIDE - Heading & Share Button */}
			{showShare && (
				<motion.div
					initial={{ opacity: 0, x: -50 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.2 }}
					className="mt-5 flex flex-col justify-center space-y-3 md:space-y-6 lg:space-y-8 md:mt-8 lg:mt-16 order-2 lg:order-1"
				>
					{!showTweetSuccess ? (
						/* ================= NORMAL SHARE STATE ================= */
						<>
							{/* Heading */}
							<div
								className="text-center md:text-left space-y-3 lg:space-y-4 text-sm md:text-lg
                invisible md:visible h-0 md:h-auto"
							>
								<h1 className="text-lg md:text-2xl lg:text-4xl font-bold text-white">
									Share Your Card On X
								</h1>
								<p className="text-slate-400 text-base lg:text-lg md:text-xl max-w-lg">
									Get your personalized daily horoscope cards. A card for your
									vibe, health, wealth, love & more.
								</p>
							</div>

							{/* Share Button */}
							<motion.div className="w-full flex flex-col gap-4 md:gap-6 pb-8">
								{/* Share / Sign-in */}
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
										onClick={handleGenerateDraft}
										disabled={shareStatus.show && shareStatus.type === "info"}
										className="cursor-pointer group relative w-full px-8 py-4 border border-[#FC5411]
      bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
									>
										<span className="text-white text-sm md:text-lg font-medium">
											{shareStatus.show && shareStatus.type === "info"
												? shareStatus.message
												: "Share on X"}
										</span>
									</button>
								)}

								{/* Download */}
								<button
									onClick={downloadFrontAndBackCard}
									className="cursor-pointer text-sm md:text-lg group relative w-full px-8 py-4 border border-[#FC5411]
    hover:bg-white/10 rounded-2xl transition-all"
								>
									Download Card
								</button>

								{/* Lottery */}
								<button
									onClick={() => router.push("/lottery")}
									className="cursor-pointer text-sm md:text-lg w-full border border-[#FC5411]
    flex items-center justify-center gap-3 px-8 py-4
     hover:bg-white/10 rounded-2xl transition-all"
								>
									Check Your Lottery Luck →
								</button>

								<button
									onClick={() => setOpenModal(true)}
									className="cursor-pointer text-sm md:text-lg w-full border border-[#FC5411]
    flex items-center justify-center gap-3 px-8 py-4
     hover:bg-white/10 rounded-2xl transition-all"
								>
									Trade based on luck
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
							<div className="text-center space-y-3">
								<h2 className="text-xl md:text-5xl text-white">
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
										className="w-4 h-4 mt-2"
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
				className={`w-full relative order-1 lg:order-2 ${!showShare ? "mx-auto max-w-xl" : ""}`}
			>
				<div className="w-full h-[765px] md:min-h-[650px] lg:h-[765px] perspective-1000 relative">
					{/* Card Content */}
					<div
						className="w-full max-w-sm md:max-w-md h-full cursor-pointer mx-auto lg:mx-0"
						onClick={() => !showTweetSuccess && setIsFlipped(!isFlipped)}
					>
						<motion.div
							animate={{ rotateY: isFlipped ? 180 : 0 }}
							className="relative w-full h-full preserve-3d"
							style={{ transformStyle: "preserve-3d" }}
							transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
						>
							{/* ==================== FRONT FACE ==================== */}
							<motion.div
								data-card-front
								className={`absolute w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl ${isFlipped ? "pointer-events-none" : "pointer-events-auto"}`}
								style={{
									backfaceVisibility: "hidden",
									WebkitBackfaceVisibility: "hidden",
									transform: isFlipped
										? "rotateY(0deg) translateZ(-1px)"
										: "rotateY(0deg) translateZ(1px)",
									boxShadow: `
										0 0 16px rgba(220, 220, 220, 0.25),
										0 0 18px rgba(180, 180, 180, 0.15),
										0 25px 50px -12px ${accent}40
										`,
								}}
							>
								{/* Background Gradient */}
								<img
									src="/cardbg.png"
									alt="Card Background"
									className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
								/>

								<img
									src={`/planets/${card.ruling_planet_theme.toLowerCase()}.png`}
									alt="Card Background"
									className="absolute left-0 bottom-20 w-full h-auto object-cover z-20 pointer-events-none"
								/>

								<img
									src="/small-black-ellipse.png"
									alt="Card Background"
									className="absolute left-0 -bottom-2 w-full h-auto object-cover z-20 pointer-events-none"
								/>
								{/* Noise Texture Overlay */}

								{/* Content */}
								<div className="relative z-20 h-full flex flex-col gap-0 p-8">
									{/* Header */}
									<div className="flex justify-center items-center mb-0">
										<div
											className={`text-white  px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest`}
											style={{
												boxShadow: `
      0 0 4px rgba(220, 220, 220, 0.25),
      0 0 4px rgba(180, 180, 180, 0.15),
      0 25px 75px -12px ${accent}10
    `,
											}}
										>
											<img
												src={"/Hastrology.svg"}
												alt={"Hastrology"}
												className="w-40 h-8"
											/>
										</div>
									</div>

									{/* Center Content */}
									<div className="flex-1 mt-8 mb-20 min-h-0 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
										<div className="mb-4 flex items-center justify-between">
											<div>
												<h2 className="text-2xl font-bold text-white tracking-tight">
													{user?.username}
												</h2>
												<h3 className="text-sm mt-1 font-bold text-white/60 tracking-tight">
													@{user?.twitterUsername}
												</h3>
											</div>
											{user?.twitterProfileUrl && (
												<img
													src={`/api/image?url=${encodeURIComponent(
														user.twitterProfileUrl.replace(
															"_normal",
															"_400x400",
														),
													)}`}
													alt={user?.username || "Twitter Profile"}
													className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md"
												/>
											)}
										</div>

										<div className="mt-4">
											<img
												src={`/stars/${card.front.zodiac_sign.toLowerCase()}.svg`}
												alt={card.front.zodiac_sign}
												className="w-24 h-16"
											/>
										</div>
										{/* Details */}
										<div className="flex flex-row justify-between items-center">
											<div className="flex flex-col gap-2 space-y-1 text-white/80 text-md font-medium">
												<p className=" text-white font-medium text-md">
													{card.front.vibe_status}
												</p>
												<h3 className="text-sm leading-snug drop-shadow-md text-left text-white/80 mx-0 mb-4">
													{card.front.hook_1}
												</h3>

												<h3 className="text-sm leading-snug drop-shadow-md text-left text-white/80 mx-0">
													{card.front.hook_2}
												</h3>

												<motion.div
													animate={{ opacity: 1, y: 0 }}
													className="space-y-3 mt-2"
													initial={{ opacity: 0, y: 10 }}
													transition={{ delay: 0.5 }}
												>
													<div className="grid grid-cols-3 gap-3">
														<div className="bg-white/5 rounded-xl p-2 text-center border border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
															<div className="text-[10px] text-white/40 uppercase mb-2 tracking-wider font-medium">
																Lucky Number
															</div>
															<div className="text-sm font-black text-white">
																{card.back.lucky_assets.number}
															</div>
														</div>
														<div className="bg-white/5 rounded-xl p-2 text-center border border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
															<div className="text-[10px] text-white/40 uppercase mb-2 tracking-wider font-medium">
																Lucky Color
															</div>
															<div className="text-sm font-black text-white">
																{card.back.lucky_assets.color}
															</div>
														</div>
														<div className="bg-white/5 rounded-xl p-2 text-center border border-white/5 hover:border-white/10 transition-colors backdrop-blur-sm">
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
									</div>
									<div className="flex flex-col items-center gap-2 justify-center z-9999">
										<img
											src={`/zodiac/${card.front.zodiac_sign.toLowerCase()}.svg`}
											alt="Cosmic Back Visual"
											className="text-white w-24 h-24 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
										/>
										<span className="uppercase text-white/50">
											Ruling Planet: {card.ruling_planet_theme}
										</span>
									</div>
									{/* Footer */}
								</div>
							</motion.div>

							{/* ==================== BACK FACE ==================== */}
							<motion.div
								data-card-back
								className={`absolute w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl ${
									isFlipped ? "pointer-events-auto" : "pointer-events-none"
								}`}
								style={{
									transform: isFlipped
										? "rotateY(180deg) translateZ(1px)"
										: "rotateY(180deg) translateZ(-1px)",
									backfaceVisibility: "hidden",
									WebkitBackfaceVisibility: "hidden",
									boxShadow: `
      0 0 16px rgba(220, 220, 220, 0.25),
      0 0 18px rgba(180, 180, 180, 0.15),
      0 25px 50px -12px ${accent}40
    `,
								}}
							>
								{/* Content */}
								<div className="relative z-20 h-full flex flex-col gap-0 p-8">
									{/* Header */}
									<div className="flex justify-end items-center mb-3">
										{/* <button
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
									</button> */}
									</div>

									{/* Scrollable Content */}
									<div className="flex-1 min-h-0 mt-2 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
										{/* Detailed Reading */}
										<motion.div
											animate={{ opacity: 1, y: 0 }}
											className="space-y-3"
											initial={{ opacity: 0, y: 10 }}
											transition={{ delay: 0.2 }}
										>
											<div className="flex items-center gap-2">
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
													<h4 className="text-xs font-black uppercase tracking-widest">
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
												<h4 className="text-xs font-black uppercase tracking-widest">
													Shadow Warning
												</h4>
											</div>
											<p className="text-sm text-white/90 leading-relaxed">
												{card.back.shadow_warning}
											</p>
										</motion.div>
									</div>
								</div>
							</motion.div>
						</motion.div>
					</div>
				</div>

				<motion.div
					animate={{ opacity: 1 }}
					className="flex bg-black/30 mt-5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 items-center justify-center max-w-md mx-auto lg:mx-0"
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
							Tap card to flip for deep insight
						</span>
					</div>
				</motion.div>

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

			{/* Draft Editor Modal */}
			{/* X-Style Draft Editor Modal */}
			<AnimatePresence>
				{isDrafting && draftBlob && (
					<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => !isPosting && setIsDrafting(false)}
							className="absolute inset-0 bg-black/70"
						/>

						{/* Modal - X Style */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							className="relative w-full max-w-xl bg-black border border-white/20 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
						>
							{/* Header */}
							<div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
								<button
									onClick={() => !isPosting && setIsDrafting(false)}
									disabled={isPosting}
									className="text-white/90 hover:bg-white/10 rounded-full p-2 transition-colors"
								>
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path>
									</svg>
								</button>
								<button
									onClick={handlePostToTwitter}
									disabled={isPosting || !draftText.trim()}
									className="bg-[#1D9BF0] hover:bg-[#1A8CD8] disabled:opacity-50 disabled:cursor-not-allowed px-5 py-1.5 rounded-full text-white font-bold text-sm transition-all"
								>
									{isPosting ? (
										<div className="flex items-center gap-2">
											<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
											Posting
										</div>
									) : (
										"Post"
									)}
								</button>
							</div>

							{/* Content - Scrollable */}
							<div className="p-4 overflow-y-auto custom-scrollbar flex-1">
								{/* Profile Row */}
								<div className="flex gap-3">
									{user?.twitterProfileUrl && (
										<img
											src={`/api/image?url=${encodeURIComponent(
												user.twitterProfileUrl.replace("_normal", "_400x400"),
											)}`}
											alt={user?.username || "Profile"}
											className="w-10 h-10 rounded-full object-cover shrink-0"
										/>
									)}
									<div className="flex-1 min-w-0">
										{/* Text Area - Auto-expanding */}
										<textarea
											value={draftText}
											onChange={(e) => setDraftText(e.target.value)}
											className="w-full bg-transparent border-none text-white text-lg placeholder-white/40 resize-none focus:outline-none"
											placeholder="What is happening?!"
											disabled={isPosting}
											autoFocus
											rows={Math.max(3, Math.ceil(draftText.length / 50))}
											style={{
												minHeight: "80px",
												maxHeight: "none",
											}}
										/>

										{/* Image Preview */}
										<div className="mt-3 relative rounded-2xl overflow-hidden border border-white/20">
											<img
												src={URL.createObjectURL(draftBlob!)}
												alt="Card Preview"
												className="w-full object-cover"
											/>
										</div>
									</div>
								</div>

								{/* Bottom Bar */}
								<div className="flex flex-col border-t border-white/10 mt-3">
									{draftText.length > 280 && (
										<div className="py-2 px-1 text-red-400 text-xs font-medium flex items-center gap-2">
											<svg
												className="w-4 h-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
												/>
											</svg>
											Posts over 280 characters require X Premium
										</div>
									)}
									<div className="flex items-center justify-between pt-3">
										{/* Left Icons */}
										<div className="flex items-center gap-1">
											<button className="text-white/30 rounded-full p-2 opacity-50 cursor-not-allowed">
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM8 11.5c0 .828-.672 1.5-1.5 1.5S5 12.328 5 11.5 5.672 10 6.5 10s1.5.672 1.5 1.5z"></path>
												</svg>
											</button>
											<button className="text-white/30 rounded-full p-2 opacity-50 cursor-not-allowed">
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M3 5.5C3 4.119 4.12 3 5.5 3h13C19.88 3 21 4.119 21 5.5v13c0 1.381-1.12 2.5-2.5 2.5h-13C4.12 21 3 19.881 3 18.5v-13zM5.5 5c-.28 0-.5.224-.5.5v13c0 .276.22.5.5.5h13c.28 0 .5-.224.5-.5v-13c0-.276-.22-.5-.5-.5h-13zM18 10.711V9.25h-3.74v5.5h1.44v-1.719h1.7V11.57h-1.7v-.859H18zM11.79 9.25h1.44v5.5h-1.44v-5.5zm-3.07 1.375c.34 0 .77.172 1.02.43l1.03-.86c-.51-.601-1.28-.945-2.05-.945C7.19 9.25 6 10.453 6 12s1.19 2.75 2.72 2.75c.85 0 1.54-.344 2.05-.945v-2.149H8.38v1.032H9.4v.515c-.17.086-.42.172-.68.172-.76 0-1.36-.602-1.36-1.375 0-.688.6-1.375 1.36-1.375z"></path>
												</svg>
											</button>
											<button className="text-white/30 rounded-full p-2 opacity-50 cursor-not-allowed">
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M6 5c-1.1 0-2 .895-2 2s.9 2 2 2 2-.895 2-2-.9-2-2-2zM2 7c0-2.209 1.79-4 4-4s4 1.791 4 4-1.79 4-4 4-4-1.791-4-4zm20 1H12V6h10v2zM6 15c-1.1 0-2 .895-2 2s.9 2 2 2 2-.895 2-2-.9-2-2-2zm-4 2c0-2.209 1.79-4 4-4s4 1.791 4 4-1.79 4-4 4-4-1.791-4-4zm20 1H12v-2h10v2zM7 7c0 .552-.45 1-1 1s-1-.448-1-1 .45-1 1-1 1 .448 1 1z"></path>
												</svg>
											</button>
											<button className="text-white/30 rounded-full p-2 opacity-50 cursor-not-allowed">
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M8 9.5C8 8.119 8.672 7 9.5 7S11 8.119 11 9.5 10.328 12 9.5 12 8 10.881 8 9.5zm6.5 2.5c.828 0 1.5-1.119 1.5-2.5S15.328 7 14.5 7 13 8.119 13 9.5s.672 2.5 1.5 2.5zM12 16c-2.224 0-3.021-2.227-3.051-2.316l-1.897.633c.05.15 1.271 3.684 4.949 3.684s4.898-3.533 4.949-3.684l-1.896-.638c-.033.095-.83 2.322-3.053 2.322zm10.25-4.001c0 5.652-4.598 10.25-10.25 10.25S1.75 17.652 1.75 12 6.348 1.75 12 1.75 22.25 6.348 22.25 12zm-2 0c0-4.549-3.701-8.25-8.25-8.25S3.75 7.451 3.75 12s3.701 8.25 8.25 8.25 8.25-3.701 8.25-8.25z"></path>
												</svg>
											</button>
											<button className="text-white/30 rounded-full p-2 opacity-50 cursor-not-allowed">
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M6 3V2h2v1h6V2h2v1h1.5C18.88 3 20 4.119 20 5.5v2h-2v-2c0-.276-.22-.5-.5-.5H16v1h-2V5H8v1H6V5H4.5c-.28 0-.5.224-.5.5v12c0 .276.22.5.5.5h3v2h-3C3.12 20 2 18.881 2 17.5v-12C2 4.119 3.12 3 4.5 3H6zm9.5 8c-2.49 0-4.5 2.015-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.015 4.5-4.5-2.01-4.5-4.5-4.5zM9 15.5C9 11.91 11.91 9 15.5 9s6.5 2.91 6.5 6.5-2.91 6.5-6.5 6.5S9 19.09 9 15.5zm5.5-2.5h2v2.086l1.71 1.707-1.42 1.414-2.29-2.293V13z"></path>
												</svg>
											</button>
											<button className="text-white/30 rounded-full p-2 opacity-50 cursor-not-allowed">
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path d="M12 7c-1.93 0-3.5 1.57-3.5 3.5S10.07 14 12 14s3.5-1.57 3.5-3.5S13.93 7 12 7zm0 5c-.827 0-1.5-.673-1.5-1.5S11.173 9 12 9s1.5.673 1.5 1.5S12.827 12 12 12zm0-10c-4.687 0-8.5 3.813-8.5 8.5 0 5.967 7.621 11.116 7.945 11.332l.555.37.555-.37c.324-.216 7.945-5.365 7.945-11.332C20.5 5.813 16.687 2 12 2zm0 17.77c-1.665-1.241-6.5-5.196-6.5-9.27C5.5 6.916 8.416 4 12 4s6.5 2.916 6.5 6.5c0 4.073-4.835 8.028-6.5 9.27z"></path>
												</svg>
											</button>
										</div>

										{/* Right - Character Count */}
										<div className="flex items-center gap-3">
											<div
												className={`text-xs ${draftText.length > 280 ? "text-red-500 font-bold" : "text-white/50"}`}
											>
												{draftText.length}/280
											</div>
										</div>
									</div>
								</div>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
			{openModal && (
				<TradeModal
					card={card}
					onClose={() => setOpenModal(false)}
					onTradeComplete={() => {
						setOpenModal(false);
					}}
				/>
			)}
		</div>
	);
};
