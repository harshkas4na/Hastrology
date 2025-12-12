export interface BirthDetails {
    walletAddress: string;
    dob: string;
    birthTime: string;
    birthPlace: string;
}

// Card type identifiers
export type CardType =
    | 'overall_vibe'
    | 'shine'
    | 'health'
    | 'wealth'
    | 'career'
    | 'love'
    | 'social'
    | 'growth'
    | 'luck'
    | 'wild_card';

// Individual astro card structure
export interface AstroCard {
    title: string;
    tagline: string;
    content: string;
    footer: string;
}

// Cards data from API
export interface AstroCardsData {
    cards: Record<CardType, AstroCard>;
    cached?: boolean;
}

// Card with type and color info for frontend rendering
export interface AstroCardWithMeta extends AstroCard {
    type: CardType;
    color: string;
    gradient: string;
}

// Color mapping for each card type - Spotify Wrapped inspired
export const CARD_COLORS: Record<CardType, { color: string; gradient: string }> = {
    overall_vibe: { color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA 0%, #7C3AED 100%)' },
    shine: { color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
    health: { color: '#EAB308', gradient: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)' },
    wealth: { color: '#7C3AED', gradient: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' },
    career: { color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' },
    love: { color: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
    social: { color: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' },
    growth: { color: '#22C55E', gradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' },
    luck: { color: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)' },
    wild_card: { color: '#F97316', gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' }
};

// Order of cards to display
export const CARD_ORDER: CardType[] = [
    'overall_vibe',
    'shine',
    'health',
    'wealth',
    'career',
    'love',
    'social',
    'growth',
    'luck',
    'wild_card'
];

export interface HoroscopeStatus {
    status: 'new_user' | 'clear_to_pay' | 'exists';
    horoscope?: string;
    cards?: Record<CardType, AstroCard>;
    date?: string;
}

export interface HoroscopeResponse {
    cards: Record<CardType, AstroCard>;
    date?: string;
}

export interface User {
    id: string;
    walletAddress: string;
    dob: string;
    birthTime: string;
    birthPlace: string;
    createdAt: string;
    name?: string;
    zodiacSign?: string;
}

export interface AppState {
    wallet: string | null;
    user: User | null;
    cards: Record<CardType, AstroCard> | null;
    loading: boolean;
    setWallet: (wallet: string | null) => void;
    setUser: (user: User | null) => void;
    setCards: (cards: Record<CardType, AstroCard> | null) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
}

