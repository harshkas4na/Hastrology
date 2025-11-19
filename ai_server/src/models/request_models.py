"""
Request and response Pydantic models
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class HoroscopeRequest(BaseModel):
    """
    Request model for horoscope generation.
    Accepts date of birth, birth time, and birth place.
    """
    dob: str = Field(..., description="Date of birth (e.g., 'April 20, 1995')")
    birth_time: str = Field(..., description="Time of birth (e.g., '4:30 PM')")
    birth_place: str = Field(..., description="Place of birth (e.g., 'New Delhi, India')")
    
    @field_validator('dob', 'birth_time', 'birth_place')
    @classmethod
    def not_empty(cls, v: str) -> str:
        """Validate that fields are not empty"""
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()
    
    class Config:
        json_schema_extra = {
            "example": {
                "dob": "April 20, 1995",
                "birth_time": "4:30 PM",
                "birth_place": "New Delhi, India"
            }
        }
