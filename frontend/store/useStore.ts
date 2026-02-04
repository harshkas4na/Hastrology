import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { create } from "zustand";
import { AppState } from "@/types";

export const useStore = create<AppState>((set) => ({
	wallet: null,
	user: null,
	card: null, // New format: single card
	cards: null, // Old format: backwards compatibility
	loading: false,
	showFundWallet: false,
	balance: null,

	setWallet: (wallet) => set({ wallet }),
	setUser: (user) => set({ user }),
	setCard: (card) => set({ card, cards: null }), // Set single card, clear old cards
	setCards: (cards) => set({ cards, card: null }), // Set old cards, clear new card
	setLoading: (loading) => set({ loading }),

	setShowFundWallet: (value) => set({ showFundWallet: value }),

	setBalance: (balance) => set({ balance }),

	refreshBalance: async (wallet: string) => {
		try {
			const endpoint =
				process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
				"https://api.mainnet-beta.solana.com";
			const connection = new Connection(endpoint, "confirmed");
			const pubKey = new PublicKey(wallet);
			const lamports = await connection.getBalance(pubKey);
			const solBalance = lamports / LAMPORTS_PER_SOL;

			set({ balance: solBalance });
		} catch (error) {
			console.error("Error fetching balance:", error);
		}
	},

	reset: () =>
		set({
			wallet: null,
			user: null,
			card: null,
			cards: null,
			loading: false,
		}),
}));
