"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
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
		"mainnet-beta";
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
						// Pass the Solana wallet connectors to Privy
						externalWallets: {
							solana: {
								connectors: toSolanaWalletConnectors(),
							},
						},
						solana: {
							rpcs: {
								"solana:mainnet": {
									rpc: createSolanaRpc("https://solana-rpc.publicnode.com"),
									rpcSubscriptions: createSolanaRpcSubscriptions(
										"wss://solana-rpc.publicnode.com",
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
							theme: "#000000",
							showWalletLoginFirst: false,
							walletChainType: "solana-only",
							landingHeader: "Log in or sign up",
							logo: "/logo/hast.png",
						},
						loginMethods: ["twitter"],
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
