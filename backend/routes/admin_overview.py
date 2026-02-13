"""后台管理：概览指标。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from middleware.auth import require_admin_or_member
from models import APIErrorLog, APIRequestLog, Member, User

router = APIRouter(prefix="/api/admin/overview", tags=["AdminOverview"])


class OverviewResponse(BaseModel):
    total_users: int
    total_members: int
    requests_24h: int
    errors_24h: int
    error_rate_24h: float
    avg_latency_ms_24h: float


@router.get("", response_model=OverviewResponse)
def get_overview(
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_members = db.query(func.count(Member.id)).scalar() or 0
    requests_24h = db.query(func.count(APIRequestLog.id)).filter(APIRequestLog.created_at >= since).scalar() or 0
    errors_24h = db.query(func.count(APIErrorLog.id)).filter(APIErrorLog.created_at >= since).scalar() or 0
    avg_latency = (
        db.query(func.avg(APIRequestLog.latency_ms))
        .filter(APIRequestLog.created_at >= since)
        .scalar()
        or 0
    )
    error_rate = (float(errors_24h) / float(requests_24h) * 100.0) if requests_24h > 0 else 0.0
    return OverviewResponse(
        total_users=int(total_users),
        total_members=int(total_members),
        requests_24h=int(requests_24h),
        errors_24h=int(errors_24h),
        error_rate_24h=round(error_rate, 2),
        avg_latency_ms_24h=round(float(avg_latency), 2),
    )
