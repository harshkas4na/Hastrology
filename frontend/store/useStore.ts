import { create } from 'zustand';
import { AppState } from '@/types';

export const useStore = create<AppState>((set) => ({
    wallet: null,
    user: null,
    cards: null,
    loading: false,

    setWallet: (wallet) => set({ wallet }),
    setUser: (user) => set({ user }),
    setCards: (cards) => set({ cards }),
    setLoading: (loading) => set({ loading }),

    reset: () => set({
        wallet: null,
        user: null,
        cards: null,
        loading: false
    })
}));
