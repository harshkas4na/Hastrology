import { create } from 'zustand';
import { AppState } from '@/types';

export const useStore = create<AppState>((set) => ({
    wallet: null,
    user: null,
    horoscope: null,
    loading: false,

    setWallet: (wallet) => set({ wallet }),
    setUser: (user) => set({ user }),
    setHoroscope: (horoscope) => set({ horoscope }),
    setLoading: (loading) => set({ loading }),

    reset: () => set({
        wallet: null,
        user: null,
        horoscope: null,
        loading: false
    })
}));
