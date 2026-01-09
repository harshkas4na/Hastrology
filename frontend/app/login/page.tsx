"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { geocodePlace, getTimezoneOffset } from "@/lib/geocoding";
import { useStore } from "@/store/useStore";

const WalletMultiButtonDynamic = dynamic(
	async () =>
		(await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
	{ ssr: false },
);

type FormStep = "initial" | "birth-details";

const LoginPage: FC = () => {
	const { publicKey, connected } = useWallet();
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

	useEffect(() => {
		if (wasConnected.current && !publicKey) {
			router.push("/");
		}
		wasConnected.current = !!publicKey;
	}, [publicKey, router]);

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

			const address = publicKey.toBase58();
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

	const handleInitialSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (userState !== "new") return;

		if (!connected || !publicKey || !name.trim() || isSubmitting) {
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			const address = publicKey.toBase58();

			const createdUser = await api.registerUser({
				username: name.trim(),
				walletAddress: address,
				dob: null,
				birthTime: null,
				birthPlace: null,
				latitude: null,
				longitude: null,
			});

			if (!createdUser?.user) {
				throw new Error("User creation failed");
			}

			setUser(createdUser.user);
			setFormStep("birth-details");
			setIsSubmitting(false);
		} catch (err) {
			console.error("Registration failed:", err);
			setError("Registration failed. Please try again.");
			setIsSubmitting(false);
		}
	};

	const handleBirthDetailsSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (
			!connected ||
			!publicKey ||
			!birthDate ||
			!birthTime ||
			!birthPlace ||
			isSubmitting
		) {
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
			const address = publicKey.toBase58();

			const updatedUser = await api.registerUser({
				username: name.trim(),
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

	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
			<div className="absolute inset-y-0 right-0 w-1/2 z-0 flex flex-col">
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

			<img
				alt="Orange Planet"
				className="absolute left-170 top-0 h-full w-auto object-contain object-left z-0"
				src="/ellipse-left.png"
			/>
			<img
				alt="Black Planet"
				className="absolute left-170 top-0 h-full w-auto object-contain object-left z-10"
				src="/ellipse-black.png"
			/>

			{/* LEFT BLACK PANEL — FORMS */}
			<div className="absolute inset-y-0 left-0 w-1/2 z-20 flex items-start justify-center pt-35">
				<div className="w-full max-w-xl px-10">
					{formStep === "initial" ? (
						<>
							<h1 className="text-5xl font-semibold text-white mb-2">
								Enter Your Name
							</h1>
							<p className="text-gray-400 mb-8 mt-2 text-2xl">
								To know more about yourself
							</p>

							<div className="mb-10 mt-25">
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

							<form onSubmit={handleInitialSubmit}>
								{userState === "new" && (
									<div className="mb-6">
										<input
											className="
											w-full px-4 py-3 rounded-lg
											bg-[#1F1F1F]
											border border-[#2A2A2A]
											text-white
											placeholder:text-gray-500
											focus:outline-none
											focus:border-[#FC5411]
											disabled:opacity-50
											disabled:cursor-not-allowed
										"
											disabled={isSubmitting}
											onChange={(e) => setName(e.target.value)}
											placeholder="Enter Name"
											value={name}
										/>
									</div>
								)}

								<div className="w-full text-center mt-8">
									{!connected ? (
										<WalletMultiButtonDynamic
											className={`
												!w-full
												!flex
												!justify-center
												!rounded-lg
												!h-12
												!border
												transition-all
												${
													name.trim()
														? "!bg-[#1F1F1F] !text-white !border-[#FC5411] hover:!bg-[#262626]"
														: "!bg-[#141414] !text-gray-500 !border-[#2A2A2A] cursor-not-allowed opacity-60"
												}
											`}
											disabled={userState === "new" && !name.trim()}
										>
											Connect Wallet
										</WalletMultiButtonDynamic>
									) : (
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
													name.trim() && !isSubmitting
														? "bg-[#1F1F1F] text-white border-[#FC5411] hover:bg-[#262626]"
														: "bg-[#141414] text-gray-500 border-[#2A2A2A] cursor-not-allowed opacity-60"
												}
											`}
											disabled={userState === "new" && !name.trim()}
											type="submit"
										>
											{isSubmitting ? "Submitting..." : "Submit"}
										</button>
									)}
								</div>
							</form>
							<div className="w-full text-center mt-8">
								{user && (
									<WalletMultiButtonDynamic
										className={`
												!w-full
												!flex
												!justify-center
												!rounded-lg
												!h-12
												!border
												transition-all
												${
													name.trim()
														? "!bg-[#1F1F1F] !text-white !border-[#FC5411] hover:!bg-[#262626]"
														: "!bg-[#141414] !text-gray-500 !border-[#2A2A2A] cursor-not-allowed opacity-60"
												}
											`}
										disabled={!name.trim()}
									/>
								)}
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
							<div className="flex items-center justify-between mb-2">
								<h1 className="text-5xl font-semibold text-white">
									Enter Your Birth Details
								</h1>
							</div>
							<p className="text-gray-400 mb-16 mt-2 text-2xl">
								Align Your Energy With Cosmos ✨
							</p>

							<form
								className="space-y-10 mt-26"
								onSubmit={handleBirthDetailsSubmit}
							>
								{/* Date of Birth */}
								<div>
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
										"
										disabled={isSubmitting}
										onChange={(e) => setBirthPlace(e.target.value)}
										placeholder="Place of Birth"
										type="text"
										value={birthPlace}
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

							<div className="w-full text-center mt-8">
								{user && (
									<WalletMultiButtonDynamic
										className={`
												!w-full
												!flex
												!justify-center
												!rounded-lg
												!h-12
												!border
												transition-all
												${
													name.trim()
														? "!bg-[#1F1F1F] !text-white !border-[#FC5411] hover:!bg-[#262626]"
														: "!bg-[#141414] !text-gray-500 !border-[#2A2A2A] cursor-not-allowed opacity-60"
												}
											`}
										disabled={!name.trim()}
									/>
								)}
							</div>
						</>
					)}

					{error && (
						<p className="mt-4 text-sm text-red-500 text-center">{error}</p>
					)}
				</div>
			</div>

			{/* CONTENT */}
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="
					relative z-10
					text-center
					px-6
					max-w-4xl
					ml-auto
					mr-24
					md:mr-10
					lg:mr-15
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

			<div className="absolute bottom-11 left-0 w-full z-30 px-6">
				<div className="font-display max-w-7xl mx-auto flex items-center justify-between text-md text-[#8A8A8A]">
					<span className="font-display">
						©2025 <span className="text-white">Hastrology</span>
					</span>
					<div className="flex gap-6">
						<span className="text-white">Your cosmic journey on Solana.</span>
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
