"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { type FC, useEffect, useRef } from "react";
import { HoroscopeSection } from "@/components/HoroscopeSection";
import { UserXDetails } from "@/components/TwitterDetails";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";

const CardsPage: FC = () => {
	const { publicKey, disconnect, connected } = useWallet();
	const { user } = useStore();
	const { setWallet, setUser, reset } = useStore();

	const router = useRouter();
	const wasConnected = useRef(false);

	useEffect(() => {
		const checkUserProfile = async () => {
			if (connected && publicKey) {
				setWallet(publicKey.toBase58());

				try {
					const profileResponse = await api.getUserProfile(
						publicKey.toBase58(),
					);

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

	const handleDisconnect = async () => {
		try {
			await disconnect();
			reset();
			router.push("/");
		} catch (error) {
			console.error("Error disconnecting:", error);
		}
	};

	return (
		<section className="relative min-h-screen flex flex-col bg-black">
			{user?.twitterId && <UserXDetails />}

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

			<div className="absolute top-6 right-6 z-100">
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
			<div className="relative z-20 flex-1 flex items-center justify-center">
				<HoroscopeSection />
			</div>

			<footer className="relative z-10 w-full px-6 py-6">
				<div className="font-display max-w-auto mx-auto flex items-center justify-between text-md text-[#8A8A8A]">
					<span>
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
			</footer>
		</section>
	);
};

export default CardsPage;
