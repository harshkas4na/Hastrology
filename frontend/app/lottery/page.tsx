"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { type FC, useCallback, useEffect, useState } from "react";
import { AstroCard } from "@/components/AstroCard";
import { LotteryCountdown } from "@/components/LotteryCountdown";
import { UserXDetails } from "@/components/TwitterDetails";
import { api } from "@/lib/api";
import { useOnboardingStatus } from "@/lib/useOnboardingStatus";
import { useStore } from "@/store/useStore";

const LotteryPage: FC = () => {
	const { user, card, setCard, setUser, setWallet, reset } = useStore();
	const { publicKey, connected, disconnect } = useWallet();
	const [isPaid, setIsPaid] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isCheckingAccess, setIsCheckingAccess] = useState(true);
	const router = useRouter();
	const onboarding = useOnboardingStatus();

	// Route guard: Check if user can access this page
	useEffect(() => {
		// Wait for user data to load if wallet is connected
		if (connected && !user && onboarding.isLoading) {
			return; // Still loading
		}

		// If user data is loaded or no wallet, check access
		if (!onboarding.canAccess("lottery")) {
			const redirectUrl = onboarding.getRedirectUrl();
			if (redirectUrl) {
				router.push(redirectUrl);
				return;
			}
		}

		setIsCheckingAccess(false);
	}, [connected, user, onboarding, router]);

	const checkUserProfile = useCallback(async () => {
		if (!connected || !publicKey) {
			setIsLoading(false);
			return;
		}

		setWallet(publicKey.toBase58());

		try {
			const profileResponse = await api.getUserProfile(publicKey.toBase58());
			if (profileResponse?.user) {
				setUser(profileResponse.user);
			} else {
				setUser(null);
			}
		} catch (error) {
			console.error("Error checking user profile:", error);
			setUser(null);
		}
	}, [connected, publicKey, setUser, setWallet]);

	// Check card status
	const checkStatus = useCallback(async () => {
		if (!publicKey) {
			setIsLoading(false);
			return;
		}

		try {
			const result = await api.getStatus(publicKey.toBase58());
			console.log(result);
			if (result.status === "exists" && result.card) {
				setCard(result.card);
			} else if (result.status === "paid") {
				setIsPaid(true);
			} else {
				setIsPaid(false);
			}
		} catch (err) {
			console.error("Failed to check status:", err);
		} finally {
			setIsLoading(false);
		}
	}, [publicKey, setCard]);

	console.log(card);

	useEffect(() => {
		if (!user && publicKey && connected) {
			checkUserProfile();
		}
	}, [user, publicKey, connected, checkUserProfile]);

	useEffect(() => {
		if (publicKey) {
			checkStatus();
		}
	}, [publicKey, checkStatus]);

	const [lotteryStatus, setLotteryStatus] = useState("loading");

	// Determine if we should show full screen (when showing results)
	const isResultMode = lotteryStatus === "result";

	const handleDisconnect = async () => {
		try {
			await disconnect();
			reset();
			router.push("/");
		} catch (error) {
			console.error("Error disconnecting:", error);
		}
	};

	if (isLoading || isCheckingAccess || onboarding.isLoading) {
		return (
			<section className="relative min-h-screen flex items-center justify-center overflow-y-auto">
				<div className="absolute inset-0 z-0 flex flex-col">
					<div className="relative h-1/2 w-full">
						<img
							alt="Upper Background"
							className="w-full h-full object-cover"
							src="/bg-home-upper.png"
						/>
					</div>
					<div className="relative h-1/2 w-full">
						<img
							alt="Lower Background"
							className="w-full h-full object-cover"
							src="/bg-home-lower.png"
						/>
					</div>
				</div>

				<div className="relative z-10 flex flex-col items-center gap-4">
					<motion.div
						animate={{ rotate: 360 }}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "linear",
						}}
						className="w-16 h-16 border-4 border-[#fc5411] border-t-black rounded-full"
					/>
					<p className="text-slate-400 text-lg">Loading your cosmic data...</p>
				</div>
			</section>
		);
	}

	return (
		<section className="relative min-h-screen overflow-y-auto pb-40 md:pb-40">
			{user?.twitterId && <UserXDetails />}
			<div className="fixed inset-0 z-0">
				<div className="relative h-1/2 w-full">
					<img
						alt="Upper Background"
						className="w-full h-full object-cover"
						src="/bg-home-upper.png"
					/>
				</div>
				<div className="relative h-1/2 w-full">
					<img
						alt="Lower Background"
						className="w-full h-full object-cover"
						src="/bg-home-lower.png"
					/>
				</div>
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-transparent" />
			</div>

			<div className="hidden md:block absolute top-6 right-6 z-100">
				<button
					onClick={handleDisconnect}
					className="flex flex-row gap-2 items-center
						bg-[#1F1F1F]
						border border-[#FC5411]
						text-white
						px-4
						py-2
						rounded-xl
						font-medium
						hover:bg-[#262626]
						hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
						transition
					"
					type="button"
				>
					<img
						alt="Solana Logo"
						className="w-4 h-5"
						src="https://solana.com/src/img/branding/solanaLogoMark.svg"
					/>
					{publicKey?.toBase58().slice(0, 4)}...
					{publicKey?.toBase58().slice(-4)}
				</button>
			</div>

			<div className="relative z-10 w-full max-w-8xl mx-auto px-4 pt-16 md:pt-24 lg:pt-15">
				<div className={`grid grid-cols-1 ${!isResultMode ? "lg:grid-cols-2" : ""} gap-8 lg:gap-1 items-start`}>
					<motion.div
						initial={{ opacity: 0, x: -50 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.6 }}
						className={`w-full pt-8 md:pt-16 lg:pt-30 px-4 md:px-8 ${!isResultMode ? "lg:pl-20" : "flex justify-center"}`}
					>
						<div className={isResultMode ? "w-full max-w-4xl" : "w-full"}>
							<LotteryCountdown onStatusChange={setLotteryStatus} />
						</div>
					</motion.div>

					{/* Right: Astro Card - Only show when not in result mode */}
					{!isResultMode && card && (
						<motion.div
							key="card-display"
							initial={{ opacity: 0, x: 50 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.6, delay: 0.2 }}
							className="w-full max-w-xl flex justify-center lg:justify-end"
						>
							<div className="w-full max-w-md">
								<AstroCard card={card} showShare={false} />
							</div>
						</motion.div>
					)}

					{!isResultMode && !card && (
						<motion.div
							key="card-placeholder"
							initial={{ opacity: 0, x: 50 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.6, delay: 0.2 }}
							className="hidden lg:flex w-full max-w-md justify-center lg:justify-end"
						>
							<div className="w-full max-w-md aspect-[3/4] rounded-3xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-8">
								<div className="text-6xl opacity-30">🌌</div>
								<p className="text-slate-400 text-center">
									Your cosmic card will appear here
								</p>
								<p className="text-slate-600 text-sm text-center">
									Complete your reading to see your personalized astrology card
								</p>
							</div>
						</motion.div>
					)}
				</div>
			</div>

			{/* Bottom Gradient */}
			<div className="fixed bottom-0 left-0 w-full h-32 bg-linear-to-t from-black to-transparent pointer-events-none z-20" />

			{/* Footer */}
			<div className="block absolute bottom-4 md:bottom-11 left-0 w-full z-30 px-6">
				<div className="w-full flex md:hidden mt-0 mb-5 flex-col items-center gap-4">
					<button
						onClick={() => {
							if (!publicKey) return;
							disconnect();
						}}
						className="flex flex-row gap-2 items-center
      bg-[#1F1F1F]
      border border-[#FC5411]
      text-white
      px-4
      py-2
      rounded-xl
      font-medium
      hover:bg-[#262626]
      hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
      transition
    "
						type="button"
					>
						<img
							alt="Solana Logo"
							className="w-4 h-5"
							src="https://solana.com/src/img/branding/solanaLogoMark.svg"
						/>
						{publicKey?.toBase58().slice(0, 4)}...
						{publicKey?.toBase58().slice(-4)}
					</button>
				</div>

				<div className="font-display max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0 text-xs md:text-md text-[#8A8A8A]">
					<span className="font-display">
						©2025 <span className="text-white">Hastrology</span>
					</span>
					<div className="flex flex-wrap justify-center gap-3 md:gap-6">
						<span className="text-white hidden sm:inline">
							Your cosmic journey on Solana.
						</span>
						<a className="hover:text-white transition" href="/abc">
							About us
						</a>
						<a className="hover:text-white transition" href="/abc">
							Cookie Policy
						</a>
					</div>
				</div>
			</div>
		</section>
	);
};

export default LotteryPage;
