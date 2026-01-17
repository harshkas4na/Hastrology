import { usePrivy } from "@privy-io/react-auth";
import {
	useSignAndSendTransaction,
	useSignMessage,
	useSignTransaction,
	useWallets,
} from "@privy-io/react-auth/solana";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useCallback, useMemo } from "react";

export function usePrivyWallet() {
	const { user, authenticated, ready, logout: privyLogout } = usePrivy();
	const { wallets, ready: walletsReady } = useWallets();
	const { signMessage: signPrivyMessage } = useSignMessage();
	const { signTransaction: signPrivyTransaction } = useSignTransaction();
	const { signAndSendTransaction } = useSignAndSendTransaction();

	const wallet = useMemo(() => {
		if (!authenticated || !walletsReady || !wallets.length) return undefined;

		const hasEmbeddedAccount = user?.linkedAccounts?.some(
			(a: { type?: string; walletClientType?: string }) =>
				a.type === "wallet" && a.walletClientType === "privy",
		);

		if (hasEmbeddedAccount) {
			return wallets[0];
		}

		return wallets[0];
	}, [authenticated, wallets, walletsReady, user?.linkedAccounts]);

	const publicKey = useMemo(
		() => (wallet?.address ? wallet.address : undefined),
		[wallet],
	);

	const isConnected = Boolean(authenticated && wallet && publicKey);
	const isLoadingWallet = authenticated && walletsReady && !wallet;

	const signMessage = useCallback(
		async (message: string | Uint8Array): Promise<Uint8Array> => {
			if (!wallet) throw new Error("No wallet connected");

			const messageBytes =
				typeof message === "string"
					? new TextEncoder().encode(message)
					: message;

			const signatureUint8Array = (
				await signPrivyMessage({
					message: messageBytes,
					wallet: wallet,
					options: {
						uiOptions: {
							title: "Sign this message",
						},
					},
				})
			).signature;

			return signatureUint8Array;
		},
		[wallet, signPrivyMessage],
	);

	const signTransaction = useCallback(
		async (
			transaction: Transaction | VersionedTransaction,
		): Promise<Transaction | VersionedTransaction> => {
			if (!wallet) throw new Error("No wallet connected");

			const transactionBytes = transaction.serialize({
				requireAllSignatures: false,
				verifySignatures: false,
			});

			const { signedTransaction } = await signPrivyTransaction({
				transaction: transactionBytes,
				wallet: wallet,
			});

			if (transaction instanceof VersionedTransaction) {
				return VersionedTransaction.deserialize(signedTransaction);
			} else {
				return Transaction.from(signedTransaction);
			}
		},
		[wallet, signPrivyTransaction],
	);

	const signAllTransactions = useCallback(
		async (
			transactions: (Transaction | VersionedTransaction)[],
		): Promise<(Transaction | VersionedTransaction)[]> => {
			if (!wallet) throw new Error("No wallet connected");

			const signedTransactions: (Transaction | VersionedTransaction)[] = [];

			for (const transaction of transactions) {
				const signedTx = await signTransaction(transaction);
				signedTransactions.push(signedTx);
			}

			return signedTransactions;
		},
		[wallet, signTransaction],
	);

	const sendTransaction = useCallback(
		async (transaction: Uint8Array): Promise<string> => {
			if (!wallet) throw new Error("No wallet connected");

			try {
				const result = await signAndSendTransaction({
					transaction: transaction,
					wallet: wallet,
					chain: "solana:devnet",
				});

				const signatureBytes = result.signature;

				const signature = bs58.encode(signatureBytes);
				return signature;
			} catch (error) {
				console.error("Failed to send transaction:", error);
				throw error;
			}
		},
		[wallet, signAndSendTransaction],
	);

	return {
		publicKey,
		address: publicKey,
		connected: isConnected,
		isReady: ready && walletsReady,
		isLoadingWallet,
		signMessage,
		signTransaction,
		signAllTransactions,
		sendTransaction,
		disconnect: privyLogout,
		wallet,
	};
}
