"""后台管理：链路追踪。"""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from database import get_db
from middleware.auth import require_admin_or_member
from models import APIRequestLog, APITraceSpan, User

router = APIRouter(prefix="/api/admin/traces", tags=["AdminTraces"])


class TraceListItem(BaseModel):
    trace_id: str
    latest_at: Optional[str] = None
    request_count: int
    error_count: int
    avg_latency_ms: float


class TraceListResponse(BaseModel):
    items: list[TraceListItem]
    total: int
    page: int
    page_size: int


class TraceSpanItem(BaseModel):
    span_id: str
    parent_span_id: Optional[str] = None
    span_name: str
    start_time: str
    end_time: str
    duration_ms: float
    status: str
    tags: Optional[dict] = None


class TraceDetailResponse(BaseModel):
    trace_id: str
    spans: list[TraceSpanItem]


@router.get("", response_model=TraceListResponse)
def list_traces(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    trace_id: Optional[str] = None,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    query = (
        db.query(
            APIRequestLog.trace_id.label("trace_id"),
            func.max(APIRequestLog.created_at).label("latest_at"),
            func.count(APIRequestLog.id).label("request_count"),
            func.sum(case((APIRequestLog.status_code >= 500, 1), else_=0)).label("error_count"),
            func.avg(APIRequestLog.latency_ms).label("avg_latency_ms"),
        )
        .group_by(APIRequestLog.trace_id)
    )
    if trace_id:
        query = query.filter(APIRequestLog.trace_id == trace_id)

    total = query.count()
    rows = query.order_by(func.max(APIRequestLog.created_at).desc()).offset((page - 1) * page_size).limit(page_size).all()
    return TraceListResponse(
        items=[
            TraceListItem(
                trace_id=row.trace_id,
                latest_at=row.latest_at.isoformat() if row.latest_at else None,
                request_count=int(row.request_count or 0),
                error_count=int(row.error_count or 0),
                avg_latency_ms=float(row.avg_latency_ms or 0),
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{trace_id}", response_model=TraceDetailResponse)
def get_trace_detail(
    trace_id: str,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(APITraceSpan)
        .filter(APITraceSpan.trace_id == trace_id)
        .order_by(APITraceSpan.start_time.asc())
        .all()
    )
    if not rows:
        req_rows = (
            db.query(APIRequestLog)
            .filter(APIRequestLog.trace_id == trace_id)
            .order_by(APIRequestLog.created_at.asc())
            .all()
        )
        if not req_rows:
            raise HTTPException(status_code=404, detail="trace 不存在")

        synthetic_spans: list[TraceSpanItem] = []
        for row in req_rows:
            start = row.created_at
            end = row.created_at + timedelta(milliseconds=float(row.latency_ms or 0))
            synthetic_spans.append(
                TraceSpanItem(
                    span_id=row.request_id,
                    parent_span_id=None,
                    span_name=f"{row.method} {row.path}",
                    start_time=start.isoformat() if start else "",
                    end_time=end.isoformat() if end else "",
                    duration_ms=float(row.latency_ms or 0),
                    status="error" if row.status_code >= 500 else "ok",
                    tags={
                        "status_code": row.status_code,
                        "ip": row.ip,
                        "user_id": row.user_id,
                    },
                )
            )
        return TraceDetailResponse(trace_id=trace_id, spans=synthetic_spans)

    return TraceDetailResponse(
        trace_id=trace_id,
        spans=[
            TraceSpanItem(
                span_id=row.span_id,
                parent_span_id=row.parent_span_id,
                span_name=row.span_name,
                start_time=row.start_time.isoformat(),
                end_time=row.end_time.isoformat(),
                duration_ms=row.duration_ms,
                status=row.status,
                tags=row.tags,
            )
            for row in rows
        ],
    )
