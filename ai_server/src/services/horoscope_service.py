"""
Horoscope generation service using Google Gemini
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from typing import Optional

from ..config.settings import settings
from ..config.logger import logger
from .cache_service import cache_service


class HoroscopeService:
    """Service for generating horoscopes using AI"""
    
    def __init__(self):
        """Initialize the Gemini model"""
        try:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.google_api_key,
                temperature=0.7
            )
            logger.info("Gemini model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini model: {e}")
            raise
        
        # Create the prompt template
        self.prompt = ChatPromptTemplate.from_template(
            "You are a professional astrologer with a witty, modern, and optimistic tone. "
            "Generate a 4-sentence horoscope for a user with the following details:\n"
            "   * Date of Birth: {dob}\n"
            "   * Time of Birth: {birth_time}\n"
            "   * Place of Birth: {birth_place}\n"
            "Focus the horoscope on themes of luck, opportunity, and self-reflection. "
            "Do not sound generic."
        )
        
        # Create the chain
        self.chain = self.prompt | self.llm | StrOutputParser()
    
    async def generate_horoscope(
        self, 
        dob: str, 
        birth_time: str, 
        birth_place: str,
        use_cache: bool = True
    ) -> tuple[str, bool]:
        """
        Generate a personalized horoscope
        
        Args:
            dob: Date of birth
            birth_time: Time of birth
            birth_place: Place of birth
            use_cache: Whether to use cache
            
        Returns:
            Tuple of (horoscope_text, was_cached)
        """
        # Check cache first
        if use_cache:
            cached_horoscope = cache_service.get(dob, birth_time, birth_place)
            if cached_horoscope:
                return cached_horoscope, True
        
        try:
            logger.info("Generating new horoscope with AI")
            
            # Generate horoscope using LangChain
            horoscope_text = await self.chain.ainvoke({
                "dob": dob,
                "birth_time": birth_time,
                "birth_place": birth_place
            })
            
            # Cache the result
            if use_cache:
                cache_service.set(dob, birth_time, birth_place, horoscope_text)
            
            logger.info("Horoscope generated successfully")
            return horoscope_text, False
            
        except Exception as e:
            logger.error(f"Error generating horoscope: {e}")
            raise Exception(f"Failed to generate horoscope: {str(e)}")


# Global service instance
horoscope_service = HoroscopeService()
