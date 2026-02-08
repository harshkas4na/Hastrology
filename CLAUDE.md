# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hastrology is a Solana-based AI-powered horoscope platform with three main components:
1. **Frontend** (Next.js 15 + TypeScript): User interface with Privy wallet integration, Flash SDK trading, and horoscope display
2. **Backend Server** (Node.js/Express): API layer handling user management, horoscope requests, and Solana transaction verification
3. **AI Server** (Python/FastAPI): Horoscope generation using Google Gemini AI with caching and astronomical calculations (pyswisseph)

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev      # Development server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Backend Server (Node.js)
```bash
cd backend_server
npm install
npm run dev      # Development with nodemon at http://localhost:5001
npm start        # Production server
npm test         # Run tests (currently not implemented)
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### AI Server (Python)
```bash
cd ai_server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  # Development at http://localhost:8000
uvicorn main:app           # Production
pytest                     # Run tests (currently not implemented)
```

For Python 3.14 compatibility issues:
```bash
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt
```

### Docker
```bash
docker-compose up -d       # Start all services
docker-compose logs -f     # View logs
docker-compose down        # Stop services
```

## Architecture & Data Flow

### Authentication & User Flow
1. **Wallet Connection**: Frontend uses Privy for Solana wallet authentication
2. **User Registration**: POST `/api/user/register` creates user record in Supabase with birth details (dob, birth_time, birth_place)
3. **Twitter Integration**: Optional Twitter OAuth for sharing horoscopes (stored in users table)

### Horoscope Generation Flow
1. User checks status: GET `/api/horoscope/status?walletAddress={address}`
2. Backend verifies if user can generate (one per day limit)
3. User initiates Solana payment transaction
4. Backend verifies transaction: POST `/api/horoscope/confirm` with signature
5. Backend calls AI server: POST `/generate_horoscope` with birth details
6. AI server generates horoscope using Gemini AI + Swiss Ephemeris astronomical data
7. Result cached in AI server (24h TTL) and stored in Supabase horoscopes table
8. Frontend displays horoscope with animations and sharing options

### Flash Trading Integration
- Frontend integrates Flash SDK for Solana token swaps (see `frontend/lib/flash-trade.ts`)
- Trading UI in `/trade` route with TradeExecution, TradeConfirm, and TradeResults components
- Uses Drift protocol integration via `@drift-labs/sdk`

### Database Schema (Supabase PostgreSQL)
- **users**: wallet_address (unique), dob, birth_time, birth_place, twitter credentials, lat/long, timezone
- **horoscopes**: user_id (FK), wallet_address, date, horoscope_text, UNIQUE(wallet_address, date)
- Row-Level Security (RLS) policies enabled, service role has full access
- Schema file: `backend_server/src/database/schema.sql`

## Key Technical Details

### Frontend Structure
- **App Router** (Next.js 15): Routes in `frontend/app/`
  - `/` - Landing page with Hero component
  - `/login` - Privy wallet authentication
  - `/cards` - Horoscope card display and generation
  - `/trade` - Flash trading interface
  - `/link-x` - Twitter integration
- **Components**: Reusable UI in `frontend/components/`
  - `AstroCard.tsx` - Horoscope card display with animations
  - `HoroscopeReveal.tsx` - Animated horoscope reveal
  - `TradeExecution.tsx`, `TradeConfirm.tsx`, `TradeResults.tsx` - Trading flow
  - `WalletContextProvider.tsx` - Solana wallet adapter setup
- **Lib**: Business logic in `frontend/lib/`
  - `api.ts` - Backend API client
  - `flash-trade.ts` - Flash SDK trading integration
  - `hastrology_program.ts` - Solana program interactions
  - `geocoding.ts` - Location services
  - `twitter.ts` - Twitter API integration
- **State Management**: Zustand (see hooks in `frontend/app/hooks/`)
- **Wallet**: Privy for auth + Solana Wallet Adapter for transactions

### Backend Structure
- **Entry**: `backend_server/index.js` - Express app setup with helmet, cors, compression
- **Config**: `src/config/` - Supabase client, logger (Winston), environment validation
- **Routes**: `src/routes/` - `/user`, `/horoscope`, `/debug` endpoints
- **Controllers**: `src/controllers/` - Request handlers
- **Services**: `src/services/` - Business logic (user, horoscope, AI client, auth, Solana verification)
- **Middleware**: `src/middleware/` - Rate limiting, error handling, request logging
- **Trust Proxy**: `app.set('trust proxy', 1)` configured for deployment behind proxies

### AI Server Structure
- **Entry**: `ai_server/main.py` - FastAPI app with lifespan events
- **Config**: `src/config/` - Pydantic settings, logger
- **Routes**: `src/routes/horoscope_routes.py` - `/generate_horoscope` endpoint
- **Services**: `src/services/`
  - `horoscope_service.py` - Gemini AI integration with LangChain
  - `cache_service.py` - In-memory caching (24h TTL)
  - `astronomical_service.py` - Swiss Ephemeris calculations
- **Models**: `src/models/` - Pydantic request/response schemas
- **Middleware**: `src/middleware/` - SlowAPI rate limiting, error handlers
- **Knowledge**: `src/knowledge/` - Astrology data and prompts for AI

### Environment Variables

**Backend (.env)**:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` - Database
- `AI_SERVER_URL` - Python AI server endpoint (default: http://127.0.0.1:8000)
- `JWT_SECRET` - Generated 32-byte hex string
- `PORT` - Default 5001
- `ALLOWED_ORIGINS` - CORS configuration
- `SOLANA_NETWORK` - devnet/mainnet

**AI Server (.env)**:
- `GOOGLE_API_KEY` - Gemini API key
- `HOST`, `PORT` - Default 127.0.0.1:8000
- `CACHE_ENABLED`, `CACHE_TTL_SECONDS` - Caching config
- `RATE_LIMIT_ENABLED`, `RATE_LIMIT_TIMES`, `RATE_LIMIT_SECONDS` - Rate limiting

**Frontend (.env.local)** (not in repo, create if needed):
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy authentication
- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL
- Twitter OAuth credentials if using Twitter integration

## Important Patterns

### Error Handling
- Backend: Centralized error handler middleware with Winston logging
- AI Server: FastAPI exception handlers for validation and general errors
- Frontend: Try-catch blocks with user-friendly error messages

### Security
- Helmet.js security headers on backend
- JWT authentication for protected routes
- Input validation: Joi (Node.js), Pydantic (Python)
- Supabase RLS policies for database access
- Rate limiting on both backend and AI server

### Caching Strategy
- AI server uses in-memory cache for identical birth chart requests (24h TTL)
- Supabase horoscopes table acts as persistent cache (one per user per day)
- Consider Redis for production distributed caching

### Solana Integration
- Transaction verification in `backend_server/src/services/solana.service.js`
- Program interactions in `frontend/lib/hastrology_program.ts`
- Flash trading in `frontend/lib/flash-trade.ts`
- Wallet adapter context in `frontend/components/WalletContextProvider.tsx`

### Next.js Configuration
- Webpack configured to exclude Node.js modules in browser bundle (fs, net, crypto, etc.)
- Externals for `@coral-xyz/anchor` compatibility
- Dev indicators disabled
- Static exports not used (SSR/ISR enabled)

## Common Development Tasks

### Adding a New API Endpoint
1. Backend: Create route in `backend_server/src/routes/`, controller in `src/controllers/`, service logic in `src/services/`
2. Register route in `src/routes/index.js`
3. Update validation schemas
4. Frontend: Add API call in `frontend/lib/api.ts`

### Modifying Horoscope Generation
1. Update prompts in `ai_server/src/prompts/` or knowledge in `src/knowledge/`
2. Modify `ai_server/src/services/horoscope_service.py` for logic changes
3. Clear cache: `cache_service.clear()` or restart AI server

### Database Changes
1. Update schema in `backend_server/src/database/schema.sql`
2. Run SQL in Supabase SQL Editor
3. Update affected services and models
4. Test with seed data

### Frontend Component Development
1. Create component in `frontend/components/`
2. Use Tailwind CSS for styling (v4.x)
3. Use Framer Motion for animations
4. Follow existing patterns (AstroCard, HoroscopeReveal)

## Testing the Full Flow

```bash
# 1. Register user
curl -X POST "http://localhost:5001/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_WALLET_ADDRESS",
    "dob": "April 20, 1995",
    "birthTime": "4:30 PM",
    "birthPlace": "New Delhi, India"
  }'

# 2. Check status
curl "http://localhost:5001/api/horoscope/status?walletAddress=YOUR_WALLET_ADDRESS"

# 3. Generate horoscope (after payment)
curl -X POST "http://localhost:5001/api/horoscope/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_WALLET_ADDRESS",
    "signature": "TRANSACTION_SIGNATURE"
  }'

# 4. Get history
curl "http://localhost:5001/api/horoscope/history/YOUR_WALLET_ADDRESS?limit=10"

# 5. Test AI server directly
curl -X POST "http://localhost:8000/generate_horoscope" \
  -H "Content-Type: application/json" \
  -d '{
    "dob": "April 20, 1995",
    "birth_time": "4:30 PM",
    "birth_place": "New Delhi, India"
  }'
```

## Deployment Considerations

- Backend and AI server can run in separate containers (docker-compose.yml provided)
- Frontend deployed separately (Vercel recommended for Next.js)
- Ensure `trust proxy` setting for production (already configured)
- Use production Supabase instance with proper RLS policies
- Switch `SOLANA_NETWORK` to mainnet for production
- Configure proper CORS origins in production
- Use Redis for distributed caching in production
- Monitor rate limits and adjust as needed
