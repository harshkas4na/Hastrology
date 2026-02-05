"""
Request and response Pydantic models
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import re


class HoroscopeRequest(BaseModel):
    """
    Request model for horoscope generation.
    Accepts date of birth, birth time, place, and geolocation for topocentric calculations.
    """
    dob: str = Field(..., description="Date of birth (e.g., 'April 20, 1995' or '1995-04-20')")
    birth_time: Optional[str] = Field(default="", description="Time of birth (e.g., '4:30 PM' or '16:30')")
    birth_place: Optional[str] = Field(default="", description="Place of birth (e.g., 'New Delhi, India')")
    latitude: float = Field(
        ..., 
        ge=-90, 
        le=90, 
        description="Birth place latitude for topocentric calculations"
    )
    longitude: float = Field(
        ..., 
        ge=-180, 
        le=180, 
        description="Birth place longitude for topocentric calculations"
    )
    timezone_offset: Optional[float] = Field(
        default=None,
        description="UTC offset in hours (e.g., 5.5 for IST). If not provided, will be estimated."
    )
    # X (Twitter) profile context for personalization
    x_handle: Optional[str] = Field(default=None, description="User's X/Twitter username")
    x_bio: Optional[str] = Field(default=None, description="User's X/Twitter bio")
    x_recent_tweets: Optional[list[str]] = Field(default=None, description="User's recent tweets (max 5)")
    x_persona: Optional[str] = Field(default=None, description="Inferred persona type (degen, builder, whale, analyst, etc.)")
    
    @field_validator('dob')
    @classmethod
    def not_empty_dob(cls, v: str) -> str:
        """Validate that DOB is not empty"""
        if not v or not v.strip():
            raise ValueError('Date of birth cannot be empty')
        return v.strip()
    
    @field_validator('birth_time', 'birth_place')
    @classmethod
    def allow_empty(cls, v: Optional[str]) -> Optional[str]:
        """Allow birth time and place to be empty"""
        if v is None:
            return ""
        return v.strip()
    
    @field_validator('dob')
    @classmethod
    def validate_dob_format(cls, v: str) -> str:
        """Validate date of birth is parseable"""
        # Try common formats
        formats = [
            "%B %d, %Y",      # April 20, 1995
            "%b %d, %Y",      # Apr 20, 1995
            "%Y-%m-%d",       # 1995-04-20
            "%d/%m/%Y",       # 20/04/1995
            "%m/%d/%Y",       # 04/20/1995
        ]
        for fmt in formats:
            try:
                datetime.strptime(v.strip(), fmt)
                return v.strip()
            except ValueError:
                continue
        # If no format matched, still accept (AI can interpret)
        return v.strip()
    
    class Config:
        json_schema_extra = {
            "example": {
                "dob": "April 20, 1995",
                "birth_time": "4:30 PM",
                "birth_place": "New Delhi, India",
                "latitude": 28.6139,
                "longitude": 77.2090,
                "timezone_offset": 5.5
            }
        }
