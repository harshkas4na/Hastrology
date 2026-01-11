"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { FC, useEffect, useState } from "react";
import {
	fetchLotteryState,
	fetchUserTicket,
	LotteryState,
} from "@/lib/hastrology_program";

interface LotteryCountdownProps {
	onBack?: () => void;
}

export const LotteryCountdown: FC<LotteryCountdownProps> = ({ onBack }) => {
	const { connection } = useConnection();
	const { publicKey } = useWallet();

	const [state, setState] = useState<LotteryState | null>(null);
	const [timeLeft, setTimeLeft] = useState<{
		h: number;
		m: number;
		s: number;
	} | null>(null);
	const [status, setStatus] = useState<
		"loading" | "countdown" | "drawing" | "checking" | "result"
	>("loading");
	const [result, setResult] = useState<"won" | "lost" | "pending" | null>(null);
	const [winnerAddress, setWinnerAddress] = useState<string | null>(null);
	const [prize, setPrize] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Calculate prize pool
	const prizePool = state
		? (
			(Number(state.ticketPrice) * Number(state.totalParticipants)) /
			1e9
		).toFixed(2)
		: "0.00";

	useEffect(() => {
		const checkState = async () => {
			try {
				const lotteryState = await fetchLotteryState(connection);
				if (lotteryState) {
					setState(lotteryState);

					const now = Math.floor(Date.now() / 1000);
					const end = lotteryState.lotteryEndtime.toNumber();

					if (now >= end) {
						setStatus("drawing");
					} else {
						setStatus("countdown");
					}
				}
			} catch (err) {
				console.error("Error fetching state:", err);
				setError("Failed to load lottery data");
			}
		};

		checkState();
		const interval = setInterval(checkState, 10000);
		return () => clearInterval(interval);
	}, [connection]);

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
			if (state.winner.eqn(0)) {
				setError("Draw hasn't happened yet. Please wait for the Oracle.");
				setStatus("drawing");
				return;
			}

			let idToCheck = state.currentLotteryId;
			console.log("idToCheck", idToCheck);
			if (state.totalParticipants.eqn(0)) {
				idToCheck = state.currentLotteryId.subn(1);
			}

			const pdaWinnerIndex = state.winner.subn(1);
			const winningTicket = await fetchUserTicket(
				connection,
				idToCheck,
				pdaWinnerIndex,
			);
			console.log("winningTicket", winningTicket);

			if (winningTicket) {
				setWinnerAddress(winningTicket.user.toBase58());
				setPrize((winningTicket.prizeAmount.toNumber() / 1e9).toFixed(2));
				console.log("winningTicket.user", winningTicket.user);
				console.log("publicKey", publicKey);
				if (winningTicket.user.equals(publicKey)) {
					setResult("won");
				} else {
					setResult("lost");
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
									Next Cosmic Draw
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
										Your Prize: {prize} SOL
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

							<button
								onClick={() => {
									setResult(null);
									setStatus("drawing");
								}}
								className="group relative w-full px-8 py-4
border border-[#FC5411]
rounded-2xl transition-all
hover:scale-102
hover:shadow-[0_0_30px_rgba(252,84,17,0.3)]"
								type="button"
							>
								Check Again
							</button>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Back Button - Always visible */}
				{onBack && (
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
