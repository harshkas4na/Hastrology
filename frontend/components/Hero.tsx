"use client";
import { useLogin } from "@privy-io/react-auth";
import { useFundWallet } from "@privy-io/react-auth/solana";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef, useState } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";

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
	const [open, setOpen] = useState(false);

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
				const address = publicKey;
				setWallet(address);

				const profileResponse = await api.getUserProfile(address);

				if (profileResponse?.user) {
					setUser(profileResponse.user);
				}
			} catch (error) {
				console.error("Error checking user:", error);
				setUser(null);

				router.push("/login");
			} finally {
				setIsChecking(false);
			}
		};

		checkUserStatus();
	}, [connected, publicKey, setUser, setWallet, router]);

	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
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
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-transparent" />
			</div>
			<img
				alt="Orange Planet"
				className="hidden md:block absolute left-0 top-0 h-full w-auto object-contain object-left z-0"
				src="/ellipse-left.png"
			/>
			<img
				alt="Black Planet"
				className="hidden md:block absolute left-0 top-0 h-full w-auto object-contain object-left z-10"
				src="/ellipse-black.png"
			/>
			{/* CONTENT */}
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="relative z-10 text-center px-6 max-w-4xl"
				initial={{ opacity: 0, y: 30 }}
				transition={{ duration: 0.9, ease: "easeOut" }}
			>
				{/* TITLE */}
				<motion.img
					alt="Hastrology Logo"
					animate={{ scale: 1, opacity: 1 }}
					className="-mt-4 md:-mt-25
            w-85 md:w-120 lg:w-166
            mx-auto
            drop-shadow-[0_0_20px_rgba(251,146,60,0.35)]
          "
					initial={{ scale: 0.9, opacity: 0 }}
					src="/Hastrology.svg"
					transition={{ delay: 0.2, duration: 0.8 }}
				/>

				{/* SUBTEXT */}
				<motion.p
					animate={{ opacity: 1 }}
					className="mt-6 text-lg md:text-2xl text-[#CCCCCC] leading-relaxed"
					initial={{ opacity: 0 }}
					transition={{ delay: 0.4, duration: 0.8 }}
				>
					Unlock the secrets of the stars with AI-powered insights on Solana.
					<br />
					<span className="text-[#CCCCCC] mt-0">
						Your destiny is written in the code of the cosmos. ✨
					</span>
				</motion.p>

				<div className="hidden md:inline-block relative ">
					<button
						className="mt-5 !bg-[#1f1f1f] hover:!bg-[#121212] !text-white !h-12 !px-8 !py-6 !border !border-[#fc5411] !pt-2.5 !rounded-xl !transition-all"
						disabled={isLoadingWallet}
						onClick={() => {
							if (!address && !isLoadingWallet) {
								login();
							} else {
								setOpen((v) => !v);
							}
						}}
						type="button"
					>
						{isLoadingWallet
							? "Loading..."
							: address
								? `${address.slice(0, 6)}...${address.slice(-4)}`
								: "Connect Wallet"}
					</button>

					{open && address && (
						<div
							className="absolute right-0 mt-2 min-w-[200px]
      bg-[#06141a] border border-[#194758] text-white shadow-lg z-50"
						>
							{/* Address */}
							<div className="px-3 py-2 border-b border-[#194758]">
								<div className="flex items-center gap-2">
									<span className="text-sm font-mono flex-1 truncate">
										{`${address.slice(0, 10)}...${address.slice(-6)}`}
									</span>
								</div>
							</div>

							{/* Logout */}
							<button
								className="w-full text-left px-3 py-2 text-sm
        hover:bg-[#2596be] hover:text-black transition-colors"
								onClick={() => {
									logout();
									setOpen(false);
								}}
								type="button"
							>
								Logout
							</button>
						</div>
					)}
				</div>
			</motion.div>
			<div className="absolute bottom-0 left-0 w-full h-32 bg-linear-to-t from-black to-transparent" />
			<img
				alt="Orange Planet"
				className="hidden md:block absolute right-0 top-0 h-full w-auto object-contain object-left z-0"
				src="/ellipse-right.png"
			/>
			<img
				alt="Black Planet"
				className="hidden md:block absolute right-0 top-0 h-full w-auto object-contain object-left z-10"
				src="/ellipse-black-right.png"
			/>
			{/* Small bottom ellipses (card-style accent) */}
			<div className="md:hidden pointer-events-none absolute bottom-0 left-0 w-full flex justify-center z-20">
				<div className="relative w-full max-w-md h-40">
					{/* Orange ellipse */}
					<img
						src="/small-ellipse.png"
						alt="Orange Ellipse"
						className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full object-contain blur-sm"
					/>

					{/* Black ellipse (softer) */}
					<img
						src="/small-black-ellipse.png"
						alt="Black Ellipse"
						className="absolute bottom-7 left-1/2 -translate-x-1/2 w-full object-contain"
					/>
				</div>
			</div>

			<div className="absolute bottom-4 md:bottom-11 left-0 w-full z-30 px-4 md:px-6">
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className="w-full flex md:hidden mt-10 mb-10 flex-col items-center gap-4"
					initial={{ opacity: 0, y: 20 }}
					transition={{ delay: 0.7, duration: 0.8 }}
				>
					{isChecking ? (
						<button
							disabled
							type="button"
							className="bg-[#1f1f1f] text-white h-12 px-8 py-6 border border-[#fc5411] pt-2.5 rounded-xl opacity-50 cursor-not-allowed"
						>
							Locating Your Stars...
						</button>
					) : (
						<button
							onClick={() => {
								if (!address && !isLoadingWallet) {
									login();
								} else {
									setOpen((v) => !v);
								}
							}}
							type="button"
							className="!bg-[#1f1f1f]  hover:!bg-[#121212] !text-white !h-12 !px-8 !py-6 !border !border-[#fc5411] !pt-2.5 !rounded-xl !transition-all"
						>
							Connect Wallet
						</button>
					)}
				</motion.div>
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
