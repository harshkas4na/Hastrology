# Hastrology - AI-Powered Cosmic Trading Platform

**Live at [hashtro.fun](https://hashtro.fun)**

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.11-green.svg)

> Solana-based AI horoscope platform that generates personalized daily readings using Vedic-Hellenistic astrology and lets users verify predictions through real trades on Flash SDK.

## Features

- **AI Horoscopes**: Daily personalized readings powered by Google Gemini with Swiss Ephemeris astronomical calculations
- **Trade Verification**: Verify your horoscope by executing a 30-second leveraged trade derived from your cosmic data (direction, leverage, ticker all from your chart)
- **Solana Wallet Auth**: Privy-powered wallet authentication (Phantom, Solflare, Backpack)
- **Flash SDK Trading**: Real perpetual trades on Solana via Flash/Drift protocol
- **Twitter/X Integration**: Link your X account for persona-aware horoscopes based on your tweets and bio
- **Horoscope Persistence**: Verified status persists to database — reload and your badge stays
- **Smart Caching**: 24h TTL caching to reduce AI API costs
- **Security**: Helmet.js, Joi/Pydantic validation, rate limiting, Supabase RLS

## Architecture

```
hastrology/
├── frontend/               # Next.js 15 + TypeScript
│   ├── app/                # App Router (/, /login, /cards, /trade, /link-x)
│   ├── components/         # AstroCard, HoroscopeReveal, TradeModal, etc.
│   ├── lib/                # API client, Flash trade SDK, geocoding
│   ├── store/              # Zustand state management
│   └── types/              # TypeScript interfaces
│
├── backend_server/         # Node.js/Express API
│   └── src/
│       ├── config/         # Supabase, logger, env validation
│       ├── services/       # User, horoscope, AI client, Solana verification
│       ├── controllers/    # Request handlers
│       ├── routes/         # /user, /horoscope, /debug
│       ├── middleware/     # Rate limiting, validation, error handling
│       └── database/       # SQL schema
│
├── ai_server/              # Python/FastAPI AI service
│   └── src/
│       ├── config/         # Pydantic settings, logging
│       ├── services/       # Gemini AI, Swiss Ephemeris, caching
│       ├── models/         # Request/response schemas
│       ├── routes/         # /generate_horoscope
│       ├── prompts/        # Astrologer prompt engineering
│       └── knowledge/      # Astrology data, asset mappings
│
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Supabase account ([supabase.com](https://supabase.com))
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com/app/apikey))

### 1. Database Setup

1. Create a Supabase project
2. Run `backend_server/src/database/schema.sql` in the SQL Editor
3. Copy your Project URL, anon key, and service role key

### 2. Backend Server

```bash
cd backend_server
npm install
cp .env.example .env    # Add SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, JWT_SECRET
npm run dev             # http://localhost:5001
```

### 3. AI Server

```bash
cd ai_server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Add GOOGLE_API_KEY
uvicorn main:app --reload   # http://localhost:8000
```

### 4. Frontend

```bash
cd frontend
npm install
# Create .env.local with NEXT_PUBLIC_API_URL, NEXT_PUBLIC_PRIVY_APP_ID, etc.
npm run dev             # http://localhost:3000
```

### 5. Docker (Optional)

```bash
docker-compose up -d
docker-compose logs -f
```

## API Overview

### Backend (`/api`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/register` | Register user with wallet + Twitter |
| POST | `/user/birth-details` | Update birth details (DOB, time, place) |
| GET | `/user/profile/:wallet` | Get user profile |
| GET | `/horoscope/status?walletAddress=...` | Check today's horoscope status + verified flag |
| POST | `/horoscope/confirm` | Generate horoscope (free mode) |
| POST | `/horoscope/verify` | Verify horoscope via profitable trade (txSig + pnlPercent) |
| GET | `/horoscope/history/:wallet` | Get past horoscopes with verified status |

### AI Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate_horoscope` | Generate horoscope card from birth data |
| GET | `/cache/stats` | Cache hit/miss statistics |
| GET | `/docs` | Swagger UI |

## How It Works

1. **Connect Wallet** — Privy authenticates your Solana wallet
2. **Link X Account** — Optional Twitter OAuth for personalized readings
3. **Enter Birth Details** — DOB, time, and place for chart calculation
4. **Get Your Reading** — AI generates a dual-sided astro card (front: shareable hooks, back: deep insights)
5. **Verify with Trade** — Execute a 30-second leveraged trade on Flash SDK. Profitable trade = verified horoscope badge that persists

### Trade Direction Logic

The AI generates three linked fields that determine your trade:
- **luck_score** (0-100): >50 = LONG (bullish), <=50 = SHORT (bearish)
- **vibe_status**: Stellar/Ascending (bullish) or Shaky/Eclipse (bearish)
- **energy_emoji**: From bullish or bearish mood lists

Leverage is derived from your lucky number, ticker from your chart data.

## Environment Variables

See `.env.example` in each directory. Key variables:

| Variable | Location | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Backend | Service role key (full DB access) |
| `JWT_SECRET` | Backend | 32-byte hex string |
| `AI_SERVER_URL` | Backend | Python AI server endpoint |
| `GOOGLE_API_KEY` | AI Server | Gemini API key |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Frontend | Privy authentication |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API URL |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Frontend | Solana RPC endpoint |

## License

ISC

---

**Live at [hashtro.fun](https://hashtro.fun)** | Built with Next.js, Express, FastAPI, Solana, Google Gemini, and Swiss Ephemeris
