# Horoscope App Backend Server (Node.js / Express)

This is the main backend "hub" for the Horoscope app. It connects to a MongoDB database, handles all user logic, and communicates with the Python AI server to get horoscopes.

## 🚀 Prerequisites

Before you begin, you will need:
* [Node.js (LTS version)](https://nodejs.org/en)
* A **MongoDB Atlas** account. You need a (free) cluster for this.
* The **AI Server** (from the `ai_server` project) must be **running** at `http://127.0.0.1:8000`.

## 🛠️ Setup Instructions

1.  **Clone the Repository**
    ```bash
    git clone <your-repo-url>
    cd backend_server
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

## ⚙️ Configuration

This server is configured using a `.env` file. This setup is **critical**.

1.  **Set up MongoDB Atlas:**
    * Create a new free "M0" cluster on MongoDB Atlas.
    * In `Database Access`, create a new database user (e.g., `horoscopeUser` / `a-strong-password`).
    * In `Network Access`, add your computer's IP address (or click `Allow Access From Anywhere` for development).
    * Click `Database` -> `Connect` -> `Drivers` and copy the **Connection String**.

2.  **Create `.env` File:**
    * Create a file named `.env` in the `backend_server` root folder.
    * Add the following variables:

    ```.env
    # 1. Paste your MongoDB connection string.
    # 2. Replace <username> and <password> with your DB user's credentials.
    # 3. Name the database (e.g., "horoscopeDB") before the "?".
    MONGO_URI="mongodb+srv://<username>:<password>@your-cluster.mongodb.net/horoscopeDB?retryWrites=true&w=majority"

    # URL of the running Python AI server
    AI_SERVER_URL="[http://127.0.0.1:8000](http://127.0.0.1:8000)"

    # Port for this Node.js server to run on
    PORT=5001
    ```

## ▶️ Running the Server

Once your `.env` file is saved, you can start the server:

```bash
npm run dev
```

You should see two messages:

MongoDB Connected...

Server running on port 5001

🧪 API Endpoints
You can test the server with curl or Postman:

Register a new user:

curl -X POST "http://localhost:5001/api/user/register" -H "Content-Type: application/json" -d '{"walletAddress": "MyTestWallet123", "dob": "Jan 1, 1990", "birthTime": "12:00 PM", "birthPlace": "London, UK"}'
Check a user's status:


curl "http://localhost:5001/api/horoscope/status?walletAddress=MyTestWallet123"
Returns {"status":"new_user"} or {"status":"clear_to_pay"} or {"status":"exists", ...}

Confirm a (mock) payment:

curl -X POST "http://localhost:5001/api/horoscope/confirm" -H "Content-Type: application/json" -d '{"walletAddress": "MyTestWallet123", "signature": "fake_sig"}'