"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import {
	ConnectionProvider,
	WalletProvider,
} from "@solana/wallet-adapter-react";
import {
	PhantomWalletAdapter,
	SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
	const network =
		(process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ||
		"devnet";
	const endpoint = useMemo(() => clusterApiUrl(network), [network]);
	const wallets = useMemo(
		() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
		[],
	);
	return (
		<ConnectionProvider endpoint={endpoint}>
			<WalletProvider wallets={wallets} autoConnect>
				<PrivyProvider
					appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
					config={{
						solana: {
							rpcs: {
								"solana:mainnet": {
									rpc: createSolanaRpc("https://api.mainnet-beta.solana.com"),
									rpcSubscriptions: createSolanaRpcSubscriptions(
										"wss://api.mainnet-beta.solana.com",
									),
								},
								"solana:devnet": {
									rpc: createSolanaRpc("https://api.devnet.solana.com"),
									rpcSubscriptions: createSolanaRpcSubscriptions(
										"wss://api.devnet.solana.com",
									),
								},
							},
						},
						appearance: {
							showWalletLoginFirst: false,
							walletChainType: "solana-only",
						},
						loginMethods: ["email", "twitter"],
						embeddedWallets: {
							solana: {
								createOnLogin: "all-users",
							},
						},
					}}
				>
					{children}
				</PrivyProvider>
			</WalletProvider>
		</ConnectionProvider>
	);
};
