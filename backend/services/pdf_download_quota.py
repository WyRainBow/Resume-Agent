"""PDF 下载次数配额：非 admin 用户默认 10 次。"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import func, update
from sqlalchemy.orm import Session

try:
    from backend.models import User
except ImportError:
    from models import User

PDF_DOWNLOAD_LIMIT = 10
ADMIN_ROLE = "admin"
logger = logging.getLogger("backend")


def is_pdf_download_unlimited(user: User) -> bool:
    return getattr(user, "role", None) == ADMIN_ROLE


def get_pdf_download_count(user: User) -> int:
    return int(getattr(user, "pdf_download_count", 0) or 0)


def get_pdf_download_remaining(user: User) -> Optional[int]:
    if is_pdf_download_unlimited(user):
        return None
    return max(0, PDF_DOWNLOAD_LIMIT - get_pdf_download_count(user))


def build_quota_payload(user: User) -> Dict[str, Any]:
    unlimited = is_pdf_download_unlimited(user)
    used = get_pdf_download_count(user)
    return {
        "limit": None if unlimited else PDF_DOWNLOAD_LIMIT,
        "used": used,
        "remaining": get_pdf_download_remaining(user),
        "unlimited": unlimited,
    }


def _limit_exceeded_detail(user: User) -> Dict[str, Any]:
    used = get_pdf_download_count(user)
    return {
        "code": "PDF_DOWNLOAD_LIMIT_EXCEEDED",
        "message": f"PDF 下载次数已达上限（{PDF_DOWNLOAD_LIMIT} 次）",
        "limit": PDF_DOWNLOAD_LIMIT,
        "used": used,
        "remaining": 0,
    }


def assert_pdf_download_allowed(user: User) -> None:
    """下载前快速校验，避免超限用户继续下载。"""
    if is_pdf_download_unlimited(user):
        return
    if get_pdf_download_count(user) >= PDF_DOWNLOAD_LIMIT:
        logger.warning(
            "[PDF DOWNLOAD][quota_exceeded] code=PDF_DOWNLOAD_LIMIT_EXCEEDED "
            "user_id=%s username=%s role=%s used=%s limit=%s remaining=0",
            getattr(user, "id", "-"),
            getattr(user, "username", "-"),
            getattr(user, "role", "-"),
            get_pdf_download_count(user),
            PDF_DOWNLOAD_LIMIT,
        )
        raise HTTPException(status_code=403, detail=_limit_exceeded_detail(user))


def record_successful_pdf_download(user: User, db: Session) -> None:
    """渲染成功后原子递增计数，防止并发绕过上限。"""
    if is_pdf_download_unlimited(user):
        return

    result = db.execute(
        update(User)
        .where(User.id == user.id)
        .where(func.coalesce(User.pdf_download_count, 0) < PDF_DOWNLOAD_LIMIT)
        .values(pdf_download_count=func.coalesce(User.pdf_download_count, 0) + 1)
    )
    if result.rowcount == 0:
        db.rollback()
        db.refresh(user)
        logger.warning(
            "[PDF DOWNLOAD][quota_exceeded_after_race] code=PDF_DOWNLOAD_LIMIT_EXCEEDED "
            "user_id=%s username=%s role=%s used=%s limit=%s remaining=0",
            getattr(user, "id", "-"),
            getattr(user, "username", "-"),
            getattr(user, "role", "-"),
            get_pdf_download_count(user),
            PDF_DOWNLOAD_LIMIT,
        )
        raise HTTPException(status_code=403, detail=_limit_exceeded_detail(user))
    db.commit()
    db.refresh(user)
    quota = build_quota_payload(user)
    logger.info(
        "[PDF DOWNLOAD][recorded] user_id=%s username=%s role=%s used=%s limit=%s remaining=%s",
        getattr(user, "id", "-"),
        getattr(user, "username", "-"),
        getattr(user, "role", "-"),
        quota["used"],
        quota["limit"],
        quota["remaining"],
    )
