"use client";

import { useEffect } from "react";
import { Hero } from "@/components/Hero";
import { api } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { usePrivyWallet } from "./hooks/use-privy-wallet";

export default function Home() {
	const { publicKey, connected } = usePrivyWallet();
	const { setWallet, setUser, reset } = useStore();

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

	return (
		<main className="relative">
			{/* Hero Section */}
			<Hero />
		</main>
	);
}
