"""
Response Pydantic models - Enhanced for CDO Architecture
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class LuckyAssets(BaseModel):
    """Lucky assets for the day"""
    number: str = Field(..., description="Lucky number")
    color: str = Field(..., description="Lucky color")
    power_hour: str = Field(..., description="Power hour (e.g. '3-4 PM')")
    
    # Enriched fields (populated by service)
    ticker: Optional[str] = Field(default=None, description="Asset ticker symbol")
    name: Optional[str] = Field(default=None, description="Asset full name")
    max_leverage: Optional[int] = Field(default=None, description="Max leverage allowed")
    emoji: Optional[str] = Field(default=None, description="Asset emoji")
    category: Optional[str] = Field(default=None, description="Asset category")



class HoroscopeCardFront(BaseModel):
    """Front side of the horoscope card - Public/Shareable"""
    tagline: str = Field(..., description="Witty GenZ hook")
    hook_1: str = Field(..., description="Short astrological reason (max 15 words)")
    hook_2: str = Field(..., description="CT-aligned action with persona language (max 20 words)")
    luck_score: int = Field(..., ge=0, le=100, description="Luck score (0-100)")
    vibe_status: str = Field(..., description="Cosmic status (Stellar, Ascending, Shaky, Eclipse)")
    energy_emoji: str = Field(..., description="Emoji representing the energy")
    zodiac_sign: str = Field(..., description="User's rising sign (Ascendant)")
    time_lord: str = Field(..., description="Lord of the Year from profections")
    profection_house: int = Field(..., ge=1, le=12, description="Current profection house")


class HoroscopeCardBack(BaseModel):
    """Back side of the horoscope card - Private Deep-Dive"""
    detailed_reading: str = Field(..., description="Deep insight using technical astro terms")
    hustle_alpha: str = Field(..., description="Career/financial advice based on age and profection")
    shadow_warning: str = Field(..., description="Specific precautions based on afflictions")
    lucky_assets: LuckyAssets = Field(..., description="Lucky assets object")
    
    # CDO-Enhanced Fields
    time_lord_insight: str = Field(
        ..., 
        description="Insight based on Lord of the Year and their current transits"
    )
    planetary_blame: str = Field(
        ..., 
        description="Attribution to specific planetary aspect (e.g., 'Mars squaring your Time Lord Saturn')"
    )
    remedy: Optional[str] = Field(
        default=None, 
        description="Specific modern remedy if affliction detected (dignity < -2)"
    )
    cusp_alert: Optional[str] = Field(
        default=None,
        description="Special message if Ascendant is on a cosmic cusp (within 1° of sign change)"
    )


class AstroCard(BaseModel):
    """Complete astro card with front and back - CDO Enhanced"""
    front: HoroscopeCardFront = Field(..., description="Front of the card (shareable)")
    back: HoroscopeCardBack = Field(..., description="Back of the card (deep-dive)")
    ruling_planet: str = Field(
        ..., 
        description="Time Lord - the Lord of the Year from profections"
    )
    ruling_planet_theme: str = Field(
        ...,
        description="The theme of the ruling planet (usually same as ruling_planet)"
    )
    sect: str = Field(
        ...,
        description="Chart sect: Diurnal (day) or Nocturnal (night)"
    )
    cdo_summary: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Cosmic Data Object summary for advanced users/debugging"
    )
    
    # For backwards compatibility
    @property
    def ruling_planet_theme(self) -> str:
        return self.ruling_planet


class HoroscopeResponse(BaseModel):
    """Response model for horoscope generation - CDO Enhanced"""
    card: AstroCard = Field(..., description="Single astro card with front and back")
    cached: Optional[bool] = Field(default=False, description="Whether response was served from cache")
    generation_mode: str = Field(
        default="cdo",
        description="Generation mode: 'cdo' for full CDO, 'fallback' if ephemeris unavailable"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "card": {
                    "front": {
                        "tagline": "Mercury's Got Your Back Today ⚡",
                        "hook_1": "Your 10th house profection activates career themes",
                        "hook_2": "Time to ship that code. Founder mode activated.",
                        "luck_score": 78,
                        "vibe_status": "Ascending",
                        "energy_emoji": "🧠",
                        "zodiac_sign": "Virgo",
                        "time_lord": "Mercury",
                        "profection_house": 10
                    },
                    "back": {
                        "detailed_reading": "With Mercury as your Time Lord this year, your 10th house profection activates career themes. Today's applying trine from Jupiter to Mercury amplifies opportunities for recognition.",
                        "hustle_alpha": "Your communication skills are your superpower today. Pitch that idea.",
                        "shadow_warning": "Mars contrary to sect may trigger impatience. Pause before reacting.",
                        "lucky_assets": {
                            "number": "5",
                            "color": "Emerald",
                            "power_hour": "3:00 PM"
                        },
                        "time_lord_insight": "Mercury, your Year Lord, receives a supportive trine from transiting Jupiter. Expansion in Mercurial matters: writing, learning, deals.",
                        "planetary_blame": "Jupiter trine Mercury (Applying, 2°) - Abundance meets intellect.",
                        "remedy": None,
                        "cusp_alert": None
                    },
                    "ruling_planet": "Mercury",
                    "sect": "Diurnal",
                    "cdo_summary": {
                        "sect": "Diurnal",
                        "ascendant": "Virgo at 16°",
                        "time_lord": "Mercury",
                        "profection_house": 10,
                        "major_aspect": "Jupiter Trine Mercury (Applying)"
                    }
                },
                "cached": False,
                "generation_mode": "cdo"
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(default="ok", description="Service status")
    message: str = Field(..., description="Status message")
    ephemeris_available: Optional[bool] = Field(
        default=None, 
        description="Whether Swiss Ephemeris data files are available"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "ok",
                "message": "Hastrology AI Server is running",
                "ephemeris_available": True
            }
        }


class ErrorResponse(BaseModel):
    """Error response model"""
    detail: str = Field(..., description="Error details")
    error_code: Optional[str] = Field(default=None, description="Error code for debugging")
    
    class Config:
        json_schema_extra = {
            "example": {
                "detail": "An error occurred",
                "error_code": "EPHEMERIS_INIT_FAILED"
            }
        }
