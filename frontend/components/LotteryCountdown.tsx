"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { FC, useCallback, useEffect, useState } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { api } from "@/lib/api";
import {
	fetchLotteryState,
	fetchUserReceipt,
	fetchUserTicket,
	getWinningTicket,
	hasUserEnteredSpecificLottery,
	LotteryState,
} from "@/lib/hastrology_program";

interface LotteryCountdownProps {
	onBack?: () => void;
	onStatusChange?: (status: string) => void;
}

type Status = "loading" | "countdown" | "drawing" | "checking" | "result" | "not_entered";
type Result = "won" | "lost" | null;

interface WinnerInfo {
	address: string;
	xHandle?: string;
	prize: string;
	lotteryId: string;
}

export const LotteryCountdown: FC<LotteryCountdownProps> = ({
	onBack,
	onStatusChange,
}) => {
	const { connection } = useConnection();
	const { address } = usePrivyWallet();

	const [state, setState] = useState<LotteryState | null>(null);
	const [timeLeft, setTimeLeft] = useState<{
		h: number;
		m: number;
		s: number;
	} | null>(null);
	const [status, setStatus] = useState<Status>("loading");
	const [result, setResult] = useState<Result>(null);
	const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);
	const [userPrize, setUserPrize] = useState<string | null>(null);
	const [lastWinnerInfo, setLastWinnerInfo] = useState<WinnerInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Track which lottery we're showing results for
	const [viewingLotteryId, setViewingLotteryId] = useState<BN | null>(null);

	// Calculate IST Time for display
	const istTime = state
		? new Date(state.lotteryEndtime.toNumber() * 1000).toLocaleTimeString(
			"en-IN",
			{
				timeZone: "Asia/Kolkata",
				hour: "2-digit",
				minute: "2-digit",
				hour12: true,
			},
		)
		: "";

	// Calculate prize pool
	const prizePool = state
		? (
			(Number(state.ticketPrice) * Number(state.totalParticipants)) /
			1e9
		).toFixed(2)
		: "0.00";

	/**
	 * Main initialization - determines what the user should see
	 */
	const initializeLotteryView = useCallback(async () => {
		if (!address) {
			setStatus("loading");
			return;
		}

		const publicKey = new PublicKey(address);

		try {
			// Fetch current lottery state
			const lotteryState = await fetchLotteryState(connection);
			if (!lotteryState) {
				setError("Failed to load lottery data");
				return;
			}
			setState(lotteryState);

			const currentLotteryId = lotteryState.currentLotteryId;
			const now = Math.floor(Date.now() / 1000);
			const end = lotteryState.lotteryEndtime.toNumber();

			// PRIORITY 1: Check if user entered CURRENT lottery
			const enteredCurrent = await hasUserEnteredSpecificLottery(
				connection,
				publicKey,
				currentLotteryId,
			);

			if (enteredCurrent) {
				setViewingLotteryId(currentLotteryId);

				// Determine state: countdown or drawing
				if (now >= end || lotteryState.isDrawing) {
					setStatus("drawing");
				} else {
					setStatus("countdown");
				}
				return;
			}

			// PRIORITY 2: Check if user entered PREVIOUS lottery (for results)
			const prevLotteryId = currentLotteryId.subn(1);

			if (prevLotteryId.lten(0)) {
				// No previous lottery exists, user is new
				setStatus("not_entered");
				return;
			}

			const enteredPrev = await hasUserEnteredSpecificLottery(
				connection,
				publicKey,
				prevLotteryId,
			);

			if (enteredPrev) {
				// User participated in previous lottery - show results
				await showPreviousLotteryResults(publicKey, prevLotteryId);
				return;
			}

			// PRIORITY 3: User hasn't entered current or previous lottery
			setStatus("not_entered");

			// Fetch last winner info for display
			await fetchLastWinnerInfo(prevLotteryId);

		} catch (err) {
			console.error("Error initializing lottery view:", err);
			setError("Failed to load lottery data");
		}
	}, [connection, address]);

	/**
	 * Show results for a previous lottery the user participated in
	 */
	const showPreviousLotteryResults = async (
		publicKey: PublicKey,
		lotteryId: BN
	) => {
		try {
			setViewingLotteryId(lotteryId);

			// Get user's receipt and ticket
			const userReceipt = await fetchUserReceipt(connection, publicKey, lotteryId);

			if (!userReceipt) {
				console.error("No receipt found for lottery", lotteryId.toString());
				setStatus("not_entered");
				return;
			}

			const userTicket = await fetchUserTicket(
				connection,
				lotteryId,
				userReceipt.ticketNumber
			);

			if (!userTicket) {
				console.error("No ticket found for lottery", lotteryId.toString());
				setStatus("not_entered");
				return;
			}

			// Check if user won
			if (userTicket.isWinner) {
				setResult("won");
				setUserPrize((userTicket.prizeAmount.toNumber() / 1e9).toFixed(2));
				setStatus("result");
				return;
			}

			// User lost - fetch winner info
			setResult("lost");
			const winningTicket = await getWinningTicket(connection, lotteryId);

			if (winningTicket) {
				const winnerAddress = winningTicket.user.toBase58();
				const prize = (winningTicket.prizeAmount.toNumber() / 1e9).toFixed(2);

				// Try to fetch X handle
				let xHandle: string | undefined;
				try {
					const profile = await api.getUserProfile(winnerAddress);
					if (profile?.user?.twitterUsername) {
						xHandle = `@${profile.user.twitterUsername}`;
					}
				} catch (e) {
					// Ignore - user may not have X connected
				}

				setWinnerInfo({
					address: winnerAddress,
					xHandle,
					prize,
					lotteryId: lotteryId.toString(),
				});
			}

			setStatus("result");

		} catch (err) {
			console.error("Error showing previous lottery results:", err);
			setStatus("not_entered");
		}
	};

	/**
	 * Fetch last winner info for "not_entered" state
	 */
	const fetchLastWinnerInfo = async (prevLotteryId: BN) => {
		if (prevLotteryId.lten(0)) return;

		try {
			const winningTicket = await getWinningTicket(connection, prevLotteryId);

			if (winningTicket) {
				const winnerAddress = winningTicket.user.toBase58();
				const prize = (winningTicket.prizeAmount.toNumber() / 1e9).toFixed(2);

				let xHandle: string | undefined;
				try {
					const profile = await api.getUserProfile(winnerAddress);
					if (profile?.user?.twitterUsername) {
						xHandle = `@${profile.user.twitterUsername}`;
					}
				} catch (e) {
					// Ignore
				}

				setLastWinnerInfo({
					address: winnerAddress,
					xHandle,
					prize,
					lotteryId: prevLotteryId.toString(),
				});
			}
		} catch (err) {
			console.error("Error fetching last winner:", err);
		}
	};

	// Initialize on mount and refresh every 30 seconds
	useEffect(() => {
		initializeLotteryView();
		const interval = setInterval(initializeLotteryView, 30000);
		return () => clearInterval(interval);
	}, [initializeLotteryView]);

	// Notify parent of status changes
	useEffect(() => {
		if (onStatusChange) {
			onStatusChange(status);
		}
	}, [status, onStatusChange]);

	// Countdown timer for "countdown" status
	useEffect(() => {
		if (!state || status !== "countdown") return;

		const timer = setInterval(() => {
			const now = Math.floor(Date.now() / 1000);
			const end = state.lotteryEndtime.toNumber();
			const diff = end - now;

			if (diff <= 0) {
				setStatus("drawing");
				setTimeLeft({ h: 0, m: 0, s: 0 });
			} else {
				const h = Math.floor(diff / 3600);
				const m = Math.floor((diff % 3600) / 60);
				const s = diff % 60;
				setTimeLeft({ h, m, s });
			}
		}, 1000);

		return () => clearInterval(timer);
	}, [state, status]);

	/**
	 * Trigger draw and check results
	 */
	const handleCheckResult = async () => {
		const publicKey = new PublicKey(address ?? "");
		if (!state || !publicKey || !viewingLotteryId) return;

		setStatus("checking");
		setError(null);

		try {
			// Trigger draw via API
			const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
			const triggerResponse = await fetch(`${apiUrl}/lottery/trigger-draw`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			const triggerData = await triggerResponse.json();

			// Handle different response codes
			if (triggerResponse.ok ||
				triggerData.code === "DRAW_IN_PROGRESS" ||
				triggerData.code === "WINNER_ALREADY_SELECTED") {
				// Wait for draw to complete
				await pollForWinner(publicKey, viewingLotteryId);
			} else {
				setError(triggerData.error || "Failed to trigger draw");
				setStatus("drawing");
			}

		} catch (err) {
			console.error("Error checking result:", err);
			setError("Failed to check results. Please try again.");
			setStatus("drawing");
		}
	};

	/**
	 * Poll for winner to be selected
	 */
	const pollForWinner = async (publicKey: PublicKey, lotteryId: BN) => {
		// Poll up to 30 times (60 seconds)
		for (let i = 0; i < 30; i++) {
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentState = await fetchLotteryState(connection);
			if (!currentState) continue;

			// Check if winner has been selected
			// After payout, currentLotteryId increments, so check if we've moved on
			if (currentState.currentLotteryId.gt(lotteryId)) {
				// Payout happened, lottery advanced - show results
				await showPreviousLotteryResults(publicKey, lotteryId);
				return;
			}
		}

		// Timeout - draw taking too long
		setError("Draw is taking longer than expected. Please try again in a moment.");
		setStatus("drawing");
	};

	/**
	 * Reset and check next lottery
	 */
	const handleNextLottery = async () => {
		setResult(null);
		setViewingLotteryId(null);
		setWinnerInfo(null);
		setUserPrize(null);
		setError(null);
		await initializeLotteryView();
	};

	// Loading state
	if (!state) {
		return (
			<section className="min-h-[600px] flex items-center justify-center">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-black border-t-[#fc5411] rounded-full animate-spin mx-auto mb-4" />
					<p className="text-slate-400">Loading lottery data...</p>
				</div>
			</section>
		);
	}

	return (
		<section className="md:min-h-[600px] min-h-[500px] flex items-center justify-center relative overflow-hidden">
			<div className="relative z-10 w-full max-w-7xl px-4">
				<AnimatePresence mode="wait">
					{/* LOADING STATE */}
					{status === "loading" && (
						<motion.div
							key="loading"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="text-center"
						>
							<div className="w-16 h-16 border-4 border-black border-t-[#fc5411] rounded-full animate-spin mx-auto mb-4" />
							<p className="text-slate-400">Loading lottery data...</p>
						</motion.div>
					)}

					{/* NOT ENTERED STATE */}
					{status === "not_entered" && (
						<motion.div
							key="not_entered"
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							className="text-center space-y-8"
						>
							<div>
								<div className="text-6xl mb-6">🌟</div>
								<h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
									Join Today's Cosmic Draw
								</h2>
								<p className="text-slate-300 text-xl mb-2">
									Generate your daily horoscope to enter the lottery
								</p>
								<p className="text-slate-400 text-lg">
									Next draw at {istTime} IST
								</p>
							</div>

							<div className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-2xl">
								<p className="text-slate-300 text-lg mb-2">
									Current Prize Pool
								</p>
								<p className="text-4xl font-bold text-white">
									{prizePool}{" "}
									<span className="text-2xl text-slate-400">SOL</span>
								</p>
								<p className="text-slate-500 text-sm mt-2">
									{state.totalParticipants.toString()} cosmic tickets entered
								</p>
							</div>

							{/* LAST WINNER DISPLAY */}
							{lastWinnerInfo && (
								<motion.div
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.2 }}
									className="py-4 px-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"
								>
									<p className="text-yellow-400 text-sm font-bold uppercase tracking-wide mb-1">
										🏆 Last Draw Winner
									</p>
									<div className="flex items-center justify-center gap-2">
										<p className="text-white font-mono text-lg">
											{lastWinnerInfo.xHandle ||
												`${lastWinnerInfo.address.slice(0, 4)}...${lastWinnerInfo.address.slice(-4)}`}
										</p>
										<span className="text-slate-500">•</span>
										<p className="text-white font-bold text-lg">
											{lastWinnerInfo.prize} SOL
										</p>
									</div>
									<a
										href={`https://explorer.solana.com/address/${lastWinnerInfo.address}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-slate-500 hover:text-[#fc5411] transition-colors mt-2 inline-block"
									>
										View on Explorer ↗
									</a>
								</motion.div>
							)}

							<div className="space-y-4">
								<p className="text-slate-400">
									Complete your horoscope reading to get your lottery ticket ✨
								</p>
								<Link href="/cards" className="block w-full">
									<button
										className="w-full group relative py-4 px-10 bg-gradient-to-r from-[#FC5411] to-[#ff7a3d] rounded-xl font-bold text-lg text-white shadow-xl hover:scale-102 transition-all duration-200 hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
										type="button"
									>
										Generate Horoscope 🔮
									</button>
								</Link>
							</div>

							<div className="pt-8 border-t border-white/5">
								<p className="text-xs text-slate-500">
									Lottery #{state.currentLotteryId.toString()}
								</p>
							</div>
						</motion.div>
					)}

					{/* COUNTDOWN STATE */}
					{status === "countdown" && (
						<motion.div
							key="countdown"
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							className="text-center space-y-8"
						>
							<div>
								<span className="inline-block py-1.5 px-4 rounded-full border border-[#fc5411] bg-black text-[#fc5411] text-sm font-semibold tracking-wide uppercase mb-4">
									Next Cosmic Draw: {istTime} IST
								</span>

								<h2 className="text-5xl md:text-6xl font-bold text-white mb-2">
									{prizePool}{" "}
									<span className="text-3xl text-slate-400">SOL</span>
								</h2>
								<p className="text-slate-400 text-lg">
									{state.totalParticipants.toString()} cosmic tickets entered
								</p>
							</div>

							<div className="flex justify-center gap-3 md:gap-4">
								{timeLeft ? (
									<>
										<TimeBlock value={timeLeft.h} label="Hours" />
										<div className="flex items-center">
											<span className="text-3xl font-light text-white/30 mb-6">
												:
											</span>
										</div>
										<TimeBlock value={timeLeft.m} label="Minutes" />
										<div className="flex items-center">
											<span className="text-3xl font-light text-white/30 mb-6">
												:
											</span>
										</div>
										<TimeBlock value={timeLeft.s} label="Seconds" />
									</>
								) : (
									<div className="text-2xl text-white/50 animate-pulse py-8">
										Calculating...
									</div>
								)}
							</div>

							<div className="pt-6 space-y-4">
								<p className="text-slate-300 text-lg">
									Your lucky stars are locked in ✨
								</p>
								<p className="text-slate-300 text-lg">
									Return when the countdown ends to reveal your fate
								</p>
							</div>

							<div className="pt-8 border-t border-white/5">
								<p className="text-xs text-slate-500">
									Lottery #{viewingLotteryId?.toString()}
								</p>
							</div>
						</motion.div>
					)}

					{/* DRAWING STATE */}
					{status === "drawing" && (
						<motion.div
							key="drawing"
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="text-center space-y-8"
						>
							<div>
								<h2 className="py-3 mb-10 text-4xl md:text-5xl font-bold text-white">
									The Stars Are Aligning ✨
								</h2>
								<p className="text-slate-300 text-2xl mb-2">
									Time's up! The cosmic draw is ready.
								</p>
								<p className="text-2xl font-bold text-white mb-8">
									Prize Pool: {prizePool} SOL
								</p>
							</div>

							{error && (
								<motion.div
									initial={{ opacity: 0, y: -10 }}
									animate={{ opacity: 1, y: 0 }}
									className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
								>
									<p className="text-red-400 text-sm">{error}</p>
								</motion.div>
							)}

							<button
								onClick={handleCheckResult}
								className="w-full group relative py-4 px-10 border border-[#FC5411] rounded-xl font-bold text-lg text-white shadow-xl hover:scale-102 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
								type="button"
							>
								<span className="relative z-10 flex items-center gap-2 justify-center">
									Check If You Won 🏆
								</span>
							</button>

							<p className="text-slate-500 text-lg">
								Lottery #{viewingLotteryId?.toString()}
							</p>
						</motion.div>
					)}

					{/* CHECKING STATE */}
					{status === "checking" && (
						<motion.div
							key="checking"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="text-center py-12"
						>
							<div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-6" />
							<p className="text-xl text-slate-300 mb-2">
								Reading the cosmos...
							</p>
							<p className="text-slate-500 text-sm">Checking your ticket</p>
						</motion.div>
					)}

					{/* RESULT STATE */}
					{status === "result" && (
						<motion.div
							key="result"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className="text-center space-y-6"
						>
							{result === "won" && (
								<>
									<motion.div
										initial={{ scale: 0 }}
										animate={{ scale: 1 }}
										transition={{ type: "spring", duration: 0.6 }}
										className="text-8xl mb-4"
									>
										🎉
									</motion.div>
									<h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 mb-4">
										COSMIC VICTORY!
									</h2>
									<div className="p-8 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-2xl">
										<p className="text-slate-300 mb-2">You won</p>
										<p className="text-6xl font-bold text-white mb-4">
											{userPrize} SOL
										</p>
										<p className="text-slate-400 text-sm">
											The universe has smiled upon you ✨
										</p>
									</div>
								</>
							)}

							{result === "lost" && (
								<>
									<h2 className="text-6xl font-bold text-white mb-12">
										Not This Time 🌙
									</h2>

									<p className="text-white text-2xl mb-4">
										The cosmic winner of this round:
									</p>
									<p className="text-2xl font-mono text-[#fc5411] mb-2 break-all">
										{winnerInfo?.xHandle || winnerInfo?.address}
									</p>

									{winnerInfo?.address && (
										<a
											href={`https://explorer.solana.com/address/${winnerInfo.address}?cluster=devnet`}
											target="_blank"
											rel="noopener noreferrer"
											className="block text-sm text-slate-500 hover:text-[#fc5411] transition-colors mb-4"
										>
											View on Explorer ↗
										</a>
									)}

									<p className="text-2xl font-bold text-white mb-2">
										Prize: {winnerInfo?.prize} SOL
									</p>
									<p className="text-white text-xl mt-6">
										Your stars will align next time 🌟
									</p>
								</>
							)}

							{viewingLotteryId && (
								<p className="text-slate-500 text-sm mt-6">
									Lottery #{viewingLotteryId.toString()} Result
								</p>
							)}

							<Link href="/cards">
								<button
									onClick={handleNextLottery}
									className="group relative w-full px-8 py-4 mt-6
								border border-[#FC5411]
								text-white font-bold
								rounded-2xl transition-all
								hover:scale-102
								hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
									type="button"
								>
									Join Next Lottery 🔮
								</button>
							</Link>
						</motion.div>
					)}
				</AnimatePresence>

				{onBack &&
					status !== "not_entered" &&
					result !== "won" &&
					result !== "lost" && (
						<motion.button
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.3 }}
							onClick={onBack}
							className="mt-8 text-slate-500 hover:text-white text-sm transition-colors flex items-center gap-2 mx-auto"
						>
							<span>←</span> Back to Horoscope
						</motion.button>
					)}
			</div>
		</section>
	);
};

const TimeBlock = ({ value, label }: { value: number; label: string }) => (
	<div className="flex flex-col items-center">
		<div className="relative rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 w-20 h-20 md:w-24 md:h-24 flex items-center justify-center shadow-lg">
			<span className="text-3xl md:text-4xl font-mono text-white font-bold tabular-nums">
				{value.toString().padStart(2, "0")}
			</span>
		</div>
		<span className="text-xs font-semibold text-slate-500 mt-2 tracking-wider uppercase">
			{label}
		</span>
	</div>
);