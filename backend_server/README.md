# Hastrology Backend Server

Modern, scalable backend server for the Hastrology horoscope platform using Node.js, Express, and Supabase.

## 🏗️ Architecture

This server follows a modular, scalable architecture:

```
src/
├── config/          Configuration & initialization
├── services/        Business logic layer
├── controllers/     HTTP request handlers
├── routes/          API route definitions
├── middleware/      Express middleware
├── database/        SQL schemas & migrations
└── utils/           Helper functions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Supabase account
- Google Gemini API key (for AI server)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
```

### Required Environment Variables

```bash
# Supabase (get from Project Settings → API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# AI Server
AI_SERVER_URL=http://127.0.0.1:8000

# Server
PORT=5001
NODE_ENV=development

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your-random-secret-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=*
```

### Database Setup

1. Create a Supabase project
2. Run the SQL schema from `src/database/schema.sql` in Supabase SQL Editor
3. This creates:
   - `users` table with user information
   - `horoscopes` table for generated horoscopes
   - Row-Level Security (RLS) policies
   - Indexes for performance
   - Triggers for automatic timestamps

### Running

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:5001`

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### User Routes
```
POST /api/user/register          Register/update user
GET  /api/user/profile/:wallet   Get user profile
```

### Horoscope Routes
```
GET  /api/horoscope/status       Check horoscope status
POST /api/horoscope/confirm      Confirm payment & generate
GET  /api/horoscope/history/:wallet  Get past horoscopes
```

## 🔒 Security Features

- **Helmet.js**: Security headers
- **Rate Limiting**: Configurable per endpoint
- **Input Validation**: Joi schemas
- **JWT Authentication**: Token-based auth
- **CORS**: Configurable origins
- **Row-Level Security**: Supabase RLS

## 🏃 Development

### Project Structure

- **config/**: Environment validation, Supabase client, logger
- **services/**: Business logic (user, horoscope, AI, auth, Solana)
- **controllers/**: Request handlers
- **routes/**: API endpoint definitions
- **middleware/**: Error handling, validation, rate limiting, logging
- **utils/**: Response helpers and utilities

### Adding New Features

1. Create service in `src/services/`
2. Create controller in `src/controllers/`
3. Define routes in `src/routes/`
4. Add validation in `src/middleware/validation.js`

## 📦 Dependencies

**Production:**
- `express` - Web framework
- `@supabase/supabase-js` - Supabase client
- `helmet` - Security middleware
- `joi` - Schema validation
- `jsonwebtoken` - JWT auth
- `winston` - Logging
- `express-rate-limit` - Rate limiting
- `@solana/web3.js` - Solana integration

**Development:**
- `nodemon` - Hot reload

## 🐳 Docker

```bash
# Build image
docker build -t hastrology-backend .

# Run container
docker run -p 5001:5001 --env-file .env hastrology-backend
```

## 📝 License

ISC