"use client";

import { useExportWallet, useFundWallet } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef, useState } from "react";
import { WalletBalance } from "@/components/balance";
import { HoroscopeSection } from "@/components/HoroscopeSection";
import { UserXDetails } from "@/components/TwitterDetails";
import { Toast } from "@/components/toast";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { usePrivyWallet } from "../hooks/use-privy-wallet";

const CardsPage: FC = () => {
	const { publicKey, disconnect, connected } = usePrivyWallet();
	const { fundWallet } = useFundWallet();
	const { user } = useStore();
	const { exportWallet } = useExportWallet();
	const { setWallet, setUser, reset } = useStore();
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	const router = useRouter();
	const wasConnected = useRef(false);
	const [showDropdown, setShowDropdown] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const checkUserProfile = async () => {
			if (connected && publicKey) {
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
			} else {
				reset();
			}
		};

		checkUserProfile();
	}, [connected, publicKey, reset, setUser, setWallet]);

	useEffect(() => {
		if (wasConnected.current && !publicKey) {
			router.push("/");
		}
		wasConnected.current = !!publicKey;
	}, [publicKey, router]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

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

	return (
		<>
			<section className="relative min-h-screen flex flex-col bg-black pb-8 md:pb-24">
				{/* Mobile top row */}
				<div className="relative z-50 flex md:hidden items-center justify-between px-4 pt-4 gap-3">
					{user?.twitterId && <UserXDetails />}
					{publicKey && <WalletBalance />}
				</div>

				{/* Desktop layout (keep absolute positioning) */}
				<div className="hidden md:block">
					{user?.twitterId && <UserXDetails />}
					{publicKey && <WalletBalance />}
				</div>

				{/* Desktop dropdown - top right */}
				<div
					className="cursor-pointer hidden md:block absolute top-6 right-6 z-50"
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
							hover:scale-105 
							text-sm md:text-base
							font-medium
							hover:bg-[#262626]
							hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
							transition-all duration-200
							min-w-[140px]
							cursor-pointer
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

						{/* Desktop Dropdown Menu */}
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

									<button
										onClick={() =>
											fundWallet({
												address: publicKey ?? "",
												options: {
													chain: "solana:devnet",
												},
											})
										}
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
										<span>Fund Wallet</span>
									</button>

									<button
										onClick={() => exportWallet()}
										className="w-full px-4 py-3 text-left text-white hover:bg-[#262626] transition-colors duration-150 flex items-center gap-2"
										type="button"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>Export Wallet</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M17 8V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-1"
											/>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M21 12H10m0 0l3-3m-3 3l3 3"
											/>
										</svg>

										<span>Export Wallet</span>
									</button>

									{/* View on Explorer */}
									<a
										href={`https://orbmarkets.io/address/${publicKey}?advanced=true&cluster=devnet&tab=summary`}
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

				<div className="fixed inset-0 z-0 flex flex-col pointer-events-none">
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

				<div className="relative z-20 flex-1 flex items-start md:items-center justify-center">
					<HoroscopeSection />
				</div>

				{/* Footer */}
				<div className="block absolute bottom-4 md:bottom-11 left-0 w-full z-999 px-6">
					{/* Mobile dropdown container - centered above footer */}
					<div className="w-full flex md:hidden mt-0 mb-5 flex-col items-center gap-4 relative">
						<div ref={dropdownRef} className="relative">
							<button
								onClick={() => setShowDropdown(!showDropdown)}
								className="flex flex-row gap-2 items-center
									bg-[#1F1F1F]
									border border-[#FC5411]
									text-white
									px-4
									py-2
									rounded-xl
									hover:scale-105
									font-medium
									hover:bg-[#262626]
									hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
									transition-all duration-200
									min-w-[140px]
									cursor-pointer
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

							{/* Mobile Dropdown Menu - opens upward */}
							{showDropdown && (
								<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-full min-w-[160px] bg-[#1F1F1F] border border-[#FC5411] rounded-xl shadow-lg overflow-hidden z-999">
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

										<button
											onClick={() =>
												fundWallet({
													address: publicKey ?? "",
													options: {
														chain: "solana:devnet",
													},
												})
											}
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
											<span>Fund Wallet</span>
										</button>

										<button
											onClick={() => exportWallet()}
											className="w-full px-4 py-3 text-left text-white hover:bg-[#262626] transition-colors duration-150 flex items-center gap-2"
											type="button"
										>
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<title>Export Wallet</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M17 8V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-1"
												/>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M21 12H10m0 0l3-3m-3 3l3 3"
												/>
											</svg>

											<span>Export Wallet</span>
										</button>

										{/* View on Explorer */}
										<a
											href={`https://orbmarkets.io/address/${publicKey}?advanced=true&cluster=devnet&tab=summary`}
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

export default CardsPage;
