"""
BetterAuth 统一认证依赖。

2026-07-17 身份统一：旧 JWT 通道与 users 表退役——身份唯一锚点 = BetterAuth
"user".id（32 位字符串），app 侧 profile（role / pdf_download_count）由
better_auth_entitlements 承载，经 get_or_create_entitlement 单点解析。
"""
import logging
import os
from dataclasses import dataclass
from time import sleep
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import (
    DBAPIError,
    DisconnectionError,
    InterfaceError,
    OperationalError,
)
from sqlalchemy.orm import Session

from backend.better_auth import BetterAuthUser, verify_better_auth_token
from backend.services.better_auth_entitlements import get_or_create_entitlement
from database import get_db

logger = logging.getLogger("backend")
MAX_AUTH_DB_RETRIES = 4


@dataclass
class AppUser:
    """当前请求身份：BetterAuth user.id 为唯一锚点，app 侧字段来自 entitlements。

    属性名与旧 ORM User 对齐（id/email/role），路由层 current_user.id /
    current_user.role 用法不变；id 语义为字符串（BetterAuth "user".id）。
    """

    id: str
    email: Optional[str]
    name: Optional[str]
    role: str
    pdf_download_count: int


def _resolve_trusted_better_auth_user(
    x_internal_auth_secret: Optional[str],
    x_better_auth_user_id: Optional[str],
    x_better_auth_user_email: Optional[str],
    x_better_auth_user_name: Optional[str],
    x_better_auth_user_image: Optional[str],
) -> Optional[BetterAuthUser]:
    if not x_internal_auth_secret:
        return None

    internal_secret = os.getenv("FASTAPI_INTERNAL_AUTH_SECRET", "").strip()
    if not internal_secret or x_internal_auth_secret != internal_secret:
        raise HTTPException(status_code=401, detail="内部认证信息无效")
    if not x_better_auth_user_id:
        raise HTTPException(status_code=401, detail="缺少 BetterAuth 用户信息")

    return BetterAuthUser(
        id=x_better_auth_user_id,
        email=x_better_auth_user_email,
        name=x_better_auth_user_name,
        image=x_better_auth_user_image,
    )


def _resolve_app_user(db: Session, better_user: BetterAuthUser) -> AppUser:
    """BetterAuth 身份 → entitlements（get-or-create）→ AppUser。

    保留原鉴权链路的瞬时 DB 异常重试（get-or-create 幂等，重试安全）。
    """
    for attempt in range(1, MAX_AUTH_DB_RETRIES + 1):
        try:
            entitlement = get_or_create_entitlement(db, better_user)
            return AppUser(
                id=better_user.id,
                email=better_user.email or entitlement.email,
                name=better_user.name or entitlement.name,
                role=entitlement.role or "user",
                pdf_download_count=entitlement.pdf_download_count or 0,
            )
        except (OperationalError, InterfaceError, DisconnectionError, DBAPIError) as exc:
            try:
                db.rollback()
            except Exception:
                pass
            try:
                db.invalidate()
            except Exception:
                pass
            logger.warning(
                f"[鉴权] entitlements 读写数据库异常，重试 {attempt}/{MAX_AUTH_DB_RETRIES}: {exc}"
            )
            if attempt < MAX_AUTH_DB_RETRIES:
                sleep(0.15 * attempt)
    raise HTTPException(status_code=503, detail="数据库连接异常、请稍后重试")


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_internal_auth_secret: Optional[str] = Header(default=None),
    x_better_auth_user_id: Optional[str] = Header(default=None),
    x_better_auth_user_email: Optional[str] = Header(default=None),
    x_better_auth_user_name: Optional[str] = Header(default=None),
    x_better_auth_user_image: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> AppUser:
    """从 trusted headers 或 BetterAuth Bearer 获取当前用户（旧 JWT 通道已下架）。"""
    trusted_user = _resolve_trusted_better_auth_user(
        x_internal_auth_secret,
        x_better_auth_user_id,
        x_better_auth_user_email,
        x_better_auth_user_name,
        x_better_auth_user_image,
    )
    if trusted_user:
        return _resolve_app_user(db, trusted_user)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")

    better_user = await verify_better_auth_token(token)
    return _resolve_app_user(db, better_user)


async def get_current_user_optional(
    authorization: Optional[str] = Header(default=None),
    x_internal_auth_secret: Optional[str] = Header(default=None),
    x_better_auth_user_id: Optional[str] = Header(default=None),
    x_better_auth_user_email: Optional[str] = Header(default=None),
    x_better_auth_user_name: Optional[str] = Header(default=None),
    x_better_auth_user_image: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[AppUser]:
    """与 get_current_user 相同，但无有效认证时返回 None 而非 401。

    用于匿名可访问的端点（如 PDF 渲染预览）：登录与否都能渲染，
    是否登录的差异交给调用方按 current_user 是否为 None 处理。
    """
    try:
        return await get_current_user(
            authorization=authorization,
            x_internal_auth_secret=x_internal_auth_secret,
            x_better_auth_user_id=x_better_auth_user_id,
            x_better_auth_user_email=x_better_auth_user_email,
            x_better_auth_user_name=x_better_auth_user_name,
            x_better_auth_user_image=x_better_auth_user_image,
            db=db,
        )
    except HTTPException:
        return None


def require_admin_only(
    current_user: AppUser = Depends(get_current_user),
) -> AppUser:
    """仅允许 admin 角色访问（后台/运营接口统一用这一档；staff/member 均无后台权限）。"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可访问")
    return current_user
