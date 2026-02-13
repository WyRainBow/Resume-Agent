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
from .reports import router as reports_router
from .documents import router as documents_router
from .logos import router as logos_router
from .photos import router as photos_router
from .application_progress import router as application_progress_router
from .dashboard_perf import router as dashboard_perf_router
from .calendar import router as calendar_router
from .admin_users import router as admin_users_router
from .admin_members import router as admin_members_router
from .admin_permissions import router as admin_permissions_router
from .admin_logs import router as admin_logs_router
from .admin_traces import router as admin_traces_router
from .admin_overview import router as admin_overview_router
from .asr import router as asr_router

# TTS 路由（优先使用 edge-tts，如果不可用则尝试 Coqui TTS）
try:
    from .tts_edge import router as tts_router
    _tts_available = True
    _tts_type = "edge-tts"
except ImportError:
    # edge-tts 不可用，尝试 Coqui TTS
    try:
        from .tts import router as tts_router
        _tts_available = True
        _tts_type = "coqui-tts"
    except ImportError:
        # TTS 依赖未安装，创建一个占位符
        tts_router = None
        _tts_available = False
        _tts_type = None

__all__ = [
    'health_router',
    'config_router',
    'resume_router',
    'pdf_router',
    'share_router',
    'auth_router',
    'resumes_router',
    'reports_router',
    'documents_router',
    'logos_router',
    'photos_router',
    'application_progress_router',
    'dashboard_perf_router',
    'calendar_router',
    'admin_users_router',
    'admin_members_router',
    'admin_permissions_router',
    'admin_logs_router',
    'admin_traces_router',
    'admin_overview_router',
    'tts_router',
    'asr_router',
]
