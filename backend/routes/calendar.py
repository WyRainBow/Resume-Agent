"""
日历日程 API
"""
from datetime import datetime, timedelta, timezone
import json as _json
import os
import re
from time import sleep
from typing import Any, Callable, Optional, TypeVar
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
from llm import call_llm
try:
    from backend.prompts import build_calendar_event_parse_prompt
except Exception:
    from prompts import build_calendar_event_parse_prompt

try:
    from backend.agent.services.intent.intent_classifier import IntentClassifier
except Exception:
    IntentClassifier = None

router = APIRouter(prefix="/api/calendar/events", tags=["Calendar"])
T = TypeVar("T")
logger = logging.getLogger("backend")
_calendar_table_ready = False
CHINA_TZ = timezone(timedelta(hours=8))


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


class CalendarEventAIParseRequest(BaseModel):
    text: Optional[str] = None
    provider: Optional[str] = "deepseek"
    model: Optional[str] = None


class CalendarEventAIParseResponse(BaseModel):
    title: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_all_day: bool = False
    location: Optional[str] = None
    notes: Optional[str] = None


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
            # 面试日历统一按中国时区解释无时区输入
            dt = dt.replace(tzinfo=CHINA_TZ)
        return dt
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{field_name} 不是有效的 ISO 时间") from exc


def _parse_ai_datetime_to_china(value: str, field_name: str) -> datetime:
    """
    AI 导入语义统一按中国时区解释，忽略模型可能输出的 Z/其他偏移。
    """
    raw = value.strip()
    if not raw:
        raise HTTPException(status_code=422, detail=f"{field_name} 不能为空")
    # 规范到 YYYY-MM-DDTHH:MM:SS（截断时区后缀）
    core = raw.replace(" ", "T")
    if "T" in core:
        core = core[:19]
    try:
        dt = datetime.fromisoformat(core)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{field_name} 不是有效的时间格式") from exc
    return dt.replace(tzinfo=CHINA_TZ)


def _to_response(row: CalendarEvent) -> CalendarEventResponse:
    starts_at = row.starts_at.astimezone(CHINA_TZ) if row.starts_at.tzinfo else row.starts_at.replace(tzinfo=CHINA_TZ)
    ends_at = row.ends_at.astimezone(CHINA_TZ) if row.ends_at.tzinfo else row.ends_at.replace(tzinfo=CHINA_TZ)
    created_at = None
    updated_at = None
    if row.created_at:
        created_at = row.created_at.astimezone(CHINA_TZ).isoformat() if row.created_at.tzinfo else row.created_at.replace(tzinfo=CHINA_TZ).isoformat()
    if row.updated_at:
        updated_at = row.updated_at.astimezone(CHINA_TZ).isoformat() if row.updated_at.tzinfo else row.updated_at.replace(tzinfo=CHINA_TZ).isoformat()
    return CalendarEventResponse(
        id=row.id,
        user_id=row.user_id,
        title=row.title,
        starts_at=starts_at.isoformat(),
        ends_at=ends_at.isoformat(),
        is_all_day=bool(row.is_all_day),
        location=row.location,
        notes=row.notes,
        color=row.color,
        created_at=created_at,
        updated_at=updated_at,
    )


def _clean_llm_response(raw: Any) -> str:
    text = raw if isinstance(raw, str) else str(raw)
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*", "", cleaned).strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()
    return cleaned


def _parse_json_response(cleaned: str) -> dict:
    try:
        return _json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return _json.loads(cleaned[start : end + 1])
        raise


def _to_int_hour(token: str) -> Optional[int]:
    mapping = {
        "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
        "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12,
    }
    token = token.strip()
    if token.isdigit():
        return int(token)
    return mapping.get(token)


def _rule_parse_calendar_text(text: str) -> dict[str, Any]:
    """
    基于中文规则的兜底解析（优先保证日期/时间准确）。
    """
    now_cn = datetime.now(CHINA_TZ)
    year = now_cn.year
    month = now_cn.month
    day = now_cn.day

    m_ymd = re.search(r"(\d{4})[年\./-](\d{1,2})[月\./-](\d{1,2})", text)
    if m_ymd:
        year = int(m_ymd.group(1))
        month = int(m_ymd.group(2))
        day = int(m_ymd.group(3))
    else:
        m_md = re.search(r"(\d{1,2})[月\./-](\d{1,2})(?:日|号)?", text)
        if m_md:
            month = int(m_md.group(1))
            day = int(m_md.group(2))
        elif "今天" in text:
            pass
        elif "明天" in text:
            dt = now_cn + timedelta(days=1)
            year, month, day = dt.year, dt.month, dt.day
        elif "后天" in text:
            dt = now_cn + timedelta(days=2)
            year, month, day = dt.year, dt.month, dt.day

    period = ""
    for p in ("凌晨", "早上", "上午", "中午", "下午", "晚上"):
        if p in text:
            period = p
            break

    start_hour: Optional[int] = None
    start_min = 0
    end_hour: Optional[int] = None
    end_min = 0

    m_range = re.search(
        r"([零一二两三四五六七八九十\d]{1,3})点(?:(\d{1,2})分?)?\s*(?:到|至|\-|—|~|～)\s*([零一二两三四五六七八九十\d]{1,3})点(?:(\d{1,2})分?)?",
        text,
    )
    if m_range:
        sh = _to_int_hour(m_range.group(1))
        eh = _to_int_hour(m_range.group(3))
        if sh is not None and eh is not None:
            start_hour = sh
            end_hour = eh
            start_min = int(m_range.group(2) or 0)
            end_min = int(m_range.group(4) or 0)
    else:
        m_single = re.search(r"([零一二两三四五六七八九十\d]{1,3})点(?:(\d{1,2})分?)?", text)
        if m_single:
            sh = _to_int_hour(m_single.group(1))
            if sh is not None:
                start_hour = sh
                start_min = int(m_single.group(2) or 0)

    if start_hour is not None:
        if period in ("下午", "晚上") and start_hour < 12:
            start_hour += 12
        if period == "中午" and start_hour < 11:
            start_hour += 12
        if period == "凌晨" and start_hour == 12:
            start_hour = 0

    if end_hour is not None:
        if period in ("下午", "晚上") and end_hour < 12:
            end_hour += 12
        if period == "中午" and end_hour < 11:
            end_hour += 12
        if period == "凌晨" and end_hour == 12:
            end_hour = 0

    if start_hour is not None and end_hour is None:
        duration_minutes = 60
        m_dur_h = re.search(r"(\d+(?:\.\d+)?)\s*个?小时", text)
        m_dur_m = re.search(r"(\d+)\s*分钟", text)
        if m_dur_h:
            duration_minutes = int(float(m_dur_h.group(1)) * 60)
        elif m_dur_m:
            duration_minutes = int(m_dur_m.group(1))
        end_minutes_total = start_hour * 60 + start_min + max(1, duration_minutes)
        end_hour = (end_minutes_total // 60) % 24
        end_min = end_minutes_total % 60

    notes_parts: list[str] = []
    m_dept = re.search(r"(?:部门|团队|平台)[是为:：]?\s*([^，。,.；;]+)", text)
    if m_dept:
        notes_parts.append(m_dept.group(0).strip())

    title = None
    m_title = re.search(r"(腾讯|字节|快手|阿里|美团|京东|百度|拼多多|小米|华为)[^，。,.；;]{0,12}(?:一面|二面|三面|HR面|面试)", text)
    if m_title:
        title = m_title.group(0).strip()

    result: dict[str, Any] = {
        "title": title,
        "notes": "；".join(notes_parts) if notes_parts else None,
        "starts_at": None,
        "ends_at": None,
    }
    if start_hour is not None and end_hour is not None:
        start_dt = datetime(year, month, day, start_hour, start_min, 0, tzinfo=CHINA_TZ)
        end_dt = datetime(year, month, day, end_hour, end_min, 0, tzinfo=CHINA_TZ)
        if end_dt <= start_dt:
            end_dt = start_dt + timedelta(hours=1)
        result["starts_at"] = start_dt
        result["ends_at"] = end_dt
    return result


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


@router.post("/ai-parse", response_model=CalendarEventAIParseResponse)
def ai_parse_calendar_event(
    body: CalendarEventAIParseRequest,
    current_user: User = Depends(get_current_user),
):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")

    provider = body.provider or "deepseek"
    model = body.model or os.getenv("DEEPSEEK_MODEL") or "deepseek-v3.2"
    intent_hint = ""
    if IntentClassifier is not None:
        try:
            classifier = IntentClassifier(use_llm=False)
            intent_result = classifier.classify_sync(text)
            intent_hint = f"{intent_result.intent_type.value}; confidence={intent_result.confidence:.2f}; reasoning={intent_result.reasoning}"
        except Exception:
            intent_hint = ""

    prompt = build_calendar_event_parse_prompt(
        text=text,
        intent_hint=intent_hint,
        now_iso=datetime.now().astimezone().isoformat(),
    )
    rule_data = _rule_parse_calendar_text(text)
    try:
        raw = call_llm(provider, prompt, model=model)
        cleaned = _clean_llm_response(raw)
        data = _parse_json_response(cleaned)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 解析失败: {exc}") from exc

    parsed_title = rule_data.get("title") or data.get("title")
    parsed_start = rule_data.get("starts_at") or data.get("starts_at")
    parsed_end = rule_data.get("ends_at") or data.get("ends_at")
    parsed_notes = data.get("notes")
    if rule_data.get("notes"):
        parsed_notes = f"{parsed_notes or ''}；{rule_data['notes']}".strip("；")
    parsed_location = data.get("location")
    parsed_is_all_day = bool(data.get("is_all_day") is True)

    if not isinstance(parsed_title, str) or not parsed_title.strip():
        raise HTTPException(status_code=422, detail="AI 未能提取标题，请补充公司或面试轮次")
    parsed_title = parsed_title.strip()

    if isinstance(parsed_start, datetime):
        start_dt = parsed_start.astimezone(CHINA_TZ)
    elif not isinstance(parsed_start, str) or not parsed_start.strip():
        raise HTTPException(status_code=422, detail="AI 未能提取开始时间，请补充具体日期和时间")
    else:
        start_dt = _parse_ai_datetime_to_china(parsed_start.strip(), "starts_at")

    if isinstance(parsed_end, datetime):
        end_dt = parsed_end.astimezone(CHINA_TZ)
    elif isinstance(parsed_end, str) and parsed_end.strip():
        end_dt = _parse_ai_datetime_to_china(parsed_end.strip(), "ends_at")
    else:
        end_dt = start_dt + timedelta(hours=1)
    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(hours=1)

    normalized_notes = parsed_notes.strip() if isinstance(parsed_notes, str) and parsed_notes.strip() else None
    normalized_location = parsed_location.strip() if isinstance(parsed_location, str) and parsed_location.strip() else None

    return CalendarEventAIParseResponse(
        title=parsed_title,
        starts_at=start_dt.isoformat(),
        ends_at=end_dt.isoformat(),
        is_all_day=parsed_is_all_day,
        location=normalized_location,
        notes=normalized_notes,
    )


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
