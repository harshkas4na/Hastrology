"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { FC, useEffect, useState, useCallback } from "react";
import BN from "bn.js";
import {
	fetchLotteryState,
	fetchUserTicket,
	fetchUserReceipt,
	hasUserEnteredSpecificLottery,
	LotteryState,
} from "@/lib/hastrology_program";

interface LotteryCountdownProps {
	onBack?: () => void;
	onStatusChange?: (status: string) => void;
}

export const LotteryCountdown: FC<LotteryCountdownProps> = ({ onBack, onStatusChange }) => {
	const { connection } = useConnection();
	const { publicKey } = useWallet();

	const [state, setState] = useState<LotteryState | null>(null);
	const [timeLeft, setTimeLeft] = useState<{
		h: number;
		m: number;
		s: number;
	} | null>(null);

	// New status: "not_entered" for users who haven't entered current lottery
	const [status, setStatus] = useState<
		"loading" | "countdown" | "drawing" | "checking" | "result" | "not_entered"
	>("loading");

	const [result, setResult] = useState<"won" | "lost" | "pending" | null>(null);
	const [winnerAddress, setWinnerAddress] = useState<string | null>(null);
	const [prize, setPrize] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Track which lottery the result is for
	const [resultLotteryId, setResultLotteryId] = useState<BN | null>(null);

	// Calculate IST Time for display
	const istTime = state
		? new Date(state.lotteryEndtime.toNumber() * 1000).toLocaleTimeString("en-IN", {
			timeZone: "Asia/Kolkata",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		})
		: "";

	// Calculate prize pool
	const prizePool = state
		? (
			(Number(state.ticketPrice) * Number(state.totalParticipants)) /
			1e9
		).toFixed(2)
		: "0.00";

	// Main initialization logic
	const initializeLotteryView = useCallback(async () => {
		if (!publicKey) {
			setStatus("loading");
			return;
		}

		try {
			const lotteryState = await fetchLotteryState(connection);
			if (!lotteryState) {
				setError("Failed to load lottery data");
				return;
			}
			setState(lotteryState);

			const currentLotteryId = lotteryState.currentLotteryId;
			const prevLotteryId = currentLotteryId.subn(1);
			const now = Math.floor(Date.now() / 1000);
			const end = lotteryState.lotteryEndtime.toNumber();

			// Check if user entered the PREVIOUS lottery
			const enteredPrevLottery = prevLotteryId.gtn(0)
				? await hasUserEnteredSpecificLottery(connection, publicKey, prevLotteryId)
				: false;

			// Check if user entered the CURRENT lottery
			const enteredCurrentLottery = await hasUserEnteredSpecificLottery(
				connection,
				publicKey,
				currentLotteryId
			);

			// LOGIC:
			// 1. If user was in previous lottery AND that lottery is done (we're now on a new one)
			//    → Show result for previous lottery
			// 2. Else if user is in current lottery
			//    → If lottery ended → show drawing state
			//    → If lottery ongoing → show countdown
			// 3. Else (user not in current lottery)
			//    → Show "not_entered" state

			if (enteredPrevLottery && prevLotteryId.gtn(0)) {
				// User was in prev lottery, fetch their result
				const prevReceipt = await fetchUserReceipt(connection, publicKey, prevLotteryId);

				if (prevReceipt) {
					// Try to fetch winner info from prev lottery
					// We need to find the winning ticket for the previous lottery
					// The winner was stored in the state before reset, but we can check if user's ticket won
					const userTicket = await fetchUserTicket(
						connection,
						prevLotteryId,
						prevReceipt.ticketNumber
					);

					if (userTicket && userTicket.isWinner) {
						// User won!
						setResult("won");
						setWinnerAddress(publicKey.toBase58());
						setPrize((userTicket.prizeAmount.toNumber() / 1e9).toFixed(2));
						setResultLotteryId(prevLotteryId);
						setStatus("result");
						return;
					} else if (userTicket) {
						// User lost - find the actual winner by searching through tickets
						setResult("lost");
						let foundWinnerAddress = null;
						let foundPrize = "0.00";

						// Search for winner by checking tickets with isWinner flag
						for (let i = 0; i < 50; i++) {
							try {
								const ticket = await fetchUserTicket(connection, prevLotteryId, new BN(i));
								if (ticket && ticket.isWinner) {
									foundWinnerAddress = ticket.user.toBase58();
									foundPrize = (ticket.prizeAmount.toNumber() / 1e9).toFixed(2);
									break;
								}
							} catch {
								break; // No more tickets
							}
						}

						if (foundWinnerAddress) {
							setWinnerAddress(foundWinnerAddress);
							setPrize(foundPrize);
						} else {
							// Fallback: calculate prize and show generic message
							const calculatedPrize = ((Number(lotteryState.ticketPrice) * Number(lotteryState.totalParticipants)) / 1e9).toFixed(2);
							setPrize(calculatedPrize);
							setWinnerAddress(null);
						}

						setResultLotteryId(prevLotteryId);
						setStatus("result");
						return;
					}
				}
			}

			// If we get here, either user wasn't in prev lottery or result was already seen
			// Now check current lottery status
			if (enteredCurrentLottery) {
				if (now >= end) {
					setStatus("drawing");
				} else {
					setStatus("countdown");
				}
			} else {
				setStatus("not_entered");
			}
		} catch (err) {
			console.error("Error fetching state:", err);
			setError("Failed to load lottery data");
		}
	}, [connection, publicKey]);

	useEffect(() => {
		initializeLotteryView();
		const interval = setInterval(initializeLotteryView, 30000); // Refresh every 30s
		return () => clearInterval(interval);
	}, [initializeLotteryView]);

	// Notify parent of status changes
	useEffect(() => {
		if (onStatusChange) {
			onStatusChange(status);
		}
	}, [status, onStatusChange]);

	// Countdown Timer
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

	const handleCheckResult = async () => {
		if (!state || !publicKey) return;

		setStatus("checking");
		setError(null);

		try {
			// First, refresh the state to get the latest
			let currentState = await fetchLotteryState(connection);
			if (!currentState) {
				setError("Failed to fetch lottery state");
				setStatus("drawing");
				return;
			}

			// If no winner yet, trigger the draw via backend
			if (currentState.winner.eqn(0)) {
				setError(null);

				// Call backend to trigger the draw
				const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
				const triggerResponse = await fetch(`${apiUrl}/lottery/trigger-draw`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
				});

				const triggerData = await triggerResponse.json();

				if (!triggerResponse.ok && triggerData.code !== "DRAW_IN_PROGRESS" && triggerData.code !== "WINNER_ALREADY_SELECTED") {
					setError(triggerData.error || "Failed to trigger draw");
					setStatus("drawing");
					return;
				}

				// Poll for winner (VRF callback takes a few seconds)
				let winnerFound = false;
				for (let i = 0; i < 30; i++) {
					await new Promise((resolve) => setTimeout(resolve, 2000));
					currentState = await fetchLotteryState(connection);
					if (currentState && !currentState.winner.eqn(0)) {
						winnerFound = true;
						break;
					}
				}

				if (!winnerFound) {
					setError("Draw is taking longer than expected. Please try again in a moment.");
					setStatus("drawing");
					return;
				}
			}

			// Now we have a winner, check if it's the current user
			if (!currentState) {
				setError("Failed to fetch lottery state after draw");
				setStatus("drawing");
				return;
			}

			// After draw, lottery resets. Get the previous lottery ID for result
			let lotteryIdToCheck = currentState.currentLotteryId;
			if (currentState.totalParticipants.eqn(0)) {
				// Lottery was reset, check previous
				lotteryIdToCheck = currentState.currentLotteryId.subn(1);
			}

			const userReceipt = await fetchUserReceipt(connection, publicKey, lotteryIdToCheck);

			if (!userReceipt) {
				setError("Could not find your ticket for this lottery");
				setStatus("drawing");
				return;
			}

			const userTicket = await fetchUserTicket(
				connection,
				lotteryIdToCheck,
				userReceipt.ticketNumber
			);

			if (userTicket) {
				setResultLotteryId(lotteryIdToCheck);
				if (userTicket.isWinner) {
					setResult("won");
					setWinnerAddress(publicKey.toBase58());
					setPrize((userTicket.prizeAmount.toNumber() / 1e9).toFixed(2));
				} else {
					setResult("lost");
					setPrize((userTicket.prizeAmount.toNumber() / 1e9).toFixed(2));
					// Find winner address
					const winnerIndex = currentState.winner.subn(1);
					const winningTicket = await fetchUserTicket(connection, lotteryIdToCheck, winnerIndex);
					if (winningTicket) {
						setWinnerAddress(winningTicket.user.toBase58());
						setPrize((winningTicket.prizeAmount.toNumber() / 1e9).toFixed(2));
					}
				}
				setStatus("result");
			} else {
				setResult("pending");
				setStatus("result");
			}
		} catch (err) {
			console.error(err);
			setError("Failed to check results. Please try again.");
			setStatus("drawing");
		}
	};

	const handleNextLottery = async () => {
		// After viewing result, check if user entered current lottery
		setResult(null);
		setResultLotteryId(null);
		await initializeLotteryView();
	};

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
		<section className="min-h-[600px] flex items-center justify-center relative overflow-hidden">
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

					{/* NOT ENTERED STATE - User hasn't generated horoscope for current lottery */}
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
								<p className="text-slate-300 text-lg mb-2">Current Prize Pool</p>
								<p className="text-4xl font-bold text-white">
									{prizePool} <span className="text-2xl text-slate-400">SOL</span>
								</p>
								<p className="text-slate-500 text-sm mt-2">
									{state.totalParticipants.toString()} cosmic tickets entered
								</p>
							</div>

							<div className="space-y-4">
								<p className="text-slate-400">
									Complete your horoscope reading to get your lottery ticket ✨
								</p>
								{onBack && (
									<button
										onClick={onBack}
										className="w-full group relative py-4 px-10 bg-gradient-to-r from-[#FC5411] to-[#ff7a3d] rounded-xl font-bold text-lg text-white shadow-xl hover:scale-102 transition-all duration-200 hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
										type="button"
									>
										Generate Horoscope 🔮
									</button>
								)}
							</div>

							{/* Footer Info */}
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
							{/* Header */}
							<div>
								<span className="inline-block py-1.5 px-4 rounded-full border border-[#fc5411] bg-black text-[#fc5411] text-sm font-semibold tracking-wide uppercase mb-4">
									Next Cosmic Draw: {istTime} IST
								</span>

								{/* Prize Pool - Prominent */}
								<h2 className="text-5xl md:text-6xl font-bold text-white mb-2">
									{prizePool}{" "}
									<span className="text-3xl text-slate-400">SOL</span>
								</h2>
								<p className="text-slate-400 text-lg">
									{state.totalParticipants.toString()} cosmic tickets entered
								</p>
							</div>

							{/* Timer Display */}
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

							{/* Footer Info */}
							<div className="pt-8 border-t border-white/5">
								<p className="text-xs text-slate-500">
									Lottery #{state.currentLotteryId.toString()}
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
								className="w-full group relative py-4 px-10  border border-[#FC5411] rounded-xl font-bold text-lg text-white shadow-xl hover:scale-102 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
								type="button"
							>
								<span className="relative z-10 flex items-center gap-2 justify-center">
									<>Check If You Won 🏆</>
								</span>
							</button>

							<p className="text-slate-500 text-lg">
								Lottery #{state.currentLotteryId.toString()}
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
					{status === "result" && result && (
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
											{prize} SOL
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
									<p className="text-2xl font-mono text-[#fc5411] mb-4 break-all">
										<a
											href={`https://solscan.io/account/${winnerAddress}`}
											target="_blank"
											rel="noopener noreferrer"
											className="hover:underline hover:text-[#ff7a3d] transition-colors"
										>
											{winnerAddress}
										</a>
									</p>

									<p className="text-2xl font-bold text-white mb-2">
										Prize: {prize} SOL
									</p>
									<p className="text-white text-xl mt-6">
										Your stars will align next time 🌟
									</p>
								</>
							)}

							{result === "pending" && (
								<>
									<div className="text-6xl mb-4">⏳</div>
									<h2 className="text-3xl font-bold text-slate-300 mb-4">
										Results Pending
									</h2>
									<p className="text-slate-400">
										The Oracle hasn't announced the winner yet.
										<br />
										Check back in a moment.
									</p>
								</>
							)}

							{/* Show lottery ID for this result */}
							{resultLotteryId && (
								<p className="text-slate-500 text-sm mt-6">
									Lottery #{resultLotteryId.toString()} Result
								</p>
							)}

							{/* Only show Check Again for pending status */}
							{result === "pending" && (
								<button
									onClick={handleNextLottery}
									className="group relative w-full px-8 py-4 mt-6
border border-[#FC5411]
rounded-2xl transition-all
hover:scale-102
hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
									type="button"
								>
									Check Again
								</button>
							)}
						</motion.div>
					)}
				</AnimatePresence>

				{/* Back Button - Always visible */}
				{onBack && status !== "not_entered" && (
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
