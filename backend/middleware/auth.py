"""
JWT 认证依赖
"""
from typing import Optional
from time import sleep
import logging
from fastapi import Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session, load_only
from sqlalchemy.exc import (
    DBAPIError,
    DisconnectionError,
    InterfaceError,
    OperationalError,
    SQLAlchemyError,
)

from database import get_db
from models import User
from auth import decode_access_token

logger = logging.getLogger("backend")
MAX_AUTH_DB_RETRIES = 4


class AuthenticatedUser:
    """轻量认证用户对象，避免不必要的 ORM 依赖。"""

    def __init__(self, user_id: int, username: str = "", role: str = "user", email: Optional[str] = None):
        self.id = user_id
        self.username = username
        self.role = role
        self.email = email


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
) -> User:
    """从 Authorization 头获取当前用户"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")

    user_id = payload.get("sub")
    # 处理 user_id 可能是字符串或整数的情况
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(status_code=401, detail="Token 格式错误")

    # 管理端高频接口优先走 JWT claim，避免每次鉴权都阻塞数据库。
    # 仍保留非管理接口的数据库校验逻辑。
    req_path = request.url.path or ""
    if req_path.startswith("/api/admin/"):
        return AuthenticatedUser(
            user_id=user_id,
            username=str(payload.get("username") or ""),
            role=str(payload.get("role") or "user"),
            email=(str(payload.get("email")) if payload.get("email") else None),
        )

    user = None
    db_error: Optional[Exception] = None
    # MySQL 偶发断连/接口层异常时做短重试，降低瞬时抖动导致的 503
    for attempt in range(1, MAX_AUTH_DB_RETRIES + 1):
        try:
            user = (
                db.query(User)
                .options(
                    load_only(
                        User.id,
                        User.username,
                        User.email,
                        User.role,
                        User.last_login_ip,
                        User.api_quota,
                        User.created_at,
                        User.updated_at,
                    )
                )
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
            # 显式标记连接无效，避免重试复用坏连接
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


def require_admin_only(
    current_user: User = Depends(get_current_user),
) -> User:
    """仅允许 admin 角色访问。"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可访问")
    return current_user


def require_admin_or_member(
    current_user: User = Depends(get_current_user),
) -> User:
    """允许 admin/member 访问。"""
    if current_user.role not in {"admin", "member"}:
        raise HTTPException(status_code=403, detail="仅管理员或成员可访问")
    return current_user
