# 🚀 Hastrology Complete Setup Guide

This guide will walk you through setting up the entire Hastrology platform from scratch.

## 📋 Prerequisites Checklist

- [ ] Node.js 20+ installed
- [ ] Python 3.11+ installed  
- [ ] Git installed
- [ ] Code editor (VS Code recommended)

## 🔑 Step 1: Get Your API Keys

### 1.1 Supabase Setup (5 minutes)

1. Go to https://supabase.com and sign in/up
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `hastrology` (or your choice)
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose closest to you
4. Click **"Create new project"** and wait ~2 minutes
5. Once ready, click **"Project Settings"** (gear icon) → **"API"**
6. **Copy these 3 values** (you'll need them soon):
   - **Project URL** → This is your `SUPABASE_URL`
   - **Project API keys** → `anon` `public` → This is your `SUPABASE_ANON_KEY`
   - **Project API keys** → `service_role` `secret` → This is your `SUPABASE_SERVICE_KEY` ⚠️

> ⚠️ **IMPORTANT**: Never share your `service_role` key publicly!

### 1.2 Google Gemini API Key (2 minutes)

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Choose **"Create API key in new project"**
5. **Copy the key** → This is your `GOOGLE_API_KEY`

## 🗄️ Step 2: Setup Supabase Database

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open `backend_server/src/database/schema.sql` from this project
4. **Copy ALL the SQL code**
5. **Paste it** into the Supabase SQL Editor
6. Click **"Run"** (or press Ctrl/Cmd + Enter)
7. You should see: ✅ **"Success. No rows returned"**

This creates:
- `users` table
- `horoscopes` table
- Security policies
- Indexes
- Triggers

## 💻 Step 3: Setup Backend Server

```bash
# Navigate to backend directory
cd backend_server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Edit `.env` file:

Open `.env` in your editor and fill in:

```bash
# Paste your Supabase credentials from Step 1.1
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...

# AI Server URL (leave as is for local development)
AI_SERVER_URL=http://127.0.0.1:8000

# Server Configuration
PORT=5001
NODE_ENV=development

# Generate JWT_SECRET (run this command in terminal):
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=paste-generated-secret-here

# Rate Limiting (default values work well)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS (use * for development, specific domains for production)
ALLOWED_ORIGINS=*

# Solana Network
SOLANA_NETWORK=devnet
```

### Generate JWT Secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as `JWT_SECRET` in `.env`

### Start the Backend:

```bash
npm run dev
```

You should see:
```
✓ Supabase connection successful
🚀 Server running on port 5001
```

Leave this terminal running! ✅

## 🤖 Step 4: Setup AI Server

Open a **NEW terminal window**:

```bash
# Navigate to AI server directory
cd ai_server

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
# If you have Python 3.14, use this command instead:
# PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### Edit `.env` file:

```bash
# Paste your Google Gemini API key from Step 1.2
GOOGLE_API_KEY=your-gemini-api-key-here

# Server Configuration (leave defaults)
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=development

# Logging
LOG_LEVEL=INFO

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL_SECONDS=86400

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_TIMES=10
RATE_LIMIT_SECONDS=60
```

### Start the AI Server:

```bash
uvicorn main:app --reload
```

You should see:
```
🚀 Starting Hastrology AI Server
Gemini model initialized successfully
```

Leave this terminal running too! ✅

## ✅ Step 5: Test Your Setup

### 5.1 Test AI Server

Open a **THIRD terminal** and run:

```bash
curl -X POST "http://localhost:8000/generate_horoscope" \
  -H "Content-Type: application/json" \
  -d '{
    "dob": "April 20, 1995",
    "birth_time": "4:30 PM",
    "birth_place": "New Delhi, India"
  }'
```

**Expected**: You should get a JSON response with a personalized horoscope! 🎉

### 5.2 Test Backend Server

#### Register a User:

```bash
curl -X POST "http://localhost:5001/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "A5bnR8jMvf9z81w7RsazLVuGUF5QYiKiJarWxzTKQGtF",
    "dob": "April 20, 1995",
    "birthTime": "4:30 PM",
    "birthPlace": "New Delhi, India"
  }'
```

**Expected**: JSON response with user details and a JWT token

#### Check Status:

```bash
curl "http://localhost:5001/api/horoscope/status?walletAddress=A5bnR8jMvf9z81w7RsazLVuGUF5QYiKiJarWxzTKQGtF"
```

**Expected**: `{"success":true,"status":"clear_to_pay"}`

#### Generate Horoscope:

```bash
curl -X POST "http://localhost:5001/api/horoscope/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "A5bnR8jMvf9z81w7RsazLVuGUF5QYiKiJarWxzTKQGtF",
    "signature": "test_signature"
  }'
```

**Expected**: JSON response with your horoscope text! 🌟

## 🐳 Alternative: Docker Setup (Optional)

If you prefer Docker:

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🎯 Quick Reference

### Useful URLs

- **Backend API**: http://localhost:5001/api
- **Backend Health**: http://localhost:5001/api/health
- **AI Server**: http://localhost:8000
- **AI Server Docs**: http://localhost:8000/docs
- **Supabase Dashboard**: https://supabase.com/dashboard

### Common Commands

```bash
# Backend
cd backend_server
npm run dev          # Development server
npm start            # Production server

# AI Server
cd ai_server
source venv/bin/activate  # Activate venv
uvicorn main:app --reload  # Development
uvicorn main:app  # Production
```

## 🐛 Troubleshooting

### Backend won't start

- ✅ Check all environment variables are set in `.env`
- ✅ Verify Supabase credentials are correct
- ✅ Run `npm install` again
- ✅ Check if port 5001 is already in use

### AI Server errors

**Python 3.14 Installation Issue**:
If you get an error about "PyO3's maximum supported version (3.13)", run:
```bash
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt
```

**Other AI Server Issues**:
- ✅ Check `GOOGLE_API_KEY` is valid
- ✅ Ensure virtual environment is activated
- ✅ Run `pip install -r requirements.txt` again
- ✅ Check if port 8000 is already in use

### Database errors

- ✅ Verify you ran the `schema.sql` in Supabase
- ✅ Check Supabase project is active (not paused)
- ✅ Verify network connection to Supabase

### Cache not working

- ✅ Check `CACHE_ENABLED=true` in AI server `.env`
- ✅ Restart AI server
- ✅ Clear cache: `curl -X POST http://localhost:8000/cache/clear`

## 📚 Next Steps

1. **Explore the API**: Check http://localhost:8000/docs for interactive API docs
2. **Review logs**: Both servers provide detailed logging
3. **Customize**: Modify prompts in `ai_server/src/services/horoscope_service.py`
4. **Deploy**: Use Docker Compose for production deployment
5. **Scale**: Add Redis for distributed caching

## 🎉 You're All Set!

Your Hastrology platform is now running with:
- ✅ Modular, scalable architecture
- ✅ Supabase PostgreSQL database
- ✅ AI-powered horoscope generation
- ✅ Smart caching
- ✅ Rate limiting
- ✅ Security best practices
- ✅ Comprehensive logging

Happy coding! 🚀
