"""后台管理：请求日志与错误日志。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from middleware.auth import require_admin_or_member
from models import APIErrorLog, APIRequestLog, User

router = APIRouter(prefix="/api/admin/logs", tags=["AdminLogs"])


class APIRequestLogItem(BaseModel):
    id: int
    trace_id: str
    request_id: str
    method: str
    path: str
    status_code: int
    latency_ms: float
    user_id: Optional[int] = None
    ip: Optional[str] = None
    created_at: Optional[str] = None


class APIRequestLogsResponse(BaseModel):
    items: list[APIRequestLogItem]
    total: int
    page: int
    page_size: int


class APIErrorLogItem(BaseModel):
    id: int
    request_log_id: Optional[int] = None
    trace_id: str
    error_type: Optional[str] = None
    error_message: str
    service: Optional[str] = None
    created_at: Optional[str] = None


class APIErrorLogsResponse(BaseModel):
    items: list[APIErrorLogItem]
    total: int
    page: int
    page_size: int


@router.get("/requests", response_model=APIRequestLogsResponse)
def list_request_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    trace_id: Optional[str] = None,
    path: Optional[str] = None,
    status_code: Optional[int] = None,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    query = db.query(APIRequestLog)
    if trace_id:
        query = query.filter(APIRequestLog.trace_id == trace_id)
    if path:
        query = query.filter(APIRequestLog.path.like(f"%{path}%"))
    if status_code is not None:
        query = query.filter(APIRequestLog.status_code == status_code)

    total = query.count()
    rows = query.order_by(APIRequestLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return APIRequestLogsResponse(
        items=[
            APIRequestLogItem(
                id=row.id,
                trace_id=row.trace_id,
                request_id=row.request_id,
                method=row.method,
                path=row.path,
                status_code=row.status_code,
                latency_ms=row.latency_ms,
                user_id=row.user_id,
                ip=row.ip,
                created_at=row.created_at.isoformat() if row.created_at else None,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/errors", response_model=APIErrorLogsResponse)
def list_error_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    trace_id: Optional[str] = None,
    keyword: Optional[str] = None,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    query = db.query(APIErrorLog)
    if trace_id:
        query = query.filter(APIErrorLog.trace_id == trace_id)
    if keyword:
        query = query.filter(APIErrorLog.error_message.like(f"%{keyword}%"))

    total = query.count()
    rows = query.order_by(APIErrorLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return APIErrorLogsResponse(
        items=[
            APIErrorLogItem(
                id=row.id,
                request_log_id=row.request_log_id,
                trace_id=row.trace_id,
                error_type=row.error_type,
                error_message=row.error_message,
                service=row.service,
                created_at=row.created_at.isoformat() if row.created_at else None,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
