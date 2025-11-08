"""
FastAPI + LangChain Horoscope Generator
This application generates personalized horoscopes using Google's Gemini AI model.
"""

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Initialize FastAPI application
app = FastAPI(title="Horoscope Generator API")

# Define request model using Pydantic
class HoroscopeRequest(BaseModel):
    """
    Request model for horoscope generation.
    Accepts date of birth, birth time, and birth place.
    """
    dob: str
    birth_time: str
    birth_place: str

# Define the POST endpoint
@app.post("/generate_horoscope")
async def generate_horoscope(request: HoroscopeRequest):
    """
    Generate a personalized horoscope based on birth details.
    
    Args:
        request: HoroscopeRequest containing dob, birth_time, and birth_place
        
    Returns:
        JSON response with generated horoscope text
    """
    
    # Initialize the Gemini model
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash",google_api_key=os.getenv("GOOGLE_API_KEY"))
    
    # Create the prompt template with astrologer persona
    prompt = ChatPromptTemplate.from_template(
        "You are a professional astrologer with a witty, modern, and optimistic tone. "
        "Generate a 4-sentence horoscope for a user with the following details:\n"
        "   * Date of Birth: {dob}\n"
        "   * Time of Birth: {birth_time}\n"
        "   * Place of Birth: {birth_place}\n"
        "Focus the horoscope on themes of luck, opportunity, and self-reflection. "
        "Do not sound generic."
    )
    
    # Create a chain: prompt -> LLM -> string output parser
    chain = prompt | llm | StrOutputParser()
    
    # Invoke the chain with user's birth details
    horoscope_text = chain.invoke({
        "dob": request.dob,
        "birth_time": request.birth_time,
        "birth_place": request.birth_place
    })
    
    # Return the generated horoscope as JSON
    return {"horoscope_text": horoscope_text}

# Optional: Add a health check endpoint
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Horoscope Generator API is running"}