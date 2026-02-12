# Hastrology Backend Server

Node.js/Express API layer for the Hastrology platform. Handles user management, horoscope generation orchestration, trade verification, and Solana transaction verification.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your Supabase + JWT keys
npm run dev            # http://localhost:5001
```

## Architecture

```
src/
├── config/          # Supabase client, logger (Winston), env validation
├── services/        # Business logic
│   ├── user.service.js        # User CRUD, birth details, Twitter
│   ├── horoscope.service.js   # Horoscope CRUD, verification status
│   ├── ai.service.js          # AI server client
│   ├── solana.service.js      # On-chain transaction verification
│   ├── twitter.service.js     # X/Twitter context enrichment
│   └── auth.service.js        # JWT authentication
├── controllers/     # Request handlers
├── routes/          # API route definitions
├── middleware/       # Validation (Joi), rate limiting, error handling
├── database/        # SQL schema
└── utils/           # Response helpers
```

## API Endpoints

### User Routes (`/api/user`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register user with wallet + Twitter details |
| POST | `/birth-details` | Update birth details (DOB, time, place, coordinates) |
| GET | `/profile/:wallet` | Get user profile |
| POST | `/x-account` | Link Twitter/X account |
| PATCH | `/twitter-tokens` | Refresh Twitter OAuth tokens |
| POST | `/trade-time` | Record trade timestamp |

### Horoscope Routes (`/api/horoscope`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status?walletAddress=...` | Check today's horoscope status (includes `verified` flag) |
| POST | `/confirm` | Generate horoscope via AI server (free mode, no payment required) |
| POST | `/verify` | Verify horoscope via profitable trade — requires `walletAddress`, `txSig`, `pnlPercent >= 0` |
| GET | `/history/:wallet?limit=10` | Get past horoscopes with `verified` status |

### Health

```
GET /api/health
GET /api/debug/routes   # List all registered routes
```

## Database Schema

Tables in Supabase (PostgreSQL):

- **`users`** — wallet_address (unique), dob, birth_time, birth_place, lat/long, timezone, Twitter credentials, trade_made_at
- **`horoscopes`** — wallet_address, date, horoscope_text (JSON card data), verified (boolean), UNIQUE(wallet_address, date)

Schema file: `src/database/schema.sql`

Row-Level Security (RLS) enabled. Service role has full access.

## Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
AI_SERVER_URL=http://127.0.0.1:8000
PORT=5001
NODE_ENV=development
JWT_SECRET=your-32-byte-hex     # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ALLOWED_ORIGINS=*
SOLANA_NETWORK=mainnet-beta     # or devnet
```

## Scripts

```bash
npm run dev    # Development with nodemon
npm start      # Production
npm test       # Tests
```

## Security

- Helmet.js security headers
- Joi schema validation on all POST endpoints
- Rate limiting (general + strict per endpoint)
- JWT authentication for protected routes
- Supabase RLS policies
- `trust proxy` configured for deployment behind proxies

## Docker

```bash
docker build -t hastrology-backend .
docker run -p 5001:5001 --env-file .env hastrology-backend
```

## License

ISC
