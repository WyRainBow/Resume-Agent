"""HTTP API routes module.

Loads core routes first and keeps optional routes resilient so native mode can
start even when some monolith-only dependencies are not present yet.
"""

from fastapi import APIRouter

from backend.core.logger import get_logger
from backend.agent.web.routes.health import router as health_router
from backend.agent.web.routes.models import router as models_router
from backend.agent.web.routes.stream import router as stream_router

logger = get_logger(__name__)

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(models_router)
api_router.include_router(stream_router)

try:
    from backend.agent.web.routes.resume import router as resume_router

    api_router.include_router(resume_router)
except Exception as exc:  # pragma: no cover - best effort during migration
    logger.warning("resume routes disabled in native mode: %s", exc)
    resume_router = None

try:
    from backend.agent.web.routes.history import router as history_router

    api_router.include_router(history_router)
except Exception as exc:  # pragma: no cover - best effort during migration
    logger.warning("history routes disabled in native mode: %s", exc)
    history_router = None

__all__ = ["api_router", "health_router", "models_router", "stream_router"]
