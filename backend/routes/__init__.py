"""
路由模块
"""
from .health import router as health_router
from .config import router as config_router
from .resume import router as resume_router
from .agent import router as agent_router
from .pdf import router as pdf_router
from .share import router as share_router
from .cv_agent import router as cv_agent_router
from .resume_optimization import router as resume_optimization_router

__all__ = [
    'health_router',
    'config_router',
    'resume_router',
    'agent_router',
    'pdf_router',
    'share_router',
    'cv_agent_router',
    'resume_optimization_router'
]
