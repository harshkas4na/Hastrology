# Hastrology Frontend

Modern, minimalistic horoscope application built with Next.js 16, TypeScript, TailwindCSS, and Solana wallet integration.

## 🚀 Quick Start

```bash
npm install
cp .env.local .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎯 Features

- Solana wallet integration (Phantom, Solflare, Backpack)
- AI-powered daily horoscopes
- On-chain SOL payments
- Cosmic-themed UI with animations
- Share on X (coming soon)

## 📁 Structure

```
├── app/              # Next.js app router
├── components/       # React components
├── lib/             # Utilities (API calls)
├── store/           # Zustand state
└── types/           # TypeScript types
```

## 🔧 Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📝 License

ISC
