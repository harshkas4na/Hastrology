"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FC, Suspense, useEffect, useRef, useState } from "react";
import { TwitterSignInButton } from "@/components/TwitterButton";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { usePrivyWallet } from "../hooks/use-privy-wallet";
import LoadingSpinner from "@/components/LoadingSpinner";

const XLoginContent: FC = () => {
	const { publicKey, connected, disconnect } = usePrivyWallet();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { setWallet, setUser, reset, user } = useStore();
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const hasCheckedProfileRef = useRef(false);
	const wasConnected = useRef(false);
	const isHandlingCallbackRef = useRef(false);

	useEffect(() => {
		if (wasConnected.current && !publicKey) {
			router.push("/");
		}
		wasConnected.current = !!publicKey;
	}, [publicKey, router]);

	useEffect(() => {
		const handleTwitterCallback = async () => {
			const errorParam = searchParams.get("error");
			const successParam = searchParams.get("twitter_success");

			if (errorParam) {
				const details = searchParams.get("details");
				let decodedDetails = details ? decodeURIComponent(details) : null;

				// Map technical errors to user-friendly messages
				if (decodedDetails) {
					if (decodedDetails.includes("already linked")) {
						setError(
							"Reason: This X account is already connected to another wallet. \nAction: Please use a different X account or connect with the original wallet.",
						);
						return;
					}
					if (
						decodedDetails.includes("User id") &&
						decodedDetails.includes("required")
					) {
						setError(
							"Reason: Session session lost during authentication. \nAction: Please disconnect your wallet and reconnect, then try again.",
						);
						return;
					}
				}

				switch (errorParam) {
					case "twitter_auth_failed":
						setError(
							"Reason: X authentication failed. \nAction: Please try again or check your X account status.",
						);
						break;
					case "invalid_callback":
						setError(
							"Reason: Invalid response from X. \nAction: Please restart the process.",
						);
						break;
					case "auth_processing_failed":
						setError(
							decodedDetails
								? `Reason: ${decodedDetails} \nAction: Please try again.`
								: "Reason: Unable to process X account data. \nAction: Please try again later.",
						);
						break;
					case "account_exisits":
						setError(
							"Reason: This X account is already linked. \nAction: Please use a different account.",
						);
						break;
					default:
						setError(
							"Reason: An unexpected error occurred. \nAction: Please try again.",
						);
				}
			}

			if (successParam === "true" && publicKey) {
				isHandlingCallbackRef.current = true;
				setSuccess("X account successfully connected!");

				try {
					const profileResponse = await api.getUserProfile(publicKey);

					if (profileResponse?.user) {
						setUser(profileResponse.user);
						const hasBirthDetails = !!(
							profileResponse.user.dob &&
							profileResponse.user.birthTime &&
							profileResponse.user.birthPlace
						);

						const timer = setTimeout(() => {
							if (hasBirthDetails) {
								router.push("/cards");
							} else {
								router.push("/login");
							}
						}, 2000);

						return () => clearTimeout(timer);
					} else {
						setTimeout(() => {
							router.push("/login");
						}, 2000);
					}
				} catch (err) {
					console.error("Error fetching user profile:", err);
					setError("Error loading profile. Redirecting to login...");

					setTimeout(() => {
						router.push("/login");
					}, 2000);
				}
			}
		};

		handleTwitterCallback();
	}, [searchParams, router, publicKey, setUser]);

	useEffect(() => {
		const checkExistingUser = async () => {
			if (isHandlingCallbackRef.current) {
				return;
			}
			if (!connected || !publicKey) {
				reset();
				hasCheckedProfileRef.current = false;
				setError(null);

				return;
			}

			if (hasCheckedProfileRef.current) return;
			hasCheckedProfileRef.current = true;

			const address = publicKey;
			setWallet(address);
			setError(null);

			try {
				const profileResponse = await api.getUserProfile(address);

				if (profileResponse?.user) {
					setUser(profileResponse.user);

					if (profileResponse.user.twitterId) {
						router.push("/cards");
					}
				} else {
					setError("Please complete registration first");
				}
			} catch (err) {
				console.error("Error checking user profile:", err);
				setError("Error checking profile. Please try again.");
			}
		};

		checkExistingUser();
	}, [connected, publicKey, reset, setUser, setWallet, router]);

	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
			<div className="flex absolute inset-y-0 right-0 w-full md:w-1/2 z-0 flex-col">
				<div className="relative h-full w-full">
					<img
						alt="Upper Background"
						className="w-full h-full object-cover"
						src="/bg-home-upper.png"
					/>
				</div>
				<div className="relative h-full w-full">
					<img
						alt="Lower Background"
						className="w-full h-full object-cover"
						src="/bg-home-lower.png"
					/>
				</div>
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-transparent" />
			</div>

			<div className="md:hidden pointer-events-none absolute top-0 left-0 w-full flex flex-col justify-center z-20">
				<div className="relative w-full max-w-md h-48 overflow-hidden">
					{/* Orange ellipse (foreground, inverted) */}
					<img
						src="/inverted-ellipse.png"
						alt="Orange Ellipse"
						className="absolute -top-2 left-1/2 -translate-x-1/2 w-full
                 object-contain blur-sm drop-shadow-[0_0_40px_rgba(252,84,17,0.35)]"
					/>
					<img
						src="/inverted-black-ellipse.png"
						alt="Black Ellipse"
						className="absolute top-0 left-1/2 -translate-x-1/2 w-full
             object-contain"
					/>
				</div>
				<Link href="/" className="inline-block">
					<motion.img
						alt="Hastrology Logo"
						animate={{ scale: 1, opacity: 1 }}
						className="-mt-0 md:-mt-5
              w-72 md:w-96 lg:w-120
              mx-auto
              drop-shadow-[0_0_20px_rgba(251,146,60,0.35)]
            "
						initial={{ scale: 0.9, opacity: 0 }}
						src="/logo/hast.png"
						transition={{ delay: 0.2, duration: 0.8 }}
					/>
				</Link>
			</div>

			<img
				alt="Orange Planet"
				className="hidden lg:block absolute left-[40%] top-0 h-full w-auto object-contain object-left z-0"
				src="/ellipse-left.png"
			/>
			<img
				alt="Black Planet"
				className="hidden lg:block absolute left-[40%] top-0 h-full w-auto object-contain object-left z-10"
				src="/ellipse-black.png"
			/>

			{/* LEFT BLACK PANEL — X LOGIN FORM */}
			<div className="relative lg:absolute inset-y-0 left-0 w-full lg:w-1/2 z-20 flex items-center lg:items-start justify-center pt-8 lg:pt-35 px-4">
				<div className="mt-0 lg:mt-10 w-full max-w-2xl px-4 lg:px-10">
					<div className="flex items-center justify-center md:justify-between mb-2">
						<h1 className="md:text-left text-center text-3xl lg:text-5xl font-semibold text-white">
							Connect Your X Account
						</h1>
					</div>
					<p className="text-gray-400 md:text-left text-center mb-8 lg:mb-16 mt-2 text-lg lg:text-2xl">
						Link your X account for personalized cosmic insights ✨
					</p>

					{/* Error Message */}
					{error && !success && (
						<div className="mb-6 p-4 rounded-lg border border-red-700 bg-red-900/20 backdrop-blur-sm">
							{error.split("\n").map((line, i) => (
								<p
									key={i}
									className={`text-white text-center ${i > 0 ? "mt-2 text-sm text-red-200" : "font-medium"}`}
								>
									{line}
								</p>
							))}
						</div>
					)}

					{/* X Sign In Button - Only shown when wallet is connected */}
					{connected && user && !success && (
						<div className="space-y-6 mt-12 lg:mt-26 mr-0 lg:mr-10">
							<div className="text-center">
								<p className="hidden md:block text-gray-300 text-md mb-4">
									Welcome back, {user.username}! Connect your X account to
									continue.
								</p>

								<TwitterSignInButton
									onError={(err) => setError(err)}
									userId={user.id}
								/>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* RIGHT CONTENT - Hidden on mobile */}
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="
          hidden lg:block
          relative z-10
          text-center
          px-6
          max-w-4xl
          ml-auto
          mr-15
        "
				initial={{ opacity: 0, y: 30 }}
				transition={{ duration: 0.9, ease: "easeOut" }}
			>
				<Link href="/" className="inline-block">
					<motion.img
						alt="Hastrology Logo"
						animate={{ scale: 1, opacity: 1 }}
						className="-mt-4 md:-mt-25
              w-96 md:w-72 lg:w-120
              mx-auto
              drop-shadow-[0_0_20px_rgba(251,146,60,0.35)]
            "
						initial={{ scale: 0.9, opacity: 0 }}
						src="/Hastrology.svg"
						transition={{ delay: 0.2, duration: 0.8 }}
					/>
				</Link>

				<motion.p
					animate={{ opacity: 1 }}
					className="mt-6 text-lg md:text-xl text-[#CCCCCC] leading-relaxed"
					initial={{ opacity: 0 }}
					transition={{ delay: 0.4, duration: 0.8 }}
				>
					Connect your X account to unlock personalized astrological insights.
					<br />
					<span className="text-[#CCCCCC] mt-0">
						Your cosmic journey awaits on Solana. ✨
					</span>
				</motion.p>
			</motion.div>

			<div className="block absolute bottom-4 md:bottom-11 left-0 w-full z-30 px-6">
				<div className="w-full hidden mt-0 mb-5 flex-col items-center gap-4">
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
	);
};

const XLoginPage: FC = () => {
	return (
		<Suspense fallback={<LoadingSpinner fullScreen />}>
			<XLoginContent />
		</Suspense>
	);
};

export default XLoginPage;
