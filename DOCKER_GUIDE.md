# 🐳 Docker Setup Guide for Hastrology

This guide explains the Docker configuration I created and how to run your Hastrology platform in containers.

## 📚 What is Docker and Why Use It?

**Docker** packages your application and all its dependencies into **containers** - isolated, portable units that run the same way everywhere.

**Benefits:**
- ✅ **Consistency**: Works the same on your Mac, colleague's Windows, and production servers
- ✅ **Isolation**: Each service runs in its own environment
- ✅ **Easy Deployment**: One command to start everything
- ✅ **Scalability**: Easy to run multiple instances
- ✅ **No "Works on My Machine"**: Dependencies are bundled

## 🏗️ Docker Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Docker Compose Orchestrator         │
│  (Manages all containers and networking)    │
└─────────────────────────────────────────────┘
           │           │            │
    ┌──────┴──────┐  ┌┴────────┐  ┌┴──────┐
    │  Backend    │  │   AI    │  │ Redis │
    │  Container  │  │Container│  │ Cache │
    │  (Node.js)  │  │(Python) │  │       │
    └─────────────┘  └─────────┘  └───────┘
```

## 📄 File Breakdown

### 1. Backend Dockerfile

**Location**: `backend_server/Dockerfile`

```dockerfile
FROM node:20-alpine
```
- **What**: Starts from official Node.js 20 image based on Alpine Linux
- **Why Alpine**: Tiny Linux distribution (5MB vs 200MB+), faster downloads

```dockerfile
WORKDIR /app
```
- **What**: Sets working directory inside container to `/app`
- **Why**: All subsequent commands run from this directory

```dockerfile
COPY package*.json ./
RUN npm ci --only=production
```
- **What**: Copy package files first, then install dependencies
- **Why**: Docker caching! If package.json doesn't change, this layer is reused
- **npm ci**: Clean install, faster and more reliable for production

```dockerfile
COPY . .
```
- **What**: Copy all application code
- **Why**: Done after dependencies so code changes don't invalidate dependency cache

```dockerfile
EXPOSE 5001
```
- **What**: Documents that container listens on port 5001
- **Why**: Informational for developers and orchestrators

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"
```
- **What**: Docker regularly checks if container is healthy
- **interval**: Check every 30 seconds
- **timeout**: Wait 10 seconds for response
- **start-period**: Wait 40 seconds before first check (startup time)
- **retries**: 3 failures before marking unhealthy
- **Why**: Auto-restart unhealthy containers, load balancers can route around them

```dockerfile
CMD ["node", "index.js"]
```
- **What**: Default command when container starts
- **Why**: Runs your application

### 2. AI Server Dockerfile

**Location**: `ai_server/Dockerfile`

```dockerfile
FROM python:3.11-slim
```
- **What**: Python 3.11 on Debian Slim
- **Why**: Using 3.11 instead of 3.14 for better compatibility (Pydantic issues)
- **slim**: Smaller than full Debian (~150MB vs 900MB)

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
```
- **What**: Install build tools, then clean up
- **Why**: Needed to compile some Python packages (pydantic-core)
- **--no-install-recommends**: Don't install suggested packages
- **rm -rf /var/.../lists/**: Delete package lists to save space

```dockerfile
RUN pip install --no-cache-dir -r requirements.txt
```
- **What**: Install Python dependencies
- **--no-cache-dir**: Don't cache pip downloads (saves ~100MB)

### 3. Docker Compose File

**Location**: `docker-compose.yml`

**Purpose**: Orchestrates multiple containers, manages networking and dependencies

```yaml
version: '3.8'
```
- **What**: Docker Compose file format version
- **Why**: 3.8 is stable and widely supported

```yaml
services:
  backend:
    build:
      context: ./backend_server
      dockerfile: Dockerfile
```
- **What**: Defines a service named "backend"
- **build**: Build image from Dockerfile
- **context**: Root directory for build (where to find files)

```yaml
    ports:
      - "5001:5001"
```
- **What**: Map host port 5001 to container port 5001
- **Format**: "HOST:CONTAINER"
- **Why**: Access container from your machine at localhost:5001

```yaml
    environment:
      - NODE_ENV=production
      - PORT=5001
```
- **What**: Set environment variables inside container
- **Why**: Override .env file values for Docker environment

```yaml
    env_file:
      - ./backend_server/.env
```
- **What**: Load remaining environment variables from .env file
- **Why**: Keep secrets out of docker-compose.yml

```yaml
    depends_on:
      - ai_server
      - redis
```
- **What**: Start ai_server and redis before backend
- **Why**: Backend needs these services to be ready

```yaml
    restart: unless-stopped
```
- **What**: Auto-restart policy
- **Why**: Restart if crashes, but stop if manually stopped

```yaml
    networks:
      - hastrology-network
```
- **What**: Connect to custom network
- **Why**: Containers can communicate using service names as hostnames

```yaml
    healthcheck:
      test: ["CMD", "node", "-e", "..."]
      interval: 30s
      timeout: 10s
      retries: 3
```
- **What**: Same as Dockerfile HEALTHCHECK
- **Why**: Can override or configure from compose file

```yaml
  redis:
    image: redis:7-alpine
```
- **What**: Use official Redis 7 image (doesn't need custom Dockerfile)
- **Why**: Pre-built Redis works perfectly

```yaml
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```
- **What**: Override default Redis command
- **maxmemory**: Limit Redis to 256MB RAM
- **maxmemory-policy**: When full, evict least recently used keys
- **Why**: Good for caching, prevents memory bloat

```yaml
    volumes:
      - redis-data:/data
```
- **What**: Mount named volume for Redis data
- **Why**: Persists data even if container is deleted

```yaml
volumes:
  redis-data:
    driver: local
```
- **What**: Define named volume using local driver
- **Why**: Stores data on host machine's disk

```yaml
networks:
  hastrology-network:
    driver: bridge
```
- **What**: Create custom bridge network
- **Why**: Isolated network for your services

## 🔧 How Docker Compose Works

When you run `docker-compose up -d`:

1. **Creates Network**: `hastrology-network` bridge network
2. **Builds Images**: 
   - Reads backend Dockerfile → builds Node.js image
   - Reads AI Dockerfile → builds Python image
   - Pulls Redis image from Docker Hub
3. **Creates Volumes**: `redis-data` volume on host
4. **Starts Containers** (in dependency order):
   - Redis first (no dependencies)
   - AI server next (depends on redis)
   - Backend last (depends on both)
5. **Configures Networking**: All containers can reach each other by name
6. **Health Checks**: Monitors container health

## 🌐 Container Networking

Inside the Docker network:
- Backend can reach AI server at: `http://ai_server:8000`
- Backend can reach Redis at: `redis:6379`
- Services use **service names** as hostnames

From your machine:
- Backend: `http://localhost:5001`
- AI server: `http://localhost:8000`
- Redis: `localhost:6379`

## 📋 Common Docker Commands

```bash
# Build and start all containers
docker compose up -d

# View logs
docker compose logs -f              # All services
docker compose logs -f backend      # Just backend
docker compose logs -f ai_server    # Just AI server

# Stop all containers
docker compose stop

# Stop and remove containers
docker compose down

# Rebuild after code changes
docker compose up -d --build

# View running containers
docker compose ps

# Execute command in running container
docker compose exec backend sh      # Open shell in backend
docker compose exec ai_server bash  # Open shell in AI server

# View resource usage
docker stats

# Remove everything (containers, networks, volumes)
docker compose down -v
```

## 🔄 Development Workflow with Docker

### Making Code Changes:

**For quick testing** (without Docker):
- Just edit code and let nodemon/uvicorn auto-reload

**To test in Docker**:
```bash
# Rebuild and restart
docker compose up -d --build

# Or rebuild specific service
docker compose up -d --build backend
```

### Debugging:

```bash
# View backend logs
docker compose logs -f backend

# Enter backend container
docker compose exec backend sh
ls -la                    # List files
cat .env                  # View environment
npm list                  # See installed packages

# Enter AI server container
docker compose exec ai_server bash
pip list                  # See Python packages
python -c "import src.config.settings as s; print(s.settings)"
```

## 🎯 Why This Setup is Production-Ready

### Multi-Stage Builds (Could Add)
Current Dockerfiles are single-stage. For even smaller images:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["node", "index.js"]
```

### Security Best Practices
- ✅ Non-root user (could add)
- ✅ Minimal base images (alpine, slim)
- ✅ No secrets in Dockerfile
- ✅ Health checks
- ✅ Resource limits

### Scalability
```bash
# Run 3 backend instances
docker compose up -d --scale backend=3

# Add load balancer (nginx) in front
```

## 🚀 Next Steps: Installing Docker

Since `docker compose` isn't working, you need:

**macOS**:
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
2. Open Docker Desktop app
3. Wait for Docker engine to start (whale icon in menu bar)
4. Try again: `docker compose up -d`

**Alternative (using Homebrew)**:
```bash
brew install docker docker-compose
```

## 📊 Comparison: Local vs Docker

| Aspect | Local Development | Docker |
|--------|------------------|--------|
| Setup Time | Fast (if deps installed) | Slower first time |
| Consistency | ❌ Varies by machine | ✅ Identical everywhere |
| Isolation | ❌ Shares system | ✅ Fully isolated |
| Resource Usage | Lower | Higher (overhead) |
| Cleanup | Manual | `docker compose down` |
| Production Parity | ❌ Different | ✅ Same as prod |

## 🎓 Key Takeaways

1. **Dockerfile** = Recipe for building an image
2. **Image** = Template/snapshot of your app
3. **Container** = Running instance of an image
4. **Docker Compose** = Tool to manage multiple containers
5. **Volumes** = Persistent data storage
6. **Networks** = How containers communicate
7. **Health Checks** = Automatic monitoring

---

**Ready to try Docker?** Install Docker Desktop and run `docker compose up -d`! 🐳
