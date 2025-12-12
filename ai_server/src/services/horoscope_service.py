"""
Horoscope generation service using Google Gemini
Generates Spotify Wrapped-style astro cards
"""
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from typing import Optional, Dict, Any

from ..config.settings import settings
from ..config.logger import logger
from .cache_service import cache_service

# Card type definitions with their themes
CARD_TYPES = [
    "overall_vibe",
    "shine", 
    "health",
    "wealth",
    "career",
    "love",
    "social",
    "growth",
    "luck",
    "wild_card"
]

ASTRO_CARDS_PROMPT = """You are a witty Gen-Z astrologer creating Spotify Wrapped-style daily horoscope cards.

Generate 10 unique astro cards for someone born on {dob} at {birth_time} in {birth_place}.

Each card should feel personal, punchy, and shareable. Use modern, playful language.

Return ONLY valid JSON (no markdown, no extra text) in this exact format:
{{
  "overall_vibe": {{
    "title": "YOUR VIBE TODAY",
    "tagline": "Today, you're giving...",
    "content": "main character energy",
    "footer": "Stars powered by delusion + destiny."
  }},
  "shine": {{
    "title": "YOU WILL SHINE AT",
    "tagline": "You will shine at _______ today.",
    "content": "smart decisions",
    "footer": "Your moment is loading..."
  }},
  "health": {{
    "title": "HEALTH CHECK",
    "tagline": "Your body is sending a push notification:",
    "content": "hydrate before you overthink",
    "footer": "Self-care is your superpower."
  }},
  "wealth": {{
    "title": "MONEY MOOD",
    "tagline": "The money mood today:",
    "content": "unexpected blessings loading",
    "footer": "Abundance is your vibe."
  }},
  "career": {{
    "title": "WORK AURA",
    "tagline": "Your work aura today:",
    "content": "quiet competence",
    "footer": "Success looks good on you."
  }},
  "love": {{
    "title": "HEART ALGORITHM",
    "tagline": "Heart algorithm update:",
    "content": "someone thinks about you today",
    "footer": "Love is in the air."
  }},
  "social": {{
    "title": "SOCIAL BATTERY",
    "tagline": "Your social battery is at:",
    "content": "70% — perfect for selective plans",
    "footer": "Choose your energy wisely."
  }},
  "growth": {{
    "title": "UNIVERSE WHISPERS",
    "tagline": "Universe is whispering:",
    "content": "you're closer than you think",
    "footer": "Trust the journey."
  }},
  "luck": {{
    "title": "LUCKY GLITCH",
    "tagline": "Your lucky glitch today:",
    "content": "small win incoming",
    "footer": "Luck is on your side."
  }},
  "wild_card": {{
    "title": "PLOT TWIST",
    "tagline": "Plot twist alert:",
    "content": "today's delusion might work",
    "footer": "Expect the unexpected."
  }}
}}

IMPORTANT RULES:
1. Make each "content" field SHORT and PUNCHY (max 6-8 words)
2. Be specific to their birth chart energy - reference their zodiac traits
3. Make it feel personal, not generic
4. Use Gen-Z language: "giving", "lowkey", "fr", "slay", "main character", etc.
5. The social card MUST include a percentage (10-100%)
6. Make the wild_card fun and unexpected
7. Return ONLY the JSON object, nothing else"""


class HoroscopeService:
    """Service for generating Spotify Wrapped-style horoscope cards using AI"""
    
    def __init__(self):
        """Initialize the Gemini model"""
        try:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.google_api_key,
                temperature=0.9  # Higher temperature for more creative/varied responses
            )
            logger.info("Gemini model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini model: {e}")
            raise
        
        # Create the prompt template
        self.prompt = ChatPromptTemplate.from_template(ASTRO_CARDS_PROMPT)
        
        # Create the chain
        self.chain = self.prompt | self.llm | StrOutputParser()
    
    def _parse_cards_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse the AI response into structured card data
        
        Args:
            response_text: Raw response from AI
            
        Returns:
            Dictionary with card data
        """
        try:
            # Clean up the response - remove any markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            # Parse JSON
            cards_data = json.loads(cleaned)
            
            # Validate all card types are present
            for card_type in CARD_TYPES:
                if card_type not in cards_data:
                    logger.warning(f"Missing card type: {card_type}, using default")
                    cards_data[card_type] = {
                        "title": card_type.upper().replace("_", " "),
                        "tagline": "The stars say...",
                        "content": "cosmic vibes loading",
                        "footer": "Trust the universe."
                    }
            
            return cards_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse cards JSON: {e}")
            logger.error(f"Raw response: {response_text[:500]}")
            # Return fallback cards
            return self._get_fallback_cards()
    
    def _get_fallback_cards(self) -> Dict[str, Any]:
        """Generate fallback cards if AI parsing fails"""
        return {
            "overall_vibe": {
                "title": "YOUR VIBE TODAY",
                "tagline": "Today, you're giving...",
                "content": "mysterious energy ✨",
                "footer": "Stars powered by delusion + destiny."
            },
            "shine": {
                "title": "YOU WILL SHINE AT",
                "tagline": "You will shine at _______ today.",
                "content": "being authentically you",
                "footer": "Your moment is loading..."
            },
            "health": {
                "title": "HEALTH CHECK",
                "tagline": "Your body is sending a push notification:",
                "content": "rest is productive too",
                "footer": "Self-care is your superpower."
            },
            "wealth": {
                "title": "MONEY MOOD",
                "tagline": "The money mood today:",
                "content": "trust your money moves",
                "footer": "Abundance is your vibe."
            },
            "career": {
                "title": "WORK AURA",
                "tagline": "Your work aura today:",
                "content": "lowkey genius mode",
                "footer": "Success looks good on you."
            },
            "love": {
                "title": "HEART ALGORITHM",
                "tagline": "Heart algorithm update:",
                "content": "good vibes only today",
                "footer": "Love finds you."
            },
            "social": {
                "title": "SOCIAL BATTERY",
                "tagline": "Your social battery is at:",
                "content": "60% — choose wisely",
                "footer": "Quality over quantity."
            },
            "growth": {
                "title": "UNIVERSE WHISPERS",
                "tagline": "Universe is whispering:",
                "content": "patience is power",
                "footer": "Trust the journey."
            },
            "luck": {
                "title": "LUCKY GLITCH",
                "tagline": "Your lucky glitch today:",
                "content": "a pleasant surprise awaits",
                "footer": "Luck is on your side."
            },
            "wild_card": {
                "title": "PLOT TWIST",
                "tagline": "Plot twist alert:",
                "content": "expect the unexpected",
                "footer": "Life's full of surprises."
            }
        }
    
    async def generate_horoscope(
        self, 
        dob: str, 
        birth_time: str, 
        birth_place: str,
        use_cache: bool = True
    ) -> tuple[Dict[str, Any], bool]:
        """
        Generate personalized horoscope cards
        
        Args:
            dob: Date of birth
            birth_time: Time of birth
            birth_place: Place of birth
            use_cache: Whether to use cache
            
        Returns:
            Tuple of (cards_data dict, was_cached bool)
        """
        # Check cache first
        if use_cache:
            cached_horoscope = cache_service.get(dob, birth_time, birth_place)
            if cached_horoscope:
                try:
                    # Try to parse cached data as JSON
                    return json.loads(cached_horoscope), True
                except json.JSONDecodeError:
                    # Old format cached data, ignore
                    pass
        
        try:
            logger.info("Generating new horoscope cards with AI")
            
            # Generate horoscope using LangChain
            response_text = await self.chain.ainvoke({
                "dob": dob,
                "birth_time": birth_time,
                "birth_place": birth_place
            })
            
            # Parse the response into structured cards
            cards_data = self._parse_cards_response(response_text)
            
            # Cache the result as JSON string
            if use_cache:
                cache_service.set(dob, birth_time, birth_place, json.dumps(cards_data))
            
            logger.info("Horoscope cards generated successfully")
            return cards_data, False
            
        except Exception as e:
            logger.error(f"Error generating horoscope cards: {e}")
            raise Exception(f"Failed to generate horoscope: {str(e)}")


# Global service instance
horoscope_service = HoroscopeService()

