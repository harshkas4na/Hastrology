"""
Vercel serverless handler for FastAPI app
This module exports the FastAPI app for Vercel's Python runtime
"""
import sys
import os

# Add parent directory to path so we can import from main.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app from main.py
try:
    from main import app
    print("AI Server: Successfully imported app from main.py")
except Exception as e:
    print(f"AI Server: Failed to import app from main.py: {e}")
    # Re-raise so Vercel logs the stack trace
    raise e


