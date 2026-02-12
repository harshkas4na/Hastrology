# Hastrology Frontend

**Live at [hashtro.fun](https://hashtro.fun)**

Next.js 15 frontend for the Hastrology cosmic trading platform with Privy wallet auth, Flash SDK trading, and animated horoscope cards.

## Quick Start

```bash
npm install
cp .env.example .env.local   # Add your keys (see below)
npm run dev                   # http://localhost:3000
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **State**: Zustand
- **Wallet**: Privy + Solana Wallet Adapter
- **Trading**: Flash SDK (Drift protocol perpetuals)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero |
| `/login` | Privy wallet auth + birth details form |
| `/cards` | Horoscope card display, trade execution, results |
| `/link-x` | Twitter/X OAuth integration |

## Key Components

- **`HoroscopeReveal`** — Flippable astro card (front: shareable hooks, back: deep insights) with verified/unverified badge
- **`TradeModal`** — 30-second leveraged trade execution via Flash SDK with live PnL chart
- **`TradeResults`** — Post-trade results with verification status
- **`AstroCard`** — Shareable card with X/Twitter sharing
- **`WalletDropdown`** — Wallet info and disconnect

## Structure

```
├── app/
│   ├── cards/page.tsx       # Main horoscope + trade flow
│   ├── login/page.tsx       # Auth + birth details
│   └── hooks/               # usePrivyWallet, Zustand hooks
├── components/              # UI components
├── lib/
│   ├── api.ts               # Backend API client
│   ├── flash-trade.ts       # Flash SDK integration
│   ├── hastrology_program.ts # Solana program interactions
│   └── geocoding.ts         # Location services
├── store/useStore.ts        # Zustand global state
└── types/index.ts           # TypeScript interfaces
```

## Trade Direction

Direction is determined by `card.front.luck_score`:
- `luck_score > 50` → **LONG** (bullish)
- `luck_score <= 50` → **SHORT** (bearish)

Leverage comes from the lucky number. The trade runs for 30 seconds on Flash SDK perpetuals.

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-rpc.publicnode.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Twitter OAuth (for X sharing)
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
```

## Scripts

```bash
npm run dev       # Development server
npm run build     # Production build
npm run start     # Start production
npm run lint      # ESLint
```

## License

ISC
