# Hastrology - AI-Powered Horoscope Platform

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.11-green.svg)

> Modern, scalable horoscope generation platform with Supabase backend and AI-powered insights using Google Gemini.

## 🌟 Features

- **AI-Powered Horoscopes**: Personalized horoscopes using Google Gemini AI
- **Modular Architecture**: Scalable, maintainable codebase with clear separation of concerns
- **Supabase Integration**: Modern PostgreSQL database with real-time capabilities and built-in Row-Level Security
- **Solana Integration**: Blockchain-based payment verification
- **Smart Caching**: Intelligent caching to reduce AI API costs
- **Rate Limiting**: Protection against abuse and excessive usage
- **Security First**: Helmet.js, input validation, JWT authentication, RLS policies
- **Docker Support**: Containerized deployment for consistency
- **Comprehensive Logging**: Winston (Node.js) and Python logging for debugging

## 📁 Project Structure

```
hastrology/
├── backend_server/          # Node.js/Express backend
│   ├── src/
│   │   ├── config/         # Configuration (Supabase, environment, logger)
│   │   ├── services/       # Business logic (user, horoscope, AI, auth, Solana)
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── database/       # SQL schemas and migrations
│   │   └── utils/          # Helper functions
│   ├── index.js           # Main application entry
│   ├── package.json
│   └── Dockerfile
│
├── ai_server/              # Python/FastAPI AI service
│   ├── src/
│   │   ├── config/        # Settings and logging
│   │   ├── services/      # Horoscope generation and caching
│   │   ├── models/        # Pydantic models
│   │   ├── routes/        # FastAPI routes
│   │   └── middleware/    # Error handling and rate limiting
│   ├── main.py           # FastAPI application
│   ├── requirements.txt
│   └── Dockerfile
│
└── docker-compose.yml     # Docker orchestration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Supabase account ([sign up free](https://supabase.com))
- Google Gemini API key ([get one free](https://aistudio.google.com/app/apikey))

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API**
3. Copy your `Project URL`, `anon public key`, and `service_role secret key`
4. Go to **SQL Editor** and run the schema from `backend_server/src/database/schema.sql`

### 2. Backend Server Setup

```bash
cd backend_server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your keys:
# - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
# - Generate JWT_SECRET using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Start development server
npm run dev
```

Backend will run on `http://localhost:5001`

### 3. AI Server Setup

```bash
cd ai_server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env and add your GOOGLE_API_KEY

# Start development server
uvicorn main:app --reload
```

AI Server will run on `http://localhost:8000`

### 4. Docker Deployment (Optional)

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 API Documentation

### Backend Server (`http://localhost:5001/api`)

#### User Registration
```bash
POST /api/user/register
Content-Type: application/json

{
  "walletAddress": "SolanaWalletAddress123...",
  "dob": "April 20, 1995",
  "birthTime": "4:30 PM",
  "birthPlace": "New Delhi, India"
}
```

#### Check Horoscope Status
```bash
GET /api/horoscope/status?walletAddress=SolanaWalletAddress123...
```

#### Generate Horoscope (after payment)
```bash
POST /api/horoscope/confirm
Content-Type: application/json

{
  "walletAddress": "SolanaWalletAddress123...",
  "signature": "transaction_signature_from_solana"
}
```

#### Get Horoscope History
```bash
GET /api/horoscope/history/SolanaWalletAddress123...?limit=10
```

### AI Server (`http://localhost:8000`)

Interactive API docs available at: `http://localhost:8000/docs`

#### Generate Horoscope
```bash
POST /generate_horoscope
Content-Type: application/json

{
  "dob": "April 20, 1995",
  "birth_time": "4:30 PM",
  "birth_place": "New Delhi, India"
}
```

## 🔒 Security Features

- **Helmet.js**: Security headers for Express
- **Rate Limiting**: Configurable limits on all endpoints
- **Input Validation**: Joi (Node.js) and Pydantic (Python) schemas
- **JWT Authentication**: Secure token-based auth
- **Row-Level Security**: Supabase RLS policies protect user data
- **Environment Validation**: Startup checks for required variables
- **CORS Configuration**: Configurable allowed origins

## 🛠️ Development

### Backend Development
```bash
cd backend_server
npm run dev  # Uses nodemon for hot reload
```

### AI Server Development
```bash
cd ai_server
uvicorn main:app --reload
```

### Running Tests
```bash
# Backend
cd backend_server
npm test

# AI Server
cd ai_server
pytest
```

## 📊 Environment Variables

See `.env.example` files in each directory for complete variable lists and descriptions.

**Key variables:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `GOOGLE_API_KEY`
- `JWT_SECRET` (generate with crypto)
- `AI_SERVER_URL` (backend → AI server communication)

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 💬 Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ using Node.js, Python, FastAPI, Supabase, and Google Gemini**
