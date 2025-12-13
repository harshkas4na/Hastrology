"""
Vercel serverless handler for FastAPI app
This module exports the FastAPI app for Vercel's Python runtime
"""
import sys
import os

# Add parent directory to path so we can import from main.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app from main.py
from main import app

# Vercel expects 'app' or 'handler' to be the ASGI application
handler = app
