"use client";

import { useFundWallet } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef, useState } from "react";
import { PlaceAutocomplete } from "@/components/place-autocomplete";
import { StarBackground } from "@/components/StarBackground";
import { api } from "@/lib/api";
import { geocodePlace, getTimezoneOffset } from "@/lib/geocoding";
import { useStore } from "@/store/useStore";
import { usePrivyWallet } from "../hooks/use-privy-wallet";

const LoginPage: FC = () => {
	const { publicKey, connected, disconnect } = usePrivyWallet();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const hasCheckedProfileRef = useRef(false);
	const { setWallet, setUser, reset, setLoading, user } = useStore();
	const [isGeocoding, setIsGeocoding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const [birthDate, setBirthDate] = useState("");
	const [birthTime, setBirthTime] = useState("");
	const [birthPlace, setBirthPlace] = useState("");
	const { fundWallet } = useFundWallet();

	useEffect(() => {
		const checkExistingUser = async () => {
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

				if (profileResponse?.user?.username) {
					setUser(profileResponse.user);

					if (
						profileResponse.user.dob &&
						profileResponse.user.birthTime &&
						profileResponse.user.birthPlace
					) {
						router.push("/cards");
					}
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

		if (!birthDate || !publicKey) {
			setError("Please enter your birth date");
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			let lat: number | null = null;
			let lng: number | null = null;
			let tzOffset: number | null = null;

			if (birthPlace.trim()) {
				setIsGeocoding(true);
				const geoResult = await geocodePlace(birthPlace);

				if (geoResult.success) {
					lat = geoResult.latitude;
					lng = geoResult.longitude;
					tzOffset = getTimezoneOffset(birthPlace, geoResult.longitude);
				}
				setIsGeocoding(false);
			}

			setLoading(true);

			const updatedUser = await api.updateBirthDetails({
				walletAddress: publicKey,
				dob: birthDate,
				birthTime: birthTime || undefined,
				birthPlace: birthPlace.trim() || undefined,
				latitude: lat,
				longitude: lng,
				timezoneOffset: tzOffset,
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

	const handleDisconnect = async () => {
		try {
			await disconnect();
			reset();
			router.push("/");
		} catch (error) {
			console.error("Error disconnecting:", error);
		}
	};

	const handleSkip = async () => {
		if (!publicKey || !birthDate) {
			setError("Please enter your birth date");
			return;
		}

		setIsSubmitting(true);
		try {
			const updatedUser = await api.updateBirthDetails({
				walletAddress: publicKey!,
				dob: birthDate,
			});

			if (updatedUser?.user) {
				setUser(updatedUser.user);
			}
			router.push("/cards");
		} catch (err) {
			console.error("Skip failed:", err);
			setError("Failed to continue. Please try again.");
			setIsSubmitting(false);
		}
	};

	const isSubmittingForm = isSubmitting || isGeocoding;

	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-10">
			<StarBackground />

			{/* Back/Disconnect button */}
			<button
				onClick={handleDisconnect}
				className="absolute top-6 left-6 flex items-center gap-2 text-white/60 text-sm hover:text-white transition-colors z-20"
				type="button"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className="w-5 h-5"
				>
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
				Back
			</button>

			{/* Wallet badge top right */}
			<div className="absolute top-6 right-6 z-20">
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
					<span className="text-xs text-white/50">
						{publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
					</span>
				</div>
			</div>

			<div className="relative z-10 w-full max-w-[520px] screen-fade-in">
				<div className="card-glass">
					{/* Progress dots */}
					<div className="progress-dots">
						<div className="progress-dot" />
						<div className="progress-dot active" />
						<div className="progress-dot" />
					</div>

					{/* Header */}
					<div className="text-center mb-10">
						<h1 className="text-2xl md:text-3xl font-semibold mb-3 bg-gradient-to-r from-white to-[#d4a017] bg-clip-text text-transparent">
							When were you born?
						</h1>
						<p className="text-sm text-white/50 leading-relaxed">
							We need your birth details to calculate your personalized horoscope.
						</p>
					</div>

					<form onSubmit={handleBirthDetailsSubmit} className="space-y-6">
						{/* Birth Date - Required */}
						<div>
							<label className="form-label">
								Birth Date
								<span className="badge-required">Required</span>
							</label>
							<input
								type="date"
								className="form-input"
								value={birthDate}
								onChange={(e) => setBirthDate(e.target.value)}
								disabled={isSubmittingForm}
								required
							/>
						</div>

						{/* Birth Place - Optional */}
						<div>
							<label className="form-label">
								Birth Place
								<span className="badge-optional">Optional</span>
							</label>
							<PlaceAutocomplete
								value={birthPlace}
								onChange={setBirthPlace}
								disabled={isSubmittingForm}
							/>
						</div>

						{/* Birth Time - Optional */}
						<div>
							<label className="form-label">
								Birth Time
								<span className="badge-optional">Optional</span>
							</label>
							<input
								type="time"
								className="form-input"
								value={birthTime}
								onChange={(e) => setBirthTime(e.target.value)}
								disabled={isSubmittingForm}
							/>
						</div>

						{/* Error message */}
						{error && (
							<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
								{error}
							</div>
						)}

						{/* Buttons */}
						<div className="space-y-3 pt-4">
							<button
								type="submit"
								className="btn-primary w-full"
								disabled={isSubmittingForm || !birthDate}
							>
								{isSubmittingForm ? "Locating your stars..." : "Continue"}
							</button>
							<button
								type="button"
								className="btn-secondary w-full"
								onClick={handleSkip}
								disabled={isSubmittingForm || !birthDate}
							>
								Skip optional details
							</button>
						</div>
					</form>
				</div>
			</div>
		</section>
	);
};

export default LoginPage;
