"""HTTP API routes module.

This module provides:
- Health check endpoints
- Resume data management endpoints
- Chat history management endpoints
- SSE streaming endpoints (replacing WebSocket)
"""

from fastapi import APIRouter

from backend.agent.web.routes.health import router as health_router
from backend.agent.web.routes.resume import router as resume_router
from backend.agent.web.routes.history import router as history_router
from backend.agent.web.routes.stream import router as stream_router

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(health_router)
api_router.include_router(resume_router)
api_router.include_router(history_router)
api_router.include_router(stream_router)  # SSE streaming endpoint

__all__ = [
    "api_router",
    "health_router",
    "resume_router",
    "history_router",
    "stream_router",
]
