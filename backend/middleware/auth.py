"""
JWT / BetterAuth 统一认证依赖
"""
import logging
import os
from time import sleep
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import (
    DBAPIError,
    DisconnectionError,
    InterfaceError,
    OperationalError,
    SQLAlchemyError,
)
from sqlalchemy.orm import Session, load_only

from auth import decode_access_token
from backend.better_auth import BetterAuthUser, verify_better_auth_token
from backend.services.better_auth_users import resolve_legacy_user
from database import get_db
from models import User

logger = logging.getLogger("backend")
MAX_AUTH_DB_RETRIES = 4

_USER_LOAD_OPTIONS = load_only(
    User.id,
    User.username,
    User.email,
    User.role,
    User.last_login_ip,
    User.api_quota,
    User.pdf_download_count,
    User.created_at,
    User.updated_at,
)


def _load_user_by_id(db: Session, user_id: object) -> User:
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(status_code=401, detail="Token 格式错误")

    user = None
    db_error: Optional[Exception] = None
    for attempt in range(1, MAX_AUTH_DB_RETRIES + 1):
        try:
            user = (
                db.query(User)
                .options(_USER_LOAD_OPTIONS)
                .filter(User.id == user_id)
                .first()
            )
            db_error = None
            break
        except (OperationalError, InterfaceError, DisconnectionError, DBAPIError) as exc:
            db_error = exc
            try:
                db.rollback()
            except Exception:
                pass
            try:
                db.invalidate()
            except Exception:
                pass
            logger.warning(
                f"[鉴权] get_current_user 数据库连接异常，重试 {attempt}/{MAX_AUTH_DB_RETRIES}: {exc}"
            )
            if attempt < MAX_AUTH_DB_RETRIES:
                sleep(0.15 * attempt)
                continue
        except SQLAlchemyError as exc:
            db_error = exc
            db.rollback()
            logger.error(f"[鉴权] get_current_user 数据库查询失败: {exc}")
            break

    if db_error is not None:
        raise HTTPException(status_code=503, detail="数据库连接异常、请稍后重试")
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


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


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_internal_auth_secret: Optional[str] = Header(default=None),
    x_better_auth_user_id: Optional[str] = Header(default=None),
    x_better_auth_user_email: Optional[str] = Header(default=None),
    x_better_auth_user_name: Optional[str] = Header(default=None),
    x_better_auth_user_image: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """从 trusted headers、BetterAuth Bearer 或 JWT 获取当前用户。"""
    trusted_user = _resolve_trusted_better_auth_user(
        x_internal_auth_secret,
        x_better_auth_user_id,
        x_better_auth_user_email,
        x_better_auth_user_name,
        x_better_auth_user_image,
    )
    if trusted_user:
        return resolve_legacy_user(db, trusted_user)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")

    payload = decode_access_token(token)
    if payload and "sub" in payload:
        return _load_user_by_id(db, payload.get("sub"))

    better_user = await verify_better_auth_token(token)
    return resolve_legacy_user(db, better_user)


async def get_current_user_optional(
    authorization: Optional[str] = Header(default=None),
    x_internal_auth_secret: Optional[str] = Header(default=None),
    x_better_auth_user_id: Optional[str] = Header(default=None),
    x_better_auth_user_email: Optional[str] = Header(default=None),
    x_better_auth_user_name: Optional[str] = Header(default=None),
    x_better_auth_user_image: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
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
    current_user: User = Depends(get_current_user),
) -> User:
    """仅允许 admin 角色访问。"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可访问")
    return current_user


def require_staff(
    current_user: User = Depends(get_current_user),
) -> User:
    """允许 admin/staff（管理员/员工）访问——内部运营权限，与会员付费权益无关。"""
    if current_user.role not in {"admin", "staff"}:
        raise HTTPException(status_code=403, detail="仅管理员或员工可访问")
    return current_user