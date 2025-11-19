"""
API routes for horoscope generation
"""
from fastapi import APIRouter, HTTPException, status
from ..models.request_models import HoroscopeRequest
from ..models.response_models import HoroscopeResponse
from ..services.horoscope_service import horoscope_service
from ..config.logger import logger

router = APIRouter()


@router.post(
    "/generate_horoscope",
    response_model=HoroscopeResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a personalized horoscope",
    description="Generate a horoscope based on date of birth, time, and place"
)
async def generate_horoscope(request: HoroscopeRequest):
    """
    Generate a personalized horoscope based on birth details.
    
    Args:
        request: HoroscopeRequest containing dob, birth_time, and birth_place
        
    Returns:
        HoroscopeResponse with generated horoscope text
        
    Raises:
        HTTPException: If horoscope generation fails
    """
    try:
        logger.info(f"Received horoscope request for DOB: {request.dob}")
        
        horoscope_text, was_cached = await horoscope_service.generate_horoscope(
            dob=request.dob,
            birth_time=request.birth_time,
            birth_place=request.birth_place
        )
        
        return HoroscopeResponse(
            horoscope_text=horoscope_text,
            cached=was_cached
        )
        
    except Exception as e:
        logger.error(f"Error in generate_horoscope endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate horoscope: {str(e)}"
        )
