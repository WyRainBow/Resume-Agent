"""
路由模块
"""
from .health import router as health_router
from .config import router as config_router
from .resume import router as resume_router
from .auth import router as auth_router
from .pdf import router as pdf_router
from .share import router as share_router
from .resumes import router as resumes_router
from .agent import router as agent_router

__all__ = [
    'health_router',
    'config_router',
    'resume_router',
    'pdf_router',
    'share_router',
    'auth_router',
    'resumes_router',
    'agent_router'
]
