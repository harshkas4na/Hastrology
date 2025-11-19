import { BirthDetails, HoroscopeStatus, HoroscopeResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export const api = {
    /**
     * Register a new user with birth details
     */
    async registerUser(data: BirthDetails) {
        const res = await fetch(`${API_BASE}/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to register user');
        }

        return res.json();
    },

    /**
     * Check horoscope status for a wallet
     */
    async getStatus(walletAddress: string): Promise<HoroscopeStatus> {
        const res = await fetch(`${API_BASE}/horoscope/status?walletAddress=${walletAddress}`);

        if (!res.ok) {
            throw new Error('Failed to get horoscope status');
        }

        return res.json();
    },

    /**
     * Confirm payment and generate horoscope
     */
    async confirmHoroscope(walletAddress: string, signature: string): Promise<HoroscopeResponse> {
        const res = await fetch(`${API_BASE}/horoscope/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, signature })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to generate horoscope');
        }

        return res.json();
    },

    /**
     * Get horoscope history
     */
    async getHistory(walletAddress: string, limit = 10) {
        const res = await fetch(`${API_BASE}/horoscope/history/${walletAddress}?limit=${limit}`);

        if (!res.ok) {
            throw new Error('Failed to get horoscope history');
        }

        return res.json();
    }
};
