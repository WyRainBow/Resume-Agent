"""
投递进展表 API
"""
from typing import List, Optional, Any, Callable, TypeVar
from uuid import uuid4
from datetime import date, datetime
import json as _json
import re
import os
from time import sleep

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from database import get_db
from models import ApplicationProgress, User
from middleware.auth import get_current_user
from llm import call_llm
try:
    from backend.prompts import build_application_progress_parse_prompt
except Exception:
    from prompts import build_application_progress_parse_prompt

try:
    from backend.agent.services.intent.intent_classifier import IntentClassifier
except Exception:
    IntentClassifier = None

try:
    from zhipuai import ZhipuAI
except Exception:
    ZhipuAI = None

router = APIRouter(prefix="/api/application-progress", tags=["ApplicationProgress"])
T = TypeVar("T")
_zhipu_client: Optional[Any] = None
_zhipu_key_cache: Optional[str] = None


def _run_with_db_retry(db: Session, fn: Callable[[], T], retries: int = 1) -> T:
    """数据库短暂断连时重试，最终返回 503 而不是 500。"""
    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except OperationalError as exc:
            last_error = exc
            db.rollback()
            if attempt < retries:
                sleep(0.1)
                continue
        except SQLAlchemyError as exc:
            last_error = exc
            db.rollback()
            break
    raise HTTPException(status_code=503, detail="数据库连接异常，请稍后重试") from last_error


class ApplicationProgressPayload(BaseModel):
    company: Optional[str] = None
    application_link: Optional[str] = None
    industry: Optional[str] = None
    tags: Optional[List[str]] = None
    position: Optional[str] = None
    location: Optional[str] = None
    progress: Optional[str] = None
    progress_status: Optional[str] = None
    progress_time: Optional[str] = None  # ISO datetime
    notes: Optional[str] = None
    application_date: Optional[str] = None  # YYYY-MM-DD
    referral_code: Optional[str] = None
    link2: Optional[str] = None
    resume_id: Optional[str] = None
    sort_order: Optional[int] = None


class ApplicationProgressResponse(BaseModel):
    id: str
    user_id: int
    sort_order: int
    company: Optional[str] = None
    application_link: Optional[str] = None
    industry: Optional[str] = None
    tags: Optional[List[str]] = None
    position: Optional[str] = None
    location: Optional[str] = None
    progress: Optional[str] = None
    progress_status: Optional[str] = None
    progress_time: Optional[str] = None
    notes: Optional[str] = None
    application_date: Optional[str] = None
    referral_code: Optional[str] = None
    link2: Optional[str] = None
    resume_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


def _row_to_response(row: ApplicationProgress) -> ApplicationProgressResponse:
    return ApplicationProgressResponse(
        id=row.id,
        user_id=row.user_id,
        sort_order=row.sort_order,
        company=row.company,
        application_link=row.application_link,
        industry=row.industry,
        tags=row.tags,
        position=row.position,
        location=row.location,
        progress=row.progress,
        progress_status=row.progress_status,
        progress_time=row.progress_time.isoformat() if row.progress_time else None,
        notes=row.notes,
        application_date=row.application_date.isoformat() if row.application_date else None,
        referral_code=row.referral_code,
        link2=row.link2,
        resume_id=row.resume_id,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.get("", response_model=List[ApplicationProgressResponse])
def list_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户所有投递记录，按 sort_order、updated_at 排序"""
    rows = _run_with_db_retry(
        db,
        lambda: (
            db.query(ApplicationProgress)
            .filter(ApplicationProgress.user_id == current_user.id)
            .order_by(ApplicationProgress.sort_order.asc(), ApplicationProgress.updated_at.desc())
            .all()
        ),
    )
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=ApplicationProgressResponse)
def create_entry(
    payload: ApplicationProgressPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建一条投递记录"""
    max_order = _run_with_db_retry(
        db,
        lambda: (
            db.query(ApplicationProgress)
            .filter(ApplicationProgress.user_id == current_user.id)
            .count()
        ),
    )
    progress_time = None
    if payload.progress_time:
        try:
            progress_time = datetime.fromisoformat(payload.progress_time.replace("Z", "+00:00"))
        except Exception:
            pass
    application_date = None
    if payload.application_date:
        try:
            application_date = date.fromisoformat(payload.application_date)
        except Exception:
            pass
    row = ApplicationProgress(
        id=f"ap_{uuid4().hex}",
        user_id=current_user.id,
        sort_order=payload.sort_order if payload.sort_order is not None else max_order,
        company=payload.company,
        application_link=payload.application_link,
        industry=payload.industry,
        tags=payload.tags,
        position=payload.position,
        location=payload.location,
        progress=payload.progress,
        progress_status=payload.progress_status,
        progress_time=progress_time,
        notes=payload.notes,
        application_date=application_date,
        referral_code=payload.referral_code,
        link2=payload.link2,
        resume_id=payload.resume_id,
    )
    def _save_and_refresh() -> None:
        db.add(row)
        db.commit()
        db.refresh(row)

    _run_with_db_retry(db, _save_and_refresh)
    return _row_to_response(row)


@router.patch("/{entry_id}", response_model=ApplicationProgressResponse)
def update_entry(
    entry_id: str,
    payload: ApplicationProgressPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新单条投递记录（部分字段）"""
    row = _run_with_db_retry(
        db,
        lambda: (
            db.query(ApplicationProgress)
            .filter(ApplicationProgress.id == entry_id, ApplicationProgress.user_id == current_user.id)
            .first()
        ),
    )
    if not row:
        raise HTTPException(status_code=404, detail="记录不存在")
    if payload.company is not None:
        row.company = payload.company
    if payload.application_link is not None:
        row.application_link = payload.application_link
    if payload.industry is not None:
        row.industry = payload.industry
    if payload.tags is not None:
        row.tags = payload.tags
    if payload.position is not None:
        row.position = payload.position
    if payload.location is not None:
        row.location = payload.location
    if payload.progress is not None:
        row.progress = payload.progress
    if payload.progress_status is not None:
        row.progress_status = payload.progress_status
    if payload.progress_time is not None:
        try:
            row.progress_time = datetime.fromisoformat(payload.progress_time.replace("Z", "+00:00"))
        except Exception:
            pass
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.application_date is not None:
        try:
            row.application_date = date.fromisoformat(payload.application_date)
        except Exception:
            pass
    if payload.referral_code is not None:
        row.referral_code = payload.referral_code
    if payload.link2 is not None:
        row.link2 = payload.link2
    if payload.resume_id is not None:
        row.resume_id = payload.resume_id
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    def _commit_and_refresh() -> None:
        db.commit()
        db.refresh(row)

    _run_with_db_retry(db, _commit_and_refresh)
    return _row_to_response(row)


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除单条投递记录"""
    row = _run_with_db_retry(
        db,
        lambda: (
            db.query(ApplicationProgress)
            .filter(ApplicationProgress.id == entry_id, ApplicationProgress.user_id == current_user.id)
            .first()
        ),
    )
    if not row:
        raise HTTPException(status_code=404, detail="记录不存在")
    def _delete_and_commit() -> None:
        db.delete(row)
        db.commit()

    _run_with_db_retry(db, _delete_and_commit)
    return {"success": True}


class ReorderPayload(BaseModel):
    order: List[str]  # list of entry ids in new order


class ApplicationProgressAIParseRequest(BaseModel):
    text: Optional[str] = None
    image_data_url: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class ApplicationProgressAIParseResponse(BaseModel):
    company: Optional[str] = None
    application_link: Optional[str] = None
    industry: Optional[str] = None
    position: Optional[str] = None
    location: Optional[str] = None
    progress: Optional[str] = None
    notes: Optional[str] = None
    application_date: Optional[str] = None
    referral_code: Optional[str] = None


def _clean_llm_response(raw: str) -> str:
    cleaned = re.sub(r"<\|begin_of_box\|>", "", raw)
    cleaned = re.sub(r"<\|end_of_box\|>", "", cleaned)
    cleaned = re.sub(r"```json\s*", "", cleaned)
    cleaned = re.sub(r"```\s*", "", cleaned)
    return cleaned.strip()


def _parse_json_response(cleaned: str) -> dict:
    try:
        return _json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return _json.loads(cleaned[start : end + 1])
        raise


def _get_zhipu_client() -> Any:
    global _zhipu_client, _zhipu_key_cache
    key = os.getenv("ZHIPU_API_KEY", "")
    if not key:
        raise HTTPException(status_code=400, detail="缺少 ZHIPU_API_KEY")
    if ZhipuAI is None:
        raise HTTPException(status_code=500, detail="zhipuai 未安装")
    if _zhipu_client is None or _zhipu_key_cache != key:
        _zhipu_client = ZhipuAI(api_key=key)
        _zhipu_key_cache = key
    return _zhipu_client


def _zhipu_vision_parse(image_data_url: str, prompt: str, model: str) -> str:
    if not image_data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="image_data_url 必须是 data:image/... base64")
    client = _get_zhipu_client()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=1200,
        )
        msg = resp.choices[0].message
        content = msg.content or ""
        if isinstance(content, list):
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        text_parts.append(text)
            content = "\n".join(text_parts)
        if not isinstance(content, str) or not content.strip():
            raise ValueError("智谱未返回可解析内容")
        return content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"智谱图片解析失败: {e}")


@router.post("/ai-parse", response_model=ApplicationProgressAIParseResponse)
def ai_parse_entry(
    body: ApplicationProgressAIParseRequest,
    current_user: User = Depends(get_current_user),
):
    """
    使用 LLM 对自然语言做意图识别与结构化抽取，返回投递记录字段。
    """
    text = (body.text or "").strip()
    image_data_url = (body.image_data_url or "").strip()
    if not text and not image_data_url:
        raise HTTPException(status_code=400, detail="text 或 image_data_url 至少提供一个")

    provider = body.provider or "zhipu"
    model = body.model or "glm-4.6v"
    intent_hint = ""
    if text and IntentClassifier is not None:
        try:
            classifier = IntentClassifier(use_llm=False)
            intent_result = classifier.classify_sync(text)
            intent_hint = f"{intent_result.intent_type.value}; confidence={intent_result.confidence:.2f}; reasoning={intent_result.reasoning}"
        except Exception:
            intent_hint = ""

    prompt = build_application_progress_parse_prompt(
        text=text or "（用户仅上传了截图，请仅根据图片内容提取）",
        intent_hint=intent_hint,
    )
    try:
        if image_data_url:
            if provider != "zhipu":
                raise HTTPException(status_code=400, detail="图片解析仅支持 zhipu provider")
            raw = _zhipu_vision_parse(image_data_url=image_data_url, prompt=prompt, model=model)
        else:
            raw = call_llm(provider, prompt, model=model)
        cleaned = _clean_llm_response(raw)
        data = _parse_json_response(cleaned)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 解析失败: {e}")

    if isinstance(data.get("application_date"), str):
        val = data["application_date"].strip()
        if val in ("今天", "today", "Today"):
            data["application_date"] = date.today().isoformat()

    allowed_industry = {"互联网", "金融", "制造业"}
    if data.get("industry") not in allowed_industry:
        data["industry"] = None

    allowed_location = {"深圳", "北京", "上海", "广州"}
    if data.get("location") not in allowed_location:
        data["location"] = None

    allowed_progress = {
        "已投简历",
        "简历挂",
        "测评未做",
        "测评完成",
        "等待一面",
        "一面完成",
        "一面被刷",
        "等待二面",
        "二面完成",
        "二面被刷",
        # 兼容历史值
        "已投递",
        "笔试",
        "一面",
        "二面",
        "三面",
        "offer",
    }
    if data.get("progress") not in allowed_progress:
        data["progress"] = None

    return ApplicationProgressAIParseResponse(
        company=data.get("company"),
        application_link=data.get("application_link"),
        industry=data.get("industry"),
        position=data.get("position"),
        location=data.get("location"),
        progress=data.get("progress"),
        notes=data.get("notes"),
        application_date=data.get("application_date"),
        referral_code=data.get("referral_code"),
    )


@router.patch("/reorder")
def reorder_entries(
    payload: ReorderPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """批量更新 sort_order（拖拽后）"""
    def _do_reorder() -> None:
        for i, entry_id in enumerate(payload.order):
            row = (
                db.query(ApplicationProgress)
                .filter(ApplicationProgress.id == entry_id, ApplicationProgress.user_id == current_user.id)
                .first()
            )
            if row:
                row.sort_order = i
        db.commit()

    _run_with_db_retry(db, _do_reorder)
    return {"success": True}
