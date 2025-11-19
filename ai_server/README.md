# Hastrology AI Server

AI-powered horoscope generation service using FastAPI, LangChain, and Google Gemini.

## 🏗️ Architecture

Modular Python architecture for scalability and maintainability:

```
src/
├── config/          Settings & logging configuration
├── services/        Business logic (AI, caching)
├── models/          Pydantic request/response models
├── routes/          FastAPI route handlers
└── middleware/      Error handling & rate limiting
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Google Gemini API key

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your API key
```

### Required Environment Variables

```bash
# Google AI (get from https://aistudio.google.com/app/apikey)
GOOGLE_API_KEY=your-api-key-here

# Server Configuration
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=development

# Logging
LOG_LEVEL=INFO

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL_SECONDS=86400  # 24 hours

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_TIMES=10
RATE_LIMIT_SECONDS=60
```

### Running

```bash
# Development (with hot reload)
uvicorn main:app --reload

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

Server will start on `http://localhost:8000`

## 📡 API Endpoints

### Interactive Documentation
```
http://localhost:8000/docs       Swagger UI
http://localhost:8000/redoc      ReDoc
```

### Horoscope Generation
```
POST /generate_horoscope
Content-Type: application/json

{
  "dob": "April 20, 1995",
  "birth_time": "4:30 PM",
  "birth_place": "New Delhi, India"
}
```

### Health Check
```
GET /
```

### Cache Management
```
GET  /cache/stats    Get cache statistics
POST /cache/clear    Clear all cache
```

## ⚡ Features

### Smart Caching
- In-memory cache with TTL
- Reduces API costs significantly
- Configurable expiration (default 24h)
- MD5-based cache keys

### Rate Limiting
- SlowAPI integration
- Configurable limits per endpoint
- IP-based tracking
- Prevents API abuse

### Error Handling
- Comprehensive exception handling
- Detailed validation errors
- Production-safe error messages
- Full request/response logging

### Request Validation
- Pydantic models for type safety
- Automatic validation
- Clear error messages
- API documentation generation

## 🏃 Development

### Project Structure

- **config/**: Settings (Pydantic) and logging setup
- **services/**: AI generation and caching logic
- **models/**: Request/response Pydantic models
- **routes/**: FastAPI endpoints
- **middleware/**: Error handlers and rate limiting

### Adding New Features

1. Define models in `src/models/`
2. Create service in `src/services/`
3. Add routes in `src/routes/`
4. Update `main.py` to include router

## 📦 Dependencies

**Core:**
- `fastapi` - Modern web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation
- `pydantic-settings` - Settings management

**AI:**
- `langchain` - LLM orchestration
- `langchain-google-genai` - Gemini integration

**Utilities:**
- `slowapi` - Rate limiting
- `python-dotenv` - Environment management

## 🐳 Docker

```bash
# Build image
docker build -t hastrology-ai .

# Run container
docker run -p 8000:8000 --env-file .env hastrology-ai
```

## 🔍 Monitoring

### Cache Performance
Check cache hit rates and optimize TTL:
```bash
curl http://localhost:8000/cache/stats
```

### Logs
Logs include:
- Request/response details
- Cache hits/misses
- AI generation metrics
- Error stack traces

## 📝 License

ISC