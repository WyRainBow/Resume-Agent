"""
健康检查路由
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
