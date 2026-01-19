"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { AstroCard } from "@/components/AstroCard";
import { WalletBalance } from "@/components/balance";
import { LotteryCountdown } from "@/components/LotteryCountdown";
import { UserXDetails } from "@/components/TwitterDetails";
import { Toast } from "@/components/toast";
import { api } from "@/lib/api";
import { useOnboardingStatus } from "@/lib/useOnboardingStatus";
import { useStore } from "@/store/useStore";
import { usePrivyWallet } from "../hooks/use-privy-wallet";

const LotteryPage: FC = () => {
	const { user, card, setCard, setUser, setWallet, reset } = useStore();
	const { publicKey, connected, disconnect } = usePrivyWallet();
	const [isPaid, setIsPaid] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isCheckingAccess, setIsCheckingAccess] = useState(true);
	const router = useRouter();
	const onboarding = useOnboardingStatus();
	const [showDropdown, setShowDropdown] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// Route guard: Check if user can access this page
	/*useEffect(() => {
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
	}, [connected, user, onboarding, router]);*/

	const checkUserProfile = useCallback(async () => {
		if (!connected || !publicKey) {
			setIsLoading(false);
			return;
		}

		setWallet(publicKey);

		try {
			const profileResponse = await api.getUserProfile(publicKey);
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

	const checkStatus = useCallback(async () => {
		if (!publicKey) {
			setIsLoading(false);
			return;
		}

		try {
			const result = await api.getStatus(publicKey);
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
			setShowDropdown(false);
			router.push("/");
		} catch (error) {
			console.error("Error disconnecting:", error);
		}
	};

	const copyAddress = async () => {
		if (!publicKey) return;

		try {
			await navigator.clipboard.writeText(publicKey);
			setToastMessage("Address copied to clipboard!");
			setShowDropdown(false);
		} catch (error) {
			console.error("Failed to copy address:", error);
		}
	};

	const formatAddress = (address: string) => {
		if (!address) return "";
		return `${address.slice(0, 4)}...${address.slice(-4)}`;
	};

	if (isLoading) {
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
		<>
			<section className="relative min-h-screen overflow-y-auto pb-40 md:pb-40">
				<div className="relative z-50 flex md:hidden items-center justify-between px-4 pt-4 gap-3">
					{user?.twitterId && <UserXDetails />}
					{publicKey && <WalletBalance />}
				</div>

				{/* Desktop layout (keep absolute positioning) */}
				<div className="hidden md:block">
					{user?.twitterId && <UserXDetails />}
					{publicKey && <WalletBalance />}
				</div>

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

				<div
					className="hidden md:block absolute top-6 right-6 z-50"
					ref={dropdownRef}
				>
					<div className="cursor-pointer relative">
						<button
							onClick={() => setShowDropdown(!showDropdown)}
							className="flex flex-row gap-2 items-center
							bg-[#1F1F1F]
							border border-[#FC5411]
							text-white
							px-4
							py-2
							rounded-xl
							text-sm md:text-base
							font-medium
							hover:bg-[#262626]
							hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
							transition-all duration-200
							min-w-[140px]
							justify-center
						"
							type="button"
						>
							<img
								alt="Solana Logo"
								className="w-4 h-5"
								src="https://solana.com/src/img/branding/solanaLogoMark.svg"
							/>
							<span>{formatAddress(publicKey || "")}</span>
							<svg
								className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>svg</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>

						{/* Dropdown Menu */}
						{showDropdown && (
							<div className="absolute top-full right-0 mt-2 w-full min-w-[160px] bg-[#1F1F1F] border border-[#FC5411] rounded-xl shadow-lg overflow-hidden z-50">
								<div className="py-1">
									{/* Copy Address */}
									<button
										onClick={copyAddress}
										className="w-full px-4 py-3 text-left text-white hover:bg-[#262626] transition-colors duration-150 flex items-center gap-2"
										type="button"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>svg</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
										<span>Copy Address</span>
									</button>

									{/* View on Explorer */}
									<a
										href={`https://orbmarkets.io/address/${publicKey}?cluster=devnet&hideSpam=true`}
										target="_blank"
										rel="noopener noreferrer"
										className="w-full px-4 py-3 text-left text-white hover:bg-[#262626] transition-colors duration-150 flex items-center gap-2"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>svg</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/>
										</svg>
										<span>View on Explorer</span>
									</a>

									{/* Divider */}
									<div className="border-t border-[#FC5411]/30 my-1"></div>

									{/* Logout */}
									<button
										onClick={handleDisconnect}
										className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors duration-150 flex items-center gap-2"
										type="button"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>svg</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
											/>
										</svg>
										<span>Disconnect</span>
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="relative z-10 w-full max-w-8xl mx-auto px-4 pt-16 md:pt-24 lg:pt-15">
					<div
						className={`grid grid-cols-1 ${!isResultMode && card ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-8 lg:gap-1 items-start`}
					>
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
								className="hidden w-full max-w-xl justify-center lg:justify-end"
							>
								<div className="mt-25 w-full max-w-md aspect-[3/4] rounded-3xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-4 p-8">
									<div className="text-6xl opacity-30">🌌</div>
									<p className="text-slate-400 text-center">
										Your cosmic card will appear here
									</p>
									<p className="text-slate-600 text-sm text-center">
										Complete your reading to see your personalized astrology
										card
									</p>
								</div>
							</motion.div>
						)}
					</div>
				</div>

				{/* Bottom Gradient */}
				<div className="fixed bottom-0 left-0 w-full h-32 bg-linear-to-t from-black to-transparent pointer-events-none z-20" />
				<div className="block absolute bottom-4 md:bottom-11 left-0 w-full z-30 px-6">
					<div className="w-full flex md:hidden mt-0 mb-5 flex-col items-center gap-4">
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
							{publicKey?.slice(0, 4)}...
							{publicKey?.slice(-4)}
						</button>
					</div>

					<div className="font-display max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0 text-xs md:text-md text-[#8A8A8A]">
						<span className="font-display">
							©2025 <span className="text-white">Hashtro</span>
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
			<Toast
				message={toastMessage}
				type={"info"}
				duration={4000}
				onClose={() => setToastMessage(null)}
			/>
		</>
	);
};

export default LotteryPage;
