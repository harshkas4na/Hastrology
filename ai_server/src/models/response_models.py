"""
Response Pydantic models
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict


class AstroCard(BaseModel):
    """Individual astro card model"""
    title: str = Field(..., description="Card title (e.g., 'YOUR VIBE TODAY')")
    tagline: str = Field(..., description="Card tagline/prompt")
    content: str = Field(..., description="Main content - short, punchy message")
    footer: str = Field(..., description="Footer text")


class HoroscopeResponse(BaseModel):
    """Response model for horoscope generation - now returns structured cards"""
    cards: Dict[str, AstroCard] = Field(..., description="Dictionary of astro cards")
    cached: Optional[bool] = Field(default=False, description="Whether response was served from cache")
    
    class Config:
        json_schema_extra = {
            "example": {
                "cards": {
                    "overall_vibe": {
                        "title": "YOUR VIBE TODAY",
                        "tagline": "Today, you're giving...",
                        "content": "main character energy",
                        "footer": "Stars powered by delusion + destiny."
                    }
                },
                "cached": False
            }
        }


# Legacy response model for backwards compatibility
class LegacyHoroscopeResponse(BaseModel):
    """Legacy response model - single text horoscope"""
    horoscope_text: str = Field(..., description="Generated horoscope text")
    cached: Optional[bool] = Field(default=False, description="Whether response was served from cache")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(default="ok", description="Service status")
    message: str = Field(..., description="Status message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "ok",
                "message": "Horoscope Generator API is running"
            }
        }


class ErrorResponse(BaseModel):
    """Error response model"""
    detail: str = Field(..., description="Error details")
    
    class Config:
        json_schema_extra = {
            "example": {
                "detail": "An error occurred"
            }
        }

