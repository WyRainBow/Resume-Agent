"""PDF 下载次数配额：普通用户默认 10 次；admin/staff/member 不限次。

2026-07-17 身份统一：计数从旧 users 表迁至 better_auth_entitlements，
入参为 middleware.auth.AppUser（BetterAuth 字符串 id）。
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import func, update
from sqlalchemy.orm import Session

try:
    from backend.models import BetterAuthEntitlement
except ImportError:
    from models import BetterAuthEntitlement

if TYPE_CHECKING:
    from backend.middleware.auth import AppUser

PDF_DOWNLOAD_LIMIT = 10
# admin/staff 内部不限；member（会员）付费权益：下载不限次
UNLIMITED_ROLES = {"admin", "staff", "member"}
logger = logging.getLogger("backend")


def is_pdf_download_unlimited(user: "AppUser") -> bool:
    return getattr(user, "role", None) in UNLIMITED_ROLES


def get_pdf_download_count(user: "AppUser") -> int:
    return int(getattr(user, "pdf_download_count", 0) or 0)


def get_pdf_download_remaining(user: "AppUser") -> Optional[int]:
    if is_pdf_download_unlimited(user):
        return None
    return max(0, PDF_DOWNLOAD_LIMIT - get_pdf_download_count(user))


def build_quota_payload(user: "AppUser") -> Dict[str, Any]:
    unlimited = is_pdf_download_unlimited(user)
    used = get_pdf_download_count(user)
    return {
        "limit": None if unlimited else PDF_DOWNLOAD_LIMIT,
        "used": used,
        "remaining": get_pdf_download_remaining(user),
        "unlimited": unlimited,
    }


def _limit_exceeded_detail(user: "AppUser") -> Dict[str, Any]:
    used = get_pdf_download_count(user)
    return {
        "code": "PDF_DOWNLOAD_LIMIT_EXCEEDED",
        "message": f"PDF 下载次数已达上限（{PDF_DOWNLOAD_LIMIT} 次）",
        "limit": PDF_DOWNLOAD_LIMIT,
        "used": used,
        "remaining": 0,
    }


def assert_pdf_download_allowed(user: "AppUser") -> None:
    """下载前快速校验，避免超限用户继续下载。"""
    if is_pdf_download_unlimited(user):
        return
    if get_pdf_download_count(user) >= PDF_DOWNLOAD_LIMIT:
        logger.warning(
            "[PDF DOWNLOAD][quota_exceeded] code=PDF_DOWNLOAD_LIMIT_EXCEEDED "
            "user_id=%s email=%s role=%s used=%s limit=%s remaining=0",
            getattr(user, "id", "-"),
            getattr(user, "email", "-"),
            getattr(user, "role", "-"),
            get_pdf_download_count(user),
            PDF_DOWNLOAD_LIMIT,
        )
        raise HTTPException(status_code=403, detail=_limit_exceeded_detail(user))


def _fetch_current_count(user: "AppUser", db: Session) -> int:
    value = (
        db.query(BetterAuthEntitlement.pdf_download_count)
        .filter(BetterAuthEntitlement.better_auth_user_id == user.id)
        .scalar()
    )
    return int(value or 0)


def record_successful_pdf_download(user: "AppUser", db: Session) -> None:
    """渲染成功后原子递增计数，防止并发绕过上限。"""
    if is_pdf_download_unlimited(user):
        return

    result = db.execute(
        update(BetterAuthEntitlement)
        .where(BetterAuthEntitlement.better_auth_user_id == user.id)
        .where(
            func.coalesce(BetterAuthEntitlement.pdf_download_count, 0)
            < PDF_DOWNLOAD_LIMIT
        )
        .values(
            pdf_download_count=func.coalesce(
                BetterAuthEntitlement.pdf_download_count, 0
            )
            + 1
        )
    )
    if result.rowcount == 0:
        db.rollback()
        user.pdf_download_count = _fetch_current_count(user, db)
        logger.warning(
            "[PDF DOWNLOAD][quota_exceeded_after_race] code=PDF_DOWNLOAD_LIMIT_EXCEEDED "
            "user_id=%s email=%s role=%s used=%s limit=%s remaining=0",
            getattr(user, "id", "-"),
            getattr(user, "email", "-"),
            getattr(user, "role", "-"),
            get_pdf_download_count(user),
            PDF_DOWNLOAD_LIMIT,
        )
        raise HTTPException(status_code=403, detail=_limit_exceeded_detail(user))
    db.commit()
    user.pdf_download_count = _fetch_current_count(user, db)
    quota = build_quota_payload(user)
    logger.info(
        "[PDF DOWNLOAD][recorded] user_id=%s email=%s role=%s used=%s limit=%s remaining=%s",
        getattr(user, "id", "-"),
        getattr(user, "email", "-"),
        getattr(user, "role", "-"),
        quota["used"],
        quota["limit"],
        quota["remaining"],
    )
