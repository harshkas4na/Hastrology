// components/balance.tsx
"use client";

import { useFundWallet } from "@privy-io/react-auth/solana";
import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { FC, useCallback, useEffect, useState } from "react";
import { usePrivyWallet } from "@/app/hooks/use-privy-wallet";
import { useStore } from "@/store/useStore";

export const WalletBalance: FC = () => {
	const { publicKey } = usePrivyWallet();
	const { connection: walletConnection } = useConnection();
	const { balance, setBalance } = useStore();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isFunding, setIsFunding] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const { fundWallet } = useFundWallet({
		onUserExited(params) {
			if (publicKey) {
				setTimeout(() => {
					fetchBalance();
				}, 2000);
			}
		},
	});

	const fetchBalance = useCallback(async () => {
		if (!publicKey) {
			setBalance(null);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			let connection: Connection;

			if (walletConnection) {
				connection = walletConnection;
			} else {
				const endpoint =
					process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
					"https://api.devnet.solana.com";
				connection = new Connection(endpoint, "confirmed");
			}

			const pubKey = new PublicKey(publicKey);
			const lamports = await connection.getBalance(pubKey);
			const solBalance = lamports / LAMPORTS_PER_SOL;

			setBalance(solBalance);
		} catch (err) {
			console.error("Error fetching balance:", err);
			setError("Failed to load balance");
		} finally {
			setLoading(false);
		}
	}, [publicKey, setBalance, walletConnection]);

	useEffect(() => {
		fetchBalance();
		const intervalId = setInterval(fetchBalance, 10000);
		return () => clearInterval(intervalId);
	}, [fetchBalance]);

	const handleFundWalletClick = () => {
		if (balance !== null && balance < 0.01) {
			setShowConfirm(true);
		} else {
			initiateFundWallet();
		}
	};

	const initiateFundWallet = async () => {
		if (!publicKey || isFunding) return;

		setShowConfirm(false);
		setIsFunding(true);
		try {
			await fundWallet({
				address: publicKey,
				options: {
					chain: "solana:devnet",
				},
			});

			// Refresh balance immediately after funding
			await fetchBalance();
		} catch (error) {
			console.error("Error funding wallet:", error);
		} finally {
			setIsFunding(false);
		}
	};

	if (!publicKey) return null;

	return (
		<>
			{/* Confirmation Dialog */}
			{showConfirm && (
				<div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
					<div className="bg-[#1F1F1F] border border-[#FC5411] rounded-xl p-6 max-w-md w-full">
						<h3 className="text-lg font-bold text-white mb-2">
							Fund Your Wallet
						</h3>
						<p className="text-gray-300 mb-4">
							Your balance is low ({balance?.toFixed(2)} SOL). Would you like to
							add funds to your wallet?
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowConfirm(false)}
								className="flex-1 py-2 px-4 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
								type="button"
							>
								Cancel
							</button>
							<button
								onClick={initiateFundWallet}
								disabled={isFunding}
								className="flex-1 py-2 px-4 bg-[#FC5411] text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								type="button"
							>
								{isFunding ? "Funding..." : "Add Funds"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Balance Component */}
			<div
				className="
					absolute z-50
					inset-x-0 top-20 md:top-6
					flex justify-center
					md:inset-auto md:top-6 md:right-55
					md:justify-end
				"
			>
				<button
					onClick={handleFundWalletClick}
					disabled={loading || isFunding}
					className="
						flex flex-row gap-2 items-center
						bg-[#1F1F1F]
						border border-[#FC5411]
						text-white
						px-4
						py-1.5
						rounded-xl
						font-medium
						transition-all
						cursor-pointer
						min-w-[140px]
						justify-center
						hover:bg-[#262626]
						hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
						active:scale-95
						disabled:opacity-70
						disabled:cursor-not-allowed
						disabled:hover:bg-[#1F1F1F]
						disabled:hover:shadow-none
						group
					"
					type="button"
				>
					{isFunding ? (
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full border-2 border-[#FC5411]/20 border-t-[#FC5411] animate-spin" />
							<span className="text-sm md:text-lg">Funding...</span>
						</div>
					) : loading ? (
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
							<span className="text-sm md:text-lg">Loading...</span>
						</div>
					) : error ? (
						<div className="flex items-center gap-2">
							<span className="text-red-400 text-xs">Error</span>
							<span className="text-xs text-gray-400">Tap to refresh</span>
						</div>
					) : balance !== null ? (
						<div className="flex items-center gap-2">
							<img
								alt="Solana Logo"
								className="w-4 h-5"
								src="https://solana.com/src/img/branding/solanaLogoMark.svg"
							/>

							<div className="flex flex-col items-end">
								<span className="text-sm md:text-lg font-bold">
									{balance.toFixed(3)} SOL
								</span>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
							<span className="text-sm md:text-lg">Connecting...</span>
						</div>
					)}
				</button>
			</div>
		</>
	);
};
