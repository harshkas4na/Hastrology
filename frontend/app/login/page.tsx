"use client";
import { useExportWallet, useFundWallet } from "@privy-io/react-auth/solana";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef, useState } from "react";
import { PlaceAutocomplete } from "@/components/place-autocomplete";
import { api } from "@/lib/api";
import { geocodePlace, getTimezoneOffset } from "@/lib/geocoding";
import { useStore } from "@/store/useStore";
import { usePrivyWallet } from "../hooks/use-privy-wallet";

type FormStep = "initial" | "birth-details";

const LoginPage: FC = () => {
	const { publicKey, connected, disconnect } = usePrivyWallet();
	const [name, setName] = useState("");
	const [formStep, setFormStep] = useState<FormStep>("birth-details");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const hasCheckedProfileRef = useRef(false);
	const [userState, setUserState] = useState<"unknown" | "new" | "existing">(
		"unknown",
	);
	const { setWallet, setUser, reset, setLoading, user } = useStore();
	const [isGeocoding, setIsGeocoding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const [birthDate, setBirthDate] = useState("");
	const [birthTime, setBirthTime] = useState("");
	const [birthPlace, setBirthPlace] = useState("");
	const wasConnected = useRef(false);
	const { fundWallet } = useFundWallet();

	const { exportWallet } = useExportWallet();
	const [showDropdown, setShowDropdown] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const checkExistingUser = async () => {
			if (!connected || !publicKey) {
				reset();
				hasCheckedProfileRef.current = false;
				setUserState("unknown");
				setFormStep("birth-details");
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

				if (profileResponse?.user?.username) {
					setUserState("existing");
					setUser(profileResponse.user);

					if (profileResponse.user.username) {
						setName(profileResponse.user.username);
					}

					if (
						profileResponse.user.dob &&
						profileResponse.user.birthTime &&
						profileResponse.user.birthPlace
					) {
						router.push("/cards");
					} else {
						setFormStep("birth-details");
					}
				} else {
					setUserState("new");
				}
			} catch (err) {
				console.error("Error checking user profile:", err);
				setError("Error checking profile. Please try again.");
			}
		};

		checkExistingUser();
	}, [connected, publicKey, reset, setUser, setWallet, router]);

	const handleBirthDetailsSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!birthDate || !birthTime || !birthPlace || !publicKey) {
			setError("Please fill in all birth details");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		setIsGeocoding(true);
		try {
			const geoResult = await geocodePlace(birthPlace);

			if (!geoResult.success) {
				setError(
					geoResult.error ||
						'Could not find location. Please try a more specific place name (e.g., "New Delhi, India")',
				);
				setIsGeocoding(false);
				return;
			}

			setIsGeocoding(false);
			setLoading(true);

			const timezoneOffset = getTimezoneOffset(birthPlace, geoResult.longitude);
			const address = publicKey;

			const updatedUser = await api.updateBirthDetails({
				walletAddress: address,
				dob: birthDate,
				birthTime: birthTime,
				birthPlace: birthPlace.trim(),
				latitude: geoResult.latitude,
				longitude: geoResult.longitude,
				timezoneOffset: timezoneOffset,
			});

			if (!updatedUser?.user) {
				throw new Error("Failed to update birth details");
			}

			setUser(updatedUser.user);
			router.push("/cards");
		} catch (err) {
			console.error("Birth details submission failed:", err);
			setError("Failed to save birth details. Please try again.");
			setIsSubmitting(false);
		}
	};

	const isSubmittingForm = isSubmitting || isGeocoding;

	const handleDisconnect = async () => {
		try {
			await disconnect();
			reset();
			router.push("/");
		} catch (error) {
			console.error("Error disconnecting:", error);
		}
	};

	const copyAddress = async () => {
		if (!publicKey) return;

		try {
			await navigator.clipboard.writeText(publicKey);
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
						className="-mt-10 md:-mt-5
              w-65 md:w-96 lg:w-120
              mx-auto
              drop-shadow-[0_0_20px_rgba(251,146,60,0.35)]
            "
						initial={{ scale: 0.9, opacity: 0 }}
						src="/Hastrology.svg"
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

			{/* LEFT BLACK PANEL — FORMS */}
			<div className="mt-10 md:mt-0 relative lg:absolute inset-y-0 left-0 w-full lg:w-1/2 z-20 flex items-center lg:items-start justify-center pt-8 lg:pt-35 px-4">
				<div className="w-full max-w-xl px-4 lg:px-10">
					{formStep === "initial" ? (
						<>
							<h1 className="text-3xl lg:text-5xl font-semibold text-white mb-2">
								Enter Your Name
							</h1>
							<p className="text-gray-400 mb-6 lg:mb-8 mt-2 text-lg lg:text-2xl">
								To know more about yourself
							</p>

							<div className="mb-6 lg:mb-10 mt-12 lg:mt-25">
								<div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-gray-300">
									<span className="flex items-center gap-3">
										<img
											alt="Solana Logo"
											className="w-4 h-5"
											src="https://solana.com/src/img/branding/solanaLogoMark.svg"
										/>
										Solana
									</span>
									<span className="text-gray-500">⌄</span>
								</div>
							</div>

							<div className="flex flex-row justify-center items-center gap-2 mt-6 text-center">
								<p className="text-md text-gray-400">
									Prefer to connect using X?
								</p>

								<Link
									href="/link-x"
									className="
			inline-flex items-center gap-2
			text-[#eb5a16]
			text-md font-medium
			hover:text-[#ff7a3d]
			transition
		"
								>
									Continue with X Login
									<span className="transition-transform group-hover:translate-x-1">
										→
									</span>
								</Link>
							</div>
						</>
					) : (
						// BIRTH DETAILS FORM
						<>
							<div className="flex items-center justify-center md:justify-between mb-2">
								<h1 className="text-xl lg:text-5xl font-semibold text-white">
									Enter Your Birth Details
								</h1>
							</div>
							<p className="hidden md:block text-gray-400 md:text-left text-center mb-8 lg:mb-16 mt-2 text-lg lg:text-2xl">
								Align Your Energy With Cosmos ✨
							</p>

							<form
								className="space-y-6 lg:space-y-10 mt-8 lg:mt-26"
								onSubmit={handleBirthDetailsSubmit}
							>
								{/* Date of Birth */}
								<div>
									<label className="block md:hidden text-sm text-gray-400 mb-1">
										Date of Birth
									</label>
									<input
										className="
											w-full px-4 py-3 rounded-lg
											bg-[#121212]
											border border-[#2A2A2A]
											text-white
											placeholder:text-gray-500
											focus:outline-none
											focus:border-[#FC5411]
											disabled:opacity-50
											disabled:cursor-not-allowed
											[color-scheme:dark]
										"
										disabled={isSubmitting}
										onChange={(e) => setBirthDate(e.target.value)}
										placeholder="Date of Birth"
										type="date"
										value={birthDate}
									/>
								</div>

								{/* Time of Birth */}
								<div>
									<label className="block md:hidden text-sm text-gray-400 mb-1">
										Time of Birth
									</label>
									<input
										className="
											w-full px-4 py-3 rounded-lg
											bg-[#121212]
											border border-[#2A2A2A]
											text-white
											placeholder:text-gray-500
											focus:outline-none
											focus:border-[#FC5411]
											disabled:opacity-50
											disabled:cursor-not-allowed
											[color-scheme:dark]
										"
										disabled={isSubmitting}
										onChange={(e) => setBirthTime(e.target.value)}
										placeholder="Time of Birth"
										type="time"
										value={birthTime}
									/>
								</div>

								{/* Place of Birth */}
								<div>
									<label className="block md:hidden text-sm text-gray-400 mb-1">
										Place of Birth
									</label>
									<PlaceAutocomplete
										value={birthPlace}
										onChange={setBirthPlace}
										disabled={isSubmitting}
									/>
								</div>

								{/* Continue Button */}
								<button
									className={`
										w-full
										flex
										justify-center
										items-center
										rounded-lg
										h-12
										border
										transition-all
										${
											birthDate && birthTime && birthPlace && !isSubmitting
												? "bg-[#1F1F1F] text-white border-[#FC5411] hover:bg-[#262626]"
												: "bg-[#1f1f1f] text-gray-500 border-[#2A2A2A] cursor-not-allowed opacity-60"
										}
									`}
									disabled={
										!birthDate || !birthTime || !birthPlace || isSubmitting
									}
									type="submit"
								>
									{isSubmittingForm
										? " Locating your stars..."
										: "Continue Journey →"}
								</button>
							</form>
						</>
					)}

					{error && (
						<p className="mt-4 text-sm text-red-500 text-center">{error}</p>
					)}
				</div>
			</div>

			{/* CONTENT - Hidden on mobile */}
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
					Unlock the secrets of the stars with AI-powered insights on Solana.
					<br />
					<span className="text-[#CCCCCC] mt-0">
						Your destiny is written in the code of the cosmos. ✨
					</span>
				</motion.p>
			</motion.div>

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
	);
};

export default LoginPage;
