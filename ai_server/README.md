# Hastrology AI Server

Python/FastAPI service that generates personalized horoscope cards using Google Gemini AI, Swiss Ephemeris astronomical calculations, and Vedic-Hellenistic astrology techniques.

## Quick Start

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Add GOOGLE_API_KEY
uvicorn main:app --reload   # http://localhost:8000
```

For Python 3.14+: `PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt`

## Architecture

```
src/
├── config/          # Pydantic settings, logging
├── services/
│   ├── horoscope_service.py     # Core generation: Gemini AI + chart data → astro card
│   ├── ephemeris_service.py     # Swiss Ephemeris natal chart calculations
│   ├── astro_calculator.py      # CDO builder, profections, aspects, dignity
│   └── cache_service.py         # In-memory cache (24h TTL, MD5 keys)
├── models/          # Pydantic request/response schemas
├── routes/          # FastAPI endpoints
├── prompts/         # AI prompt engineering (senior astrologer persona)
├── knowledge/       # Astrology data (zodiac signs, asset mappings, moods)
└── middleware/       # SlowAPI rate limiting, error handlers
```

## How Generation Works

1. **Parse birth data** — DOB, time, place, coordinates
2. **Compute Cosmic Data Object (CDO)** — Swiss Ephemeris calculates natal chart (planets, houses, Ascendant), current transits, aspects, dignity scores
3. **Build profections** — Annual profections determine Time Lord and active house
4. **Enrich with X context** — Twitter bio, recent tweets, inferred persona (optional)
5. **Generate via Gemini** — Senior astrologer prompt produces a dual-sided JSON card:
   - **Front**: tagline, hooks, luck_score, vibe_status, energy_emoji, zodiac_sign (Sun sign)
   - **Back**: detailed_reading, hustle_alpha, shadow_warning, lucky_assets
6. **Cache result** — 24h TTL keyed on birth data

### Key Rules

- **zodiac_sign** = Sun sign (from DOB only), NOT the Ascendant
- **luck_score > 50** = bullish (LONG trade), **<= 50** = bearish (SHORT trade)
- **vibe_status** must match luck_score: Stellar (80-100), Ascending (51-79), Shaky (40-50), Eclipse (0-39)
- **energy_emoji** must come from the matching bullish/bearish mood list

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate_horoscope` | Generate horoscope card from birth data |
| GET | `/` | Health check |
| GET | `/cache/stats` | Cache hit/miss statistics |
| POST | `/cache/clear` | Clear all cached entries |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc |

### Generate Horoscope

```bash
POST /generate_horoscope
Content-Type: application/json

{
  "dob": "2003-03-13",
  "birth_time": "14:30",
  "birth_place": "New Delhi, India",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "timezone_offset": 5.5,
  "x_handle": "username",
  "x_bio": "...",
  "x_recent_tweets": ["...", "..."],
  "x_persona": "builder"
}
```

## Environment Variables

```bash
GOOGLE_API_KEY=your-gemini-api-key
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=development
LOG_LEVEL=INFO
CACHE_ENABLED=true
CACHE_TTL_SECONDS=86400
RATE_LIMIT_ENABLED=true
RATE_LIMIT_TIMES=10
RATE_LIMIT_SECONDS=60
```

## Key Dependencies

- **fastapi** + **uvicorn** — Web framework + ASGI server
- **langchain** + **langchain-google-genai** — Gemini AI orchestration
- **pyswisseph** — Swiss Ephemeris for astronomical calculations
- **pydantic** / **pydantic-settings** — Data validation + config
- **slowapi** — Rate limiting

## Ephemeris Data

Swiss Ephemeris data files are in `ephe/`. These are required for accurate planetary position calculations.

## Docker

```bash
docker build -t hastrology-ai .
docker run -p 8000:8000 --env-file .env hastrology-ai
```

## License

ISC
