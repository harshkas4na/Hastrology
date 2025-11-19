"""
Response Pydantic models
"""
from pydantic import BaseModel, Field
from typing import Optional


class HoroscopeResponse(BaseModel):
    """Response model for horoscope generation"""
    horoscope_text: str = Field(..., description="Generated horoscope text")
    cached: Optional[bool] = Field(default=False, description="Whether response was served from cache")
    
    class Config:
        json_schema_extra = {
            "example": {
                "horoscope_text": "Today brings exciting opportunities...",
                "cached": False
            }
        }


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
