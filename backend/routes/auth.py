"""
认证相关路由。

2026-07-17 身份统一：旧 JWT 注册/登录端点（/register /login）随 JWT 下架删除，
登录唯一入口 = web(Next.js) 的 BetterAuth。本路由只保留 /me——前端
（betterAuthSession.fetchLegacyUserInfo）经代理调它换取当前用户的 id/role。
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from middleware.auth import AppUser, get_current_user

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/auth", tags=["Auth"])


class UserResponse(BaseModel):
    id: str                      # BetterAuth "user".id（字符串）
    username: Optional[str] = None  # 兼容旧前端字段：填 name/email 前缀
    email: Optional[str] = None
    role: Optional[str] = None


@router.get("/me", response_model=UserResponse)
def me(current_user: AppUser = Depends(get_current_user)):
    """获取当前用户信息（role 实时从 entitlements 读）"""
    display_name = current_user.name or (
        current_user.email.split("@")[0] if current_user.email else None
    )
    return UserResponse(
        id=current_user.id,
        username=display_name,
        email=current_user.email,
        role=current_user.role,
    )
