"""
日历日程 API
"""
from datetime import datetime
from time import sleep
from typing import Callable, Optional, TypeVar
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import inspect
from sqlalchemy.exc import DBAPIError, DisconnectionError, InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session
import logging

from database import get_db
from middleware.auth import get_current_user
from models import CalendarEvent, User

router = APIRouter(prefix="/api/calendar/events", tags=["Calendar"])
T = TypeVar("T")
logger = logging.getLogger("backend")
_calendar_table_ready = False


def _ensure_calendar_table(db: Session) -> None:
    """本地开发兜底：如果未执行迁移，自动创建 calendar_events 表。"""
    global _calendar_table_ready
    if _calendar_table_ready:
        return
    bind = db.get_bind()
    if bind is None:
        return
    inspector = inspect(bind)
    if not inspector.has_table("calendar_events"):
        CalendarEvent.__table__.create(bind=bind, checkfirst=True)
        logger.warning("[Calendar] 检测到 calendar_events 缺失，已自动创建（建议补跑 alembic upgrade head）")
    _calendar_table_ready = True


def _is_connection_error(exc: Exception) -> bool:
    if isinstance(exc, (OperationalError, InterfaceError, DisconnectionError)):
        return True
    if isinstance(exc, DBAPIError):
        if getattr(exc, "connection_invalidated", False):
            return True
        orig = getattr(exc, "orig", None)
        args = getattr(orig, "args", ()) if orig is not None else ()
        if args:
            code = args[0]
            if code in (0, 2006, 2013, 2055):
                return True
    return False


def _run_with_db_retry(db: Session, fn: Callable[[], T], retries: int = 3) -> T:
    """数据库短暂断连时重试，最终返回 503 而不是 500。"""
    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            _ensure_calendar_table(db)
            return fn()
        except Exception as exc:
            if _is_connection_error(exc):
                last_error = exc
                db.rollback()
                try:
                    db.invalidate()
                except Exception:
                    pass
                logger.warning(f"[Calendar] 数据库连接异常，重试 {attempt + 1}/{retries + 1}: {exc}")
                if attempt < retries:
                    sleep(0.15 * (attempt + 1))
                    continue
                raise HTTPException(status_code=503, detail="数据库连接异常，请稍后重试") from exc
            if isinstance(exc, SQLAlchemyError):
                logger.error(f"[Calendar] SQL 执行失败（非连接异常）: {exc}")
                db.rollback()
                raise HTTPException(status_code=500, detail="日历服务异常，请稍后重试") from exc
            raise
    raise HTTPException(status_code=503, detail="数据库连接异常，请稍后重试") from last_error


class CalendarEventPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    starts_at: str
    ends_at: str
    is_all_day: bool = False
    location: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
    color: Optional[str] = Field(default=None, max_length=32)


class CalendarEventPatchPayload(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_all_day: Optional[bool] = None
    location: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
    color: Optional[str] = Field(default=None, max_length=32)


class CalendarEventResponse(BaseModel):
    id: str
    user_id: int
    title: str
    starts_at: str
    ends_at: str
    is_all_day: bool
    location: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
        return dt
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{field_name} 不是有效的 ISO 时间") from exc


def _to_response(row: CalendarEvent) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=row.id,
        user_id=row.user_id,
        title=row.title,
        starts_at=row.starts_at.isoformat(),
        ends_at=row.ends_at.isoformat(),
        is_all_day=bool(row.is_all_day),
        location=row.location,
        notes=row.notes,
        color=row.color,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.get("", response_model=list[CalendarEventResponse])
def list_events(
    start: str = Query(..., description="ISO datetime"),
    end: str = Query(..., description="ISO datetime"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_dt = _parse_iso_datetime(start, "start")
    end_dt = _parse_iso_datetime(end, "end")
    if end_dt <= start_dt:
        raise HTTPException(status_code=422, detail="end 必须晚于 start")

    rows = _run_with_db_retry(
        db,
        lambda: (
            db.query(CalendarEvent)
            .filter(CalendarEvent.user_id == current_user.id)
            .filter(CalendarEvent.starts_at < end_dt)
            .filter(CalendarEvent.ends_at > start_dt)
            .order_by(CalendarEvent.starts_at.asc())
            .all()
        ),
    )
    return [_to_response(row) for row in rows]


@router.post("", response_model=CalendarEventResponse)
def create_event(
    payload: CalendarEventPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="title 不能为空")

    starts_at = _parse_iso_datetime(payload.starts_at, "starts_at")
    ends_at = _parse_iso_datetime(payload.ends_at, "ends_at")
    if ends_at <= starts_at:
        raise HTTPException(status_code=422, detail="ends_at 必须晚于 starts_at")

    row = CalendarEvent(
        id=str(uuid4()),
        user_id=current_user.id,
        title=title,
        starts_at=starts_at,
        ends_at=ends_at,
        is_all_day=bool(payload.is_all_day),
        location=payload.location,
        notes=payload.notes,
        color=payload.color or "#2563eb",
    )

    def _save_and_refresh() -> None:
        db.add(row)
        db.commit()
        db.refresh(row)

    _run_with_db_retry(db, _save_and_refresh)
    return _to_response(row)


@router.patch("/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: str,
    payload: CalendarEventPatchPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _run_with_db_retry(
        db,
        lambda: (
            db.query(CalendarEvent)
            .filter(CalendarEvent.id == event_id, CalendarEvent.user_id == current_user.id)
            .first()
        ),
    )
    if not row:
        raise HTTPException(status_code=404, detail="日程不存在")

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=422, detail="title 不能为空")
        row.title = title
    if payload.starts_at is not None:
        row.starts_at = _parse_iso_datetime(payload.starts_at, "starts_at")
    if payload.ends_at is not None:
        row.ends_at = _parse_iso_datetime(payload.ends_at, "ends_at")
    if row.ends_at <= row.starts_at:
        raise HTTPException(status_code=422, detail="ends_at 必须晚于 starts_at")
    if payload.is_all_day is not None:
        row.is_all_day = bool(payload.is_all_day)
    if payload.location is not None:
        row.location = payload.location
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.color is not None:
        row.color = payload.color

    def _commit_and_refresh() -> None:
        db.commit()
        db.refresh(row)

    _run_with_db_retry(db, _commit_and_refresh)
    return _to_response(row)


@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _run_with_db_retry(
        db,
        lambda: (
            db.query(CalendarEvent)
            .filter(CalendarEvent.id == event_id, CalendarEvent.user_id == current_user.id)
            .first()
        ),
    )
    if not row:
        raise HTTPException(status_code=404, detail="日程不存在")

    def _delete() -> None:
        db.delete(row)
        db.commit()

    _run_with_db_retry(db, _delete)
    return {"ok": True}
