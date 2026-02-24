"""
Dashboard 性能日志上报路由
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import time

from fastapi import APIRouter, Request, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.logger import get_logger
from database import get_db
from auth import decode_access_token
from models import ApplicationProgress, CalendarEvent, Resume

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
logger = get_logger("backend.routes.dashboard_perf")


class DashboardPerfLogPayload(BaseModel):
    message: str
    step: Optional[str] = None
    elapsed_ms: Optional[float] = None
    pathname: Optional[str] = None
    ts: Optional[int] = None


class DashboardSummaryEntry(BaseModel):
    progress: Optional[str] = None
    application_date: Optional[str] = None


class DashboardSummaryMetrics(BaseModel):
    resume_query_ms: float
    progress_query_ms: float
    total_query_ms: float


class DashboardSummaryResponse(BaseModel):
    resume_count: int
    entries: List[DashboardSummaryEntry]
    interview_count: int = 0  # 面试日历中的日程数量（场）
    interview_count_this_week: int = 0  # 本周面试场次（周一 0 点至当前）
    metrics: DashboardSummaryMetrics


def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
) -> int:
    """轻量鉴权：只解析并校验 JWT，避免 dashboard summary 再做一次数据库鉴权查询。"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    user_id = payload.get("sub")
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Token 格式错误") from exc
    if not isinstance(user_id, int):
        raise HTTPException(status_code=401, detail="Token 格式错误")
    return user_id


@router.post("/perf-log")
def perf_log(payload: DashboardPerfLogPayload, request: Request):
    client_ip = request.client.host if request.client else "-"
    logger.info(
        f"[DashboardPerf] {payload.message} "
        f"step={payload.step or '-'} path={payload.pathname or '-'} client={client_ip}"
    )
    return {"ok": True}


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    total_start = time.perf_counter()

    resume_start = time.perf_counter()
    # 使用轻量 ID 查询后在内存计数，规避部分 MySQL 场景下 count() 的慢路径
    resume_ids = db.query(Resume.id).filter(Resume.user_id == user_id).all()
    resume_count = len(resume_ids)
    resume_query_ms = (time.perf_counter() - resume_start) * 1000

    progress_start = time.perf_counter()
    rows = (
        db.query(ApplicationProgress.progress, ApplicationProgress.application_date)
        .filter(ApplicationProgress.user_id == user_id)
        .all()
    )
    progress_query_ms = (time.perf_counter() - progress_start) * 1000

    calendar_start = time.perf_counter()
    try:
        interview_count = db.query(CalendarEvent).filter(CalendarEvent.user_id == user_id).count()
        # 本周一 0:00 至本周日 23:59:59（与日历显示的「本周」一致，中国时区）
        cn_tz = timezone(timedelta(hours=8))
        now_cn = datetime.now(cn_tz)
        today_cn = now_cn.date()
        # Monday = 0
        week_start_cn = today_cn - timedelta(days=today_cn.weekday())
        week_end_cn = week_start_cn + timedelta(days=6)
        week_start_dt = datetime(week_start_cn.year, week_start_cn.month, week_start_cn.day, 0, 0, 0, tzinfo=cn_tz)
        week_end_dt = datetime(week_end_cn.year, week_end_cn.month, week_end_cn.day, 23, 59, 59, 999999, tzinfo=cn_tz)
        interview_count_this_week = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.user_id == user_id,
                CalendarEvent.starts_at >= week_start_dt,
                CalendarEvent.starts_at <= week_end_dt,
            )
            .count()
        )
    except Exception:
        interview_count = 0
        interview_count_this_week = 0
    calendar_query_ms = (time.perf_counter() - calendar_start) * 1000
    total_query_ms = (time.perf_counter() - total_start) * 1000

    logger.info(
        f"[DashboardPerf] /api/dashboard/summary user_id={user_id} "
        f"resume_count={resume_count} entry_count={len(rows)} "
        f"interview_count={interview_count} interview_this_week={interview_count_this_week} "
        f"resume_query={resume_query_ms:.1f}ms progress_query={progress_query_ms:.1f}ms total={total_query_ms:.1f}ms"
    )

    entries = [
        DashboardSummaryEntry(
            progress=progress,
            application_date=application_date.isoformat() if application_date else None,
        )
        for progress, application_date in rows
    ]
    return DashboardSummaryResponse(
        resume_count=resume_count,
        entries=entries,
        interview_count=interview_count,
        interview_count_this_week=interview_count_this_week,
        metrics=DashboardSummaryMetrics(
            resume_query_ms=round(resume_query_ms, 1),
            progress_query_ms=round(progress_query_ms, 1),
            total_query_ms=round(total_query_ms, 1),
        ),
    )
