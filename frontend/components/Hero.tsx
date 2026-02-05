"use client";

import { useLogin } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef, useState } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { StarBackground } from "./StarBackground";
import Image from "next/image";
import LoadingSpinner from "./LoadingSpinner";

export const Hero: FC = () => {
	const {
		publicKey,
		connected,
		address,
		disconnect: logout,
		isLoadingWallet,
	} = usePrivyWallet();
	const router = useRouter();
	const { setUser, setWallet } = useStore();
	const [isChecking, setIsChecking] = useState(false);
	const hasCheckedRef = useRef(false);
	const { login } = useLogin({
		onComplete(user) {
			if (user?.user?.twitter?.username && user?.user?.wallet) {
				api.registerUser({
					username: user.user.twitter.name ?? "",
					walletAddress: user.user.wallet.address,
					twitterId: user.user.twitter.subject,
					twitterProfileUrl: user.user.twitter.profilePictureUrl ?? "",
					twitterUsername: user.user.twitter.username,
				});
				router.push("/login");
			}
		},
	});
	const [dropdownOpen, setDropdownOpen] = useState(false);

	useEffect(() => {
		const checkUserStatus = async () => {
			if (!connected || !publicKey) {
				hasCheckedRef.current = false;
				return;
			}

			if (hasCheckedRef.current) return;
			hasCheckedRef.current = true;

			setIsChecking(true);
			try {
				const addr = publicKey;
				setWallet(addr);

				const profileResponse = await api.getUserProfile(addr);

				if (profileResponse?.user) {
					const user = profileResponse.user;
					setUser(user);

					if (user.dob) {
						router.replace("/cards");
					} else {
						router.replace("/login");
					}
				}
			} catch (error) {
				console.error("Error checking user:", error);
				setUser(null);
			} finally {
				setIsChecking(false);
			}
		};

		checkUserStatus();
	}, [connected, publicKey, setUser, setWallet, router]);

	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden py-12">
			{/* Animated background */}
			<StarBackground />

			{/* Main content */}
			<div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl screen-fade-in">
				{/* Brand section */}
				<div className="mb-8 sm:mb-12">
					<div className="mb-6 relative w-48 h-16 sm:w-64 sm:h-24 mx-auto">
						<Image
							src="/logo/hast.png"
							alt="Hastrology Logo"
							fill
							className="object-contain"
							priority
						/>
					</div>
					<p className="text-base sm:text-lg text-white/60 mb-3">
						Your daily horoscope, verified by a trade on Solana
					</p>
					<p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
						Get your personalized reading once a day. Verify it with a real trade.
						See if the stars align.
					</p>
				</div>

				{/* Login section */}
				<div className="flex flex-col items-center gap-4 sm:gap-5">
					{isChecking ? (
						<button
							disabled
							type="button"
							className="btn-white opacity-80 cursor-not-allowed flex items-center justify-center gap-3"
						>
							<LoadingSpinner size={24} />
							Locating Your Stars...
						</button>
					) : address ? (
						<div className="relative w-full sm:w-auto">
							<button
								onClick={() => setDropdownOpen((v) => !v)}
								type="button"
								className="btn-white w-full sm:w-auto"
							>
								{`${address.slice(0, 6)}...${address.slice(-4)}`}
							</button>

							{dropdownOpen && (
								<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-full sm:min-w-[200px] bg-[#0a0a0f] border border-white/10 rounded-xl shadow-lg z-50 overflow-hidden">
									<div className="px-4 py-3 border-b border-white/10">
										<span className="text-sm font-mono text-white/70">
											{`${address.slice(0, 10)}...${address.slice(-6)}`}
										</span>
									</div>
									<button
										className="w-full text-left px-4 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
										onClick={() => {
											logout();
											setDropdownOpen(false);
										}}
										type="button"
									>
										Disconnect
									</button>
								</div>
							)}
						</div>
					) : (
						<button
							onClick={() => {
								if (!isLoadingWallet) {
									login();
								}
							}}
							disabled={isLoadingWallet}
							type="button"
							className="btn-white w-auto flex-col gap-0.5 py-3 px-8 h-auto"
						>
							<div className="flex items-center gap-3">
								<svg
									viewBox="0 0 24 24"
									aria-hidden="true"
									className="w-5 h-5 fill-current"
								>
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
								</svg>
								<span>Continue with X</span>
							</div>
							<div className="flex items-center gap-1 mt-0.5">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									className="w-3 h-3 text-green-600"
								>
									<path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v5a.75.75 0 0 1-1.5 0v-5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 10 2Zm0 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
									<path d="M10 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
									{/* Simple Shield Check Icon */}
									<path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1Zm3 8V5.5a3 3 0 10-6 0V9h6Z" clipRule="evenodd" />
								</svg>
								<span className="text-[10px] text-gray-500 font-medium">Protected by Privy</span>
							</div>
						</button>
					)}


					<p className="text-xs sm:text-sm text-white/40">
						One horoscope per day. Make it count.
					</p>
				</div>
			</div>

			{/* Footer */}
			<div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex flex-col items-center gap-2 text-xs sm:text-sm text-white/30 z-10">
				<div className="flex items-center gap-2">
					<span>Powered by</span>
					<div className="solana-badge">
						<svg viewBox="0 0 397.7 311.7" className="w-4 h-4">
							<path
								d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
								fill="#00FFA3"
							/>
							<path
								d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
								fill="#00FFA3"
							/>
							<path
								d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
								fill="#00FFA3"
							/>
						</svg>
						<span className="text-xs text-white/50">Solana</span>
					</div>
				</div>
			</div>
		</section>
	);
};
