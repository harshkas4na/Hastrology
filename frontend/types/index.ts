export interface BirthDetails {
    walletAddress: string;
    dob: string;
    birthTime: string;
    birthPlace: string;
}

export interface HoroscopeStatus {
    status: 'new_user' | 'clear_to_pay' | 'exists';
    horoscope?: string;
    date?: string;
}

export interface HoroscopeResponse {
    horoscope_text: string;
    date: string;
}

export interface User {
    id: string;
    walletAddress: string;
    dob: string;
    birthTime: string;
    birthPlace: string;
    createdAt: string;
}

export interface AppState {
    wallet: string | null;
    user: User | null;
    horoscope: string | null;
    loading: boolean;
    setWallet: (wallet: string | null) => void;
    setUser: (user: User | null) => void;
    setHoroscope: (horoscope: string | null) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
}
