"""
Rate limiting middleware using SlowAPI
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from ..config.settings import settings


# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_times}/{settings.rate_limit_seconds}seconds"],
    enabled=settings.rate_limit_enabled
)


# Rate limit configurations
STRICT_LIMIT = "5/minute"  # For expensive operations
GENERAL_LIMIT = f"{settings.rate_limit_times}/{settings.rate_limit_seconds}seconds"
