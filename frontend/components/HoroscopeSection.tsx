"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { FC, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { buildEnterLotteryInstruction } from "@/lib/hastrology_program";
import { useStore } from "@/store/useStore";
import { AstroCard } from "./AstroCard";
import { LotteryCountdown } from "./LotteryCountdown";
import { Toast } from "./toast";

const PAYMENT_AMOUNT = 0.01; // SOL

// Planetary theme configurations
export const getPlanetaryTheme = (planet: string) => {
	const themes: Record<
		string,
		{
			gradient: string;
			glow: string;
			accent: string;
			emoji: string;
		}
	> = {
		sun: {
			gradient: "from-amber-500/20 via-orange-500/10 to-yellow-500/20",
			glow: "shadow-[0_0_80px_rgba(251,146,60,0.3)]",
			accent: "from-amber-400 to-orange-500",
			emoji: "☀️",
		},
		moon: {
			gradient: "from-blue-500/20 via-indigo-500/10 to-cyan-500/20",
			glow: "shadow-[0_0_80px_rgba(59,130,246,0.3)]",
			accent: "from-blue-400 to-indigo-500",
			emoji: "🌙",
		},
		mars: {
			gradient: "from-red-500/20 via-rose-500/10 to-orange-500/20",
			glow: "shadow-[0_0_80px_rgba(239,68,68,0.3)]",
			accent: "from-red-500 to-rose-600",
			emoji: "🔥",
		},
		mercury: {
			gradient: "from-cyan-500/20 via-teal-500/10 to-blue-500/20",
			glow: "shadow-[0_0_80px_rgba(6,182,212,0.3)]",
			accent: "from-cyan-400 to-teal-500",
			emoji: "⚡",
		},
		jupiter: {
			gradient: "from-emerald-500/20 via-green-500/10 to-teal-500/20",
			glow: "shadow-[0_0_80px_rgba(34,197,94,0.3)]",
			accent: "from-emerald-400 to-green-500",
			emoji: "🌟",
		},
		venus: {
			gradient: "from-pink-500/20 via-rose-500/10 to-purple-500/20",
			glow: "shadow-[0_0_80px_rgba(236,72,153,0.3)]",
			accent: "from-pink-400 to-rose-500",
			emoji: "💖",
		},
		saturn: {
			gradient: "from-purple-500/20 via-violet-500/10 to-indigo-500/20",
			glow: "shadow-[0_0_80px_rgba(147,51,234,0.3)]",
			accent: "from-purple-400 to-violet-600",
			emoji: "🪐",
		},
		uranus: {
			gradient: "from-sky-500/20 via-blue-500/10 to-indigo-500/20",
			glow: "shadow-[0_0_80px_rgba(14,165,233,0.3)]",
			accent: "from-sky-400 to-blue-500",
			emoji: "💫",
		},
		neptune: {
			gradient: "from-violet-500/20 via-purple-500/10 to-fuchsia-500/20",
			glow: "shadow-[0_0_80px_rgba(139,92,246,0.3)]",
			accent: "from-violet-400 to-purple-500",
			emoji: "🌊",
		},
	};
	return themes[planet.toLowerCase()] || themes.mars;
};

export const HoroscopeSection: FC = () => {
	const { publicKey, sendTransaction } = useWallet();
	const { connection } = useConnection();
	const { user, card, setCard, loading, setLoading } = useStore();

	const [status, setStatus] = useState<
		"checking" | "ready" | "paying" | "generating" | "complete" | "lottery"
	>("checking");
	const [error, setError] = useState<string | null>(null);
	const [isPaid, setIsPaid] = useState(false);
	const router = useRouter();

	const theme = card
		? getPlanetaryTheme(card.ruling_planet_theme || "mars")
		: getPlanetaryTheme("mars");

	const checkStatus = useCallback(async () => {
		if (!publicKey) return;

		try {
			const result = await api.getStatus(publicKey.toBase58());

			if (result.status === "exists" && result.card) {
				setCard(result.card);
				setStatus("complete");
			} else if (result.status === "paid") {
				setIsPaid(true);
				setStatus("ready");
			} else {
				setIsPaid(false);
				setStatus("ready");
			}
		} catch (err) {
			console.error("Failed to check status:", err);
			setStatus("ready");
		}
	}, [publicKey, setCard]);

	useEffect(() => {
		if (publicKey && user) {
			checkStatus();
		}
	}, [publicKey, user, checkStatus]);

	const handlePayment = async () => {
		if (!publicKey) return;

		setLoading(true);
		setError(null);

		let signature = "";

		try {
			if (!isPaid) {
				if (!sendTransaction) return;

				setStatus("paying");
				const instruction = await buildEnterLotteryInstruction(
					publicKey,
					connection,
				);
				const transaction = new Transaction().add(instruction);

				signature = await sendTransaction(transaction, connection);
				await connection.confirmTransaction(signature, "confirmed");
			}

			setStatus("generating");
			const result = await api.confirmHoroscope(
				publicKey.toBase58(),
				signature || "ALREADY_PAID",
			);

			setCard(result.card);
			setStatus("complete");
			setIsPaid(false);
		} catch (err) {
			console.error("Payment/Generation error:", err);
			setError(
				err instanceof Error ? err.message : "Failed to process request",
			);
			setStatus("ready");
		} finally {
			setLoading(false);
		}
	};

	const handleNewReading = () => {
		setCard(null);
		setStatus("ready");
	};

	if (!publicKey) {
		return (
			<section className="min-h-screen flex flex-col items-center justify-center bg-transparent text-white">
				<motion.div
					animate={{ rotate: 360 }}
					transition={{
						duration: 3,
						repeat: Infinity,
						ease: "linear",
					}}
					className="w-24 h-24 mx-auto mb-8 relative"
				>
					<div className="absolute inset-0 rounded-full border-4 border-black"></div>
					<div className="absolute inset-0 rounded-full border-4 border-t-[#FC5411] border-r-[#FC5411] border-b-transparent border-l-transparent"></div>
				</motion.div>
				<p className="animate-pulse text-3xl text-[#CCCCCC]">
					Connecting to the cosmos…
				</p>
			</section>
		);
	}

	return (
		<>
			<section
				id="horoscope-section"
				className="min-h-screen flex items-center justify-center py-12 px-4 relative"
			>
				<div className="w-full max-w-8xl relative z-10">
					<AnimatePresence mode="wait">
						{/* COSMIC ALTAR - READY STATE */}
						{status === "ready" && (
							<motion.div
								key="ready"
								initial={{ opacity: 0, x: 0, scale: 0.9 }}
								animate={{ opacity: 1, x: 0, scale: 1 }}
								exit={{ opacity: 0, x: -300, scale: 0.9 }}
								transition={{ duration: 0.5, ease: "easeInOut" }}
								className="relative"
							>
								{/* Outer Orange Glow */}
								<div className="absolute inset-0 rounded-[3rem] bg-gradient-to-r from-orange-500/30 via-[#FC5411]/40 to-orange-600/30 blur-xl"></div>
								<div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-[#FC5411]/20 to-orange-500/20 blur-xl"></div>

								<div className="relative backdrop-blur-2xl bg-black/95 rounded-[3rem] p-8 md:p-12 shadow-2xl">
									{/* Decorative Elements */}
									<div className="absolute top-8 left-8 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl animate-pulse"></div>
									<div className="absolute bottom-8 right-8 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>

									{/* Content */}
									<div className="relative text-center">
										{/* Title */}
										<motion.h2
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.3 }}
											className="text-4xl md:text-6xl font-bold mb-4"
										>
											<span>Your Cosmic Reading Awaits</span>
										</motion.h2>

										{/* Subtitle */}
										<motion.p
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.4 }}
											className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-light"
										>
											Unlock your personalized astrology card powered by AI and
											your birth chart
										</motion.p>

										{/* Payment Button */}
										<motion.div
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.5 }}
											className="max-w-md mx-auto"
										>
											<button
												onClick={handlePayment}
												disabled={loading}
												className="group relative w-full overflow-hidden rounded-2xl p-[2px] transition-all duration-300 hover:scale-105"
												type="button"
											>
												{/* Animated Border Gradient */}
												<div className="absolute inset-0 bg-[#121212] opacity-75 blur-sm group-hover:opacity-100 transition-opacity"></div>
												<div className="absolute inset-0 bg-[#121212] animate-gradient"></div>

												<div className="relative bg-black rounded-2xl p-8 flex flex-col items-center gap-4">
													{/* Label */}
													<div className="flex items-center gap-2">
														<span className="text-white font-bold tracking-widest text-md uppercase">
															Full Cosmic Reading
														</span>
													</div>

													{/* Price */}
													<div className="flex items-baseline gap-2">
														<span className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-purple-200">
															{PAYMENT_AMOUNT}
														</span>
														<span className="text-2xl text-slate-400 font-semibold">
															SOL
														</span>
													</div>

													{/* CTA */}
													<div className="relative w-full py-4 px-8 rounded-xl font-bold text-white group-hover:shadow-amber-600/50 transition-all flex items-center justify-center gap-2">
														<div className="absolute inset-0 bg-[#121212] rounded-xl"></div>

														{/* Gradient border effect */}
														<div className="absolute inset-0 rounded-xl p-[2px] bg-gradient-to-r from-transparent via-transparent to-transparent">
															<div
																className="absolute inset-0 rounded-xl"
																style={{
																	background: `
				linear-gradient(135deg, #FC5411 0%, transparent 15%),
				linear-gradient(225deg, #FC5411 0%, transparent 15%),
				linear-gradient(45deg, #FC5411 0%, transparent 15%),
				linear-gradient(315deg, #FC5411 0%, transparent 15%)
			`,
																	WebkitMask: `
				linear-gradient(#fff 0 0) content-box,
				linear-gradient(#fff 0 0)
			`,
																	WebkitMaskComposite: "xor",
																	maskComposite: "exclude",
																	padding: "2px",
																}}
															></div>
														</div>
														<div className="relative z-10 flex items-center justify-center gap-2">
															{loading ? (
																<>
																	<svg
																		className="animate-spin h-5 w-5"
																		viewBox="0 0 24 24"
																	>
																		<title>svg</title>
																		<circle
																			className="opacity-25"
																			cx="12"
																			cy="12"
																			r="10"
																			stroke="currentColor"
																			strokeWidth="4"
																			fill="none"
																		></circle>
																		<path
																			className="opacity-75"
																			fill="currentColor"
																			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																		></path>
																	</svg>
																	<span>Processing...</span>
																</>
															) : isPaid ? (
																<>
																	<span>Generate My Reading</span>
																	<span className="text-lg">✨</span>
																</>
															) : (
																<>
																	<span>Unlock Your Reading</span>
																	<span className="text-lg">🔮</span>
																</>
															)}
														</div>
													</div>
												</div>
											</button>
										</motion.div>
									</div>
								</div>
							</motion.div>
						)}

						{/* PROCESSING STATES */}
						{(status === "paying" || status === "generating") && (
							<motion.div
								key="processing"
								initial={{ opacity: 0, x: 300, scale: 0.9 }}
								animate={{ opacity: 1, x: 0, scale: 1 }}
								exit={{ opacity: 0, x: 0, scale: 0.9 }}
								transition={{ duration: 0.5, ease: "easeInOut" }}
								className="relative"
							>
								<div className="absolute inset-0 rounded-[3rem] bg-[#FC5411] blur-xl animate-pulse"></div>

								<div className="relative backdrop-blur-2xl bg-black border border-white/10 rounded-[3rem] p-16 text-center shadow-2xl">
									{/* Cosmic Loader */}
									<motion.div
										animate={{ rotate: 360 }}
										transition={{
											duration: 3,
											repeat: Infinity,
											ease: "linear",
										}}
										className="w-24 h-24 mx-auto mb-8 relative"
									>
										<div className="absolute inset-0 rounded-full border-4 border-black"></div>
										<div className="absolute inset-0 rounded-full border-4 border-t-[#FC5411] border-r-[#FC5411] border-b-transparent border-l-transparent"></div>
									</motion.div>

									<motion.h3
										animate={{ opacity: [0.5, 1, 0.5] }}
										transition={{ duration: 2, repeat: Infinity }}
										className="text-3xl md:text-4xl font-bold text-white mb-4"
									>
										{status === "paying"
											? "Confirming Transaction"
											: "Channeling the Cosmos"}
									</motion.h3>

									<p className="text-slate-400 text-lg">
										{status === "paying"
											? "Please approve the transaction in your wallet"
											: "AI is crafting your personalized reading ✨"}
									</p>
								</div>
							</motion.div>
						)}

						{/* COMPLETE STATE - CARD DISPLAY */}
						{status === "complete" && card && (
							<motion.div
								key="complete"
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.8, ease: "easeOut" }}
								className="flex flex-col items-center mt-0"
							>
								{/* Card Display */}
								<motion.div
									initial={{ opacity: 0, y: 50 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.4, duration: 0.8 }}
									className="w-full max-w-screen mx-auto mb-20"
								>
									<AstroCard card={card} showShare={true} />
								</motion.div>
							</motion.div>
						)}

						{/* LOTTERY COUNTDOWN STATE */}
						{status === "lottery" && (
							<motion.div
								key="lottery"
								initial={{ opacity: 0, x: 100 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -100 }}
								transition={{ duration: 0.5 }}
								className="w-full"
							>
								<LotteryCountdown onBack={() => setStatus("complete")} />
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</section>
			<Toast
				message={error}
				type="error"
				onClose={() => setError(null)}
				duration={5000}
			/>
		</>
	);
};
