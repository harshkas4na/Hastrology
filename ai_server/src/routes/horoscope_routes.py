"""
API routes for horoscope generation
"""
from fastapi import APIRouter, HTTPException, status
from ..models.request_models import HoroscopeRequest
from ..models.response_models import HoroscopeResponse, AstroCard
from ..services.horoscope_service import horoscope_service
from ..config.logger import logger

router = APIRouter()


@router.post(
    "/generate_horoscope",
    response_model=HoroscopeResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate personalized astro cards",
    description="Generate Spotify Wrapped-style horoscope cards based on date of birth, time, and place"
)
async def generate_horoscope(request: HoroscopeRequest):
    """
    Generate personalized horoscope cards based on birth details.
    
    Args:
        request: HoroscopeRequest containing dob, birth_time, and birth_place
        
    Returns:
        HoroscopeResponse with 10 structured astro cards
        
    Raises:
        HTTPException: If horoscope generation fails
    """
    try:
        logger.info(f"Received horoscope request for DOB: {request.dob}")
        
        cards_data, was_cached = await horoscope_service.generate_horoscope(
            dob=request.dob,
            birth_time=request.birth_time,
            birth_place=request.birth_place
        )
        
        # Convert raw card data to AstroCard models
        cards = {
            card_type: AstroCard(**card_data) 
            for card_type, card_data in cards_data.items()
        }
        
        return HoroscopeResponse(
            cards=cards,
            cached=was_cached
        )
        
    except Exception as e:
        logger.error(f"Error in generate_horoscope endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate horoscope: {str(e)}"
        )

