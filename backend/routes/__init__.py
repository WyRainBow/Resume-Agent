"""
路由模块
"""
from .health import router as health_router
from .config import router as config_router
from .resume import router as resume_router
from .agent import router as agent_router
from .pdf import router as pdf_router

__all__ = [
    'health_router',
    'config_router', 
    'resume_router',
    'agent_router',
    'pdf_router'
]
