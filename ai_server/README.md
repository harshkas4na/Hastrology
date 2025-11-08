# AI Horoscope Server (Python / FastAPI)

This server is a simple microservice that does one job: it receives a user's birth details and returns a unique, AI-generated horoscope using Google Gemini and LangChain.

## 🚀 Prerequisites

Before you begin, you will need:
* [Python 3.10+](https://www.python.org/downloads/)
* A **Google Gemini API Key**. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

## 🛠️ Setup Instructions

1.  **Clone the Repository**
    ```bash
    git clone <your-repo-url>
    cd ai_server
    ```

2.  **Create and Activate Virtual Environment**
    * On macOS/Linux:
        ```bash
        python3 -m venv venv
        source venv/bin/activate
        ```
    * On Windows:
        ```bash
        python -m venv venv
        .\venv\Scripts\activate
        ```

3.  **Install Dependencies**
    ```bash
    pip3 install fastapi "uvicorn[standard]" langchain langchain-google-genai python-dotenv
    ```

## ⚙️ Configuration

This server is configured using a `.env` file.

1.  Create a new file named `.env` in the `ai_server` root folder.
2.  Add your Google Gemini API key to it:

    ```.env
    GOOGLE_API_KEY="your-gemini-api-key-goes-here"
    ```

## ▶️ Running the Server

With your virtual environment active, run the following command:

```bash
uvicorn main:app --reload
```

The server will start on http://127.0.0.1:8000. The --reload flag means it will automatically restart if you make any code changes.

🧪 Testing

You can test if the server is working by sending a curl request from a new terminal:

Bash

curl -X POST "[http://127.0.0.1:8000/generate_horoscope](http://127.0.0.1:8000/generate_horoscope)" \
-H "Content-Type: application/json" \
-d '{
    "dob": "April 20, 1995",
    "birth_time": "4:30 PM",
    "birth_place": "New Delhi, India"
}'
You should receive a JSON response with your horoscope text.