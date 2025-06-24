# backend/error_handlers.py
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import logging
from typing import Union

logger = logging.getLogger(__name__)

async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    logger.warning(f"HTTP {exc.status_code}: {exc.detail} - {request.url}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url)
        }
    )

async def validation_exception_handler(request: Request, exc: Exception):
    """Handle validation exceptions"""
    logger.error(f"Validation error: {exc} - {request.url}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "detail": str(exc),
            "path": str(request.url)
        }
    )

async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc} - {request.url}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An unexpected error occurred",
            "path": str(request.url)
        }
    )

def setup_error_handlers(app):
    """Setup error handlers for the FastAPI app"""
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException
    
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler) 