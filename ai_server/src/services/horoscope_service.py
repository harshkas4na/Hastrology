"""
Horoscope Service - CDO Architecture
High-fidelity horoscope generation using Swiss Ephemeris and Cosmic Data Object
"""
import json
import re
from datetime import datetime, date
from typing import Optional, Dict, Any, Tuple

from pydantic import BaseModel, Field

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.exceptions import OutputParserException

from ..config.settings import settings
from ..config.logger import logger
from .cache_service import cache_service
from ..prompts.senior_astrologer_prompt import (
    SENIOR_ASTROLOGER_PROMPT, 
    calculate_vibe_status, 
    get_energy_emoji
)

# Try to import ephemeris services (optional - falls back gracefully)
try:
    from .ephemeris_service import ephemeris_service, SWISSEPH_AVAILABLE
    from .astro_calculator import astro_calculator
    CDO_ENABLED = SWISSEPH_AVAILABLE and ephemeris_service is not None
except ImportError as e:
    logger.warning(f"Ephemeris services not available: {e}")
    CDO_ENABLED = False
    ephemeris_service = None
    astro_calculator = None


# --- Pydantic Models for Strict Schema Enforcement ---

class LuckyAssets(BaseModel):
    number: str = Field(..., description="Lucky number or special time like 11:11")
    color: str = Field(..., description="A descriptive color name")
    power_hour: str = Field(..., description="A specific time of day")


class HoroscopeFront(BaseModel):
    tagline: str = Field(..., description="Witty GenZ hook")
    luck_score: int = Field(..., ge=0, le=100)
    vibe_status: str = Field(..., description="Stellar, Ascending, Shaky, or Eclipse")
    energy_emoji: str
    zodiac_sign: str
    time_lord: str = Field(default="Sun", description="Lord of the Year")
    profection_house: int = Field(default=1, ge=1, le=12)


class HoroscopeBack(BaseModel):
    detailed_reading: str
    hustle_alpha: str
    shadow_warning: str
    lucky_assets: LuckyAssets
    time_lord_insight: str = Field(default="", description="Time Lord transit insight")
    planetary_blame: str = Field(default="", description="Specific planetary attribution")
    remedy: Optional[str] = Field(default=None)
    cusp_alert: Optional[str] = Field(default=None)


class AstroCard(BaseModel):
    front: HoroscopeFront
    back: HoroscopeBack
    ruling_planet: str
    sect: str = Field(default="Diurnal")
    cdo_summary: Optional[Dict[str, Any]] = Field(default=None)


# --- Horoscope Service Implementation ---

class HoroscopeService:
    """
    CDO-Enhanced Horoscope Service
    Uses Swiss Ephemeris for astronomical calculations and builds
    Cosmic Data Objects for AI-powered interpretation.
    """
    
    def __init__(self):
        try:
            # Using Gemini 1.5-flash for speed and better JSON adherence
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash", 
                google_api_key=settings.google_api_key,
                temperature=0.75,  # Slightly lower for more consistent output
                max_retries=3
            )
            self.output_parser = JsonOutputParser(pydantic_object=AstroCard)
            self.prompt = ChatPromptTemplate.from_template(
                template=SENIOR_ASTROLOGER_PROMPT,
                partial_variables={"format_instructions": self.output_parser.get_format_instructions()}
            )
            self.chain = self.prompt | self.llm
            
            self.cdo_enabled = CDO_ENABLED
            logger.info(f"HoroscopeService initialized (CDO: {self.cdo_enabled})")
            
        except Exception as e:
            logger.error(f"Initialization failed: {e}")
            raise
    
    def _parse_date(self, dob: str) -> datetime:
        """Parse date of birth string into datetime object"""
        formats = [
            "%B %d, %Y",      # April 20, 1995
            "%b %d, %Y",      # Apr 20, 1995
            "%Y-%m-%d",       # 1995-04-20
            "%d/%m/%Y",       # 20/04/1995
            "%m/%d/%Y",       # 04/20/1995
            "%d-%m-%Y",       # 20-04-1995
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dob.strip(), fmt)
            except ValueError:
                continue
        
        # Fallback: try to extract year/month/day with regex
        match = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', dob)
        if match:
            day, month, year = match.groups()
            return datetime(int(year), int(month), int(day))
        
        raise ValueError(f"Could not parse date: {dob}")
    
    def _parse_time(self, birth_time: str) -> Tuple[int, int]:
        """Parse birth time string into (hour, minute) tuple"""
        # Try 12-hour format (4:30 PM)
        match = re.match(r'(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?', birth_time.strip())
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            period = match.group(3)
            
            if period:
                if period.upper() == 'PM' and hour != 12:
                    hour += 12
                elif period.upper() == 'AM' and hour == 12:
                    hour = 0
            
            return hour, minute
        
        # Try 24-hour format (16:30)
        match = re.match(r'(\d{1,2}):(\d{2})', birth_time.strip())
        if match:
            return int(match.group(1)), int(match.group(2))
        
        # Default to noon
        return 12, 0
    
    def _calculate_age(self, birth_date: date, current_date: date = None) -> int:
        """Calculate age in years"""
        if current_date is None:
            current_date = date.today()
        
        age = current_date.year - birth_date.year
        if (current_date.month, current_date.day) < (birth_date.month, birth_date.day):
            age -= 1
        return max(0, age)
    
    def _get_age_segment(self, age: int) -> str:
        """Get life stage segment for appropriate advice tone"""
        if age < 25:
            return "EARLY_HUSTLE (Growth & Exploration)"
        elif age < 35:
            return "PIVOT_ERA (Career Building & Relationships)"
        elif age < 50:
            return "LEGACY_MODE (Stability & Leadership)"
        else:
            return "WISDOM_ERA (Reflection & Mentorship)"
    
    def _build_cdo_context(
        self,
        dob: str,
        birth_time: str,
        latitude: float,
        longitude: float,
        timezone_offset: float = 0.0
    ) -> Tuple[Dict[str, Any], str]:
        """
        Build Cosmic Data Object from birth data using ephemeris.
        
        Returns:
            Tuple of (cdo_dict, cdo_json_string)
        """
        if not self.cdo_enabled or ephemeris_service is None:
            raise RuntimeError("CDO not available - ephemeris service not initialized")
        
        # Parse birth datetime
        birth_date = self._parse_date(dob)
        hour, minute = self._parse_time(birth_time)
        birth_datetime = birth_date.replace(hour=hour, minute=minute)
        
        # Calculate natal chart
        chart_data = ephemeris_service.calculate_chart(
            birth_datetime=birth_datetime,
            latitude=latitude,
            longitude=longitude,
            timezone_offset=timezone_offset,
            use_sidereal=True
        )
        
        # Get current transits
        current_datetime = datetime.now()
        transit_planets = ephemeris_service.get_current_transits(
            current_datetime=current_datetime,
            latitude=latitude,
            longitude=longitude
        )
        
        # Build full CDO
        cdo = astro_calculator.build_cdo(
            chart_data=chart_data,
            birth_date=birth_date.date(),
            current_date=current_datetime,
            transit_planets=transit_planets
        )
        
        # Build summary for prompt
        cdo_summary = astro_calculator.build_cdo_summary(cdo)
        
        return cdo.model_dump(), cdo_summary.model_dump()
    
    def _get_fallback_zodiac(self, day: int, month: int) -> str:
        """Get zodiac sign for fallback mode (tropical)"""
        zodiac_map = [
            (20, "Capricorn"), (19, "Aquarius"), (20, "Pisces"), (20, "Aries"),
            (21, "Taurus"), (21, "Gemini"), (22, "Cancer"), (23, "Leo"),
            (23, "Virgo"), (23, "Libra"), (22, "Scorpio"), (21, "Sagittarius"),
            (31, "Capricorn")
        ]
        return zodiac_map[month-1][1] if day > zodiac_map[month-1][0] else zodiac_map[month-2][1]
    
    def _get_fallback_ruler(self, sign: str) -> str:
        """Get planetary ruler for fallback mode"""
        rulers = {
            "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury",
            "Cancer": "Moon", "Leo": "Sun", "Virgo": "Mercury",
            "Libra": "Venus", "Scorpio": "Mars", "Sagittarius": "Jupiter",
            "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"
        }
        return rulers.get(sign, "Sun")
    
    async def generate_horoscope(
        self,
        dob: str,
        birth_time: str,
        birth_place: str,
        latitude: float = 0.0,
        longitude: float = 0.0,
        timezone_offset: float = 0.0,
        use_cache: bool = True
    ) -> Tuple[Dict[str, Any], bool, str]:
        """
        Generate personalized horoscope using CDO architecture.
        
        Args:
            dob: Date of birth string
            birth_time: Time of birth string
            birth_place: Place of birth (for display)
            latitude: Birth place latitude
            longitude: Birth place longitude
            timezone_offset: UTC offset in hours
            use_cache: Whether to use caching
            
        Returns:
            Tuple of (card_data_dict, was_cached, generation_mode)
        """
        # Check cache first
        if use_cache:
            cache_key = f"{dob}_{birth_time}_{latitude}_{longitude}"
            cached = cache_service.get(dob, birth_time, birth_place)
            if cached:
                return json.loads(cached), True, "cdo"
        
        # Parse birth date for age calculation
        try:
            birth_date = self._parse_date(dob)
            age = self._calculate_age(birth_date.date())
            age_segment = self._get_age_segment(age)
        except Exception as e:
            logger.warning(f"Date parsing failed: {e}, using defaults")
            age = 30
            age_segment = "PIVOT_ERA (Career Building & Relationships)"
        
        # Try CDO generation
        generation_mode = "cdo"
        cdo_json = "{}"
        cdo_summary = {}
        
        if self.cdo_enabled and latitude != 0.0 and longitude != 0.0:
            try:
                cdo_full, cdo_summary = self._build_cdo_context(
                    dob=dob,
                    birth_time=birth_time,
                    latitude=latitude,
                    longitude=longitude,
                    timezone_offset=timezone_offset
                )
                cdo_json = json.dumps(cdo_full, indent=2, default=str)
                logger.info("CDO generated successfully")
            except Exception as e:
                logger.warning(f"CDO generation failed, using fallback: {e}")
                generation_mode = "fallback"
                cdo_summary = self._build_fallback_summary(dob, birth_time, age)
        else:
            generation_mode = "fallback"
            cdo_summary = self._build_fallback_summary(dob, birth_time, age)
        
        # Build prompt variables
        prompt_vars = {
            "cdo_json": cdo_json,
            "sect": cdo_summary.get("sect", "Diurnal"),
            "malefic_severity": cdo_summary.get("malefic_severity", "constructive"),
            "ascendant": cdo_summary.get("ascendant", "Unknown"),
            "time_lord": cdo_summary.get("time_lord", "Sun"),
            "profection_house": cdo_summary.get("profection_house", 1),
            "profection_theme": cdo_summary.get("profection_theme", "Self and Identity"),
            "major_aspect": cdo_summary.get("major_aspect", "No major aspects"),
            "time_lord_activation": cdo_summary.get("time_lord_activation", "No direct activations"),
            "cusp_alert": f"**Cosmic Cusp Alert**: Ascendant on sign boundary" if cdo_summary.get("is_cusp") else "",
            "dignity_warning": cdo_summary.get("dignity_warning", ""),
        }
        
        try:
            # Invoke AI
            raw_output = await self.chain.ainvoke(prompt_vars)
            
            # Parse response
            try:
                card_data = self.output_parser.parse(raw_output.content)
            except:
                # Fallback: extract JSON from markdown blocks
                match = re.search(r'\{.*\}', raw_output.content, re.DOTALL)
                if match:
                    card_data = json.loads(match.group())
                else:
                    raise OutputParserException("No JSON found in LLM response")
            
            # Validate and enhance
            validated_card = AstroCard(**card_data)
            
            # Add CDO summary to response
            if cdo_summary:
                card_dict = validated_card.model_dump()
                card_dict["cdo_summary"] = cdo_summary
            else:
                card_dict = validated_card.model_dump()
            
            # Cache result
            if use_cache:
                cache_service.set(dob, birth_time, birth_place, json.dumps(card_dict))
            
            return card_dict, False, generation_mode
            
        except Exception as e:
            logger.error(f"Generation failure: {e}")
            return self._get_fallback_card(
                cdo_summary.get("time_lord", "Sun"),
                cdo_summary.get("sect", "Diurnal")
            ), False, "fallback"
    
    def _build_fallback_summary(self, dob: str, birth_time: str, age: int) -> Dict[str, Any]:
        """Build a basic summary when CDO is not available"""
        try:
            birth_date = self._parse_date(dob)
            zodiac = self._get_fallback_zodiac(birth_date.day, birth_date.month)
            ruler = self._get_fallback_ruler(zodiac)
        except:
            zodiac = "Aries"
            ruler = "Mars"
        
        profection_house = (age % 12) + 1
        
        return {
            "sect": "Diurnal",
            "ascendant": f"{zodiac} (estimated)",
            "is_cusp": False,
            "time_lord": ruler,
            "profection_house": profection_house,
            "profection_theme": "General Life Themes",
            "major_aspect": "Transits active",
            "time_lord_activation": None,
            "dignity_warning": "",
            "malefic_severity": "constructive"
        }
    
    def _get_fallback_card(self, time_lord: str, sect: str) -> Dict[str, Any]:
        """Generate fallback card when everything fails"""
        return AstroCard(
            front=HoroscopeFront(
                tagline="The stars are recalibrating... ✨",
                luck_score=50,
                vibe_status="Shaky",
                energy_emoji="🔮",
                zodiac_sign="Unknown",
                time_lord=time_lord,
                profection_house=1
            ),
            back=HoroscopeBack(
                detailed_reading="Mercury retrograde in the cosmic servers. Your chart is being processed through the ethers. Check back soon for your personalized reading.",
                hustle_alpha="Focus on grounding activities today. The stars will align shortly.",
                shadow_warning="Avoid making major decisions until the cosmic connection stabilizes.",
                lucky_assets=LuckyAssets(number="7", color="Silver", power_hour="Soon"),
                time_lord_insight="Your Time Lord is gathering cosmic data.",
                planetary_blame="Technical Mercury square Digital Saturn (Temporary)",
                remedy="Take 5 deep breaths and try again.",
                cusp_alert=None
            ),
            ruling_planet=time_lord,
            sect=sect,
            cdo_summary=None
        ).model_dump()


# Global service instance
horoscope_service = HoroscopeService()