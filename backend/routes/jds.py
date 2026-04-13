from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.agent.jd_alignment.fetcher import (
    JDFetchError,
    fetch_job_description_from_url,
)
from backend.agent.jd_alignment.orchestrator import JDAlignmentOrchestrator
from backend.agent.jd_alignment.parser_agent import JDParserAgent
from backend.agent.llm import LLM
from backend.agent.model_profiles import (
    get_profile_disabled_reason,
    is_profile_configured,
    is_profile_supported,
    resolve_profile_name,
)
from backend.database import get_db
from backend.jd_models import JDAnalysisResult, JobDescription
from backend.middleware.auth import get_current_user
from backend.models import User

router = APIRouter(tags=["JD Alignment"])
UNTITLED_JD_TITLE = "未命名岗位"
class CreateJDRequest(BaseModel):
    source_type: Literal["text", "url"]
    raw_text: str = ""
    source_url: str = ""
    title: str = ""
    set_as_default: bool = False
    llm_profile: str | None = None
class UpdateJDRequest(BaseModel):
    title: str = ""
class JDAnalysisStreamRequest(BaseModel):
    jd_id: str
    resume_id: str
    resume_data: dict[str, Any] = Field(default_factory=dict)
    llm_profile: str | None = None
def _utc_now() -> datetime:
    return datetime.now(timezone.utc)
def _ensure_llm_profile(profile_name: str | None) -> str:
    resolved = resolve_profile_name(profile_name)
    if not is_profile_supported(resolved):
        detail = get_profile_disabled_reason(resolved) or f"当前不支持该模型：{resolved}"
        raise HTTPException(status_code=400, detail=detail)
    if not is_profile_configured(resolved):
        raise HTTPException(status_code=400, detail=f"所选模型尚未配置 API Key：{resolved}")
    return resolved
def _format_jd_record(record: JobDescription) -> dict[str, Any]:
    return {
        "id": record.id,
        "title": record.title,
        "company_name": record.company_name,
        "source_type": record.source_type,
        "source_url": record.source_url,
        "raw_text": record.raw_text,
        "structured_data": record.structured_data,
        "is_default": bool(record.is_default),
        "fetched_at": record.fetched_at.isoformat() if record.fetched_at else None,
        "last_used_at": record.last_used_at.isoformat() if record.last_used_at else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }
def _format_analysis_record(record: JDAnalysisResult) -> dict[str, Any]:
    return {
        "id": record.id,
        "jd_id": record.jd_id,
        "resume_id": record.resume_id,
        "match_score": record.match_score,
        "report": record.report_data,
        "learning_path": record.learning_path_data,
        "patch_batches": record.patch_batches_data,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
def _clear_default_jds(db: Session, user_id: int) -> None:
    (
        db.query(JobDescription)
        .filter(
            JobDescription.user_id == user_id,
            JobDescription.is_default.is_(True),
        )
        .update({"is_default": False}, synchronize_session=False)
    )
def _get_owned_jd(db: Session, user_id: int, jd_id: str) -> JobDescription:
    record = (
        db.query(JobDescription)
        .filter(JobDescription.id == jd_id, JobDescription.user_id == user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="JD 不存在")
    return record
def _resolve_jd_title(payload_title: str, structured_title: str) -> str:
    return (payload_title or structured_title or UNTITLED_JD_TITLE).strip()
async def _build_jd_content(
    payload: CreateJDRequest,
) -> tuple[str, str | None, datetime | None]:
    if payload.source_type == "text":
        raw_text = payload.raw_text.strip()
        if not raw_text:
            raise HTTPException(status_code=422, detail="请提供岗位文本描述")
        return raw_text, None, None

    source_url = payload.source_url.strip()
    if not source_url:
        raise HTTPException(status_code=422, detail="请提供岗位链接")

    try:
        result = await fetch_job_description_from_url(source_url)
    except JDFetchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result.raw_text, result.url, _utc_now()
def _sse_event(event_type: str, data: dict[str, Any]) -> str:
    payload = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    return f"id: {uuid4().hex}\nevent: {event_type}\ndata: {payload}\n\n"
@router.get("/api/jds")
def list_jds(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = (
        db.query(JobDescription)
        .filter(JobDescription.user_id == current_user.id)
        .order_by(JobDescription.is_default.desc(), JobDescription.updated_at.desc())
        .all()
    )
    return {"items": [_format_jd_record(item) for item in records]}
@router.post("/api/jds")
async def create_jd(
    payload: CreateJDRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    llm_profile = _ensure_llm_profile(payload.llm_profile)
    raw_text, source_url, fetched_at = await _build_jd_content(payload)
    parser = JDParserAgent(LLM(config_name=llm_profile))
    structured = await parser.run(raw_text, source_url)

    if payload.set_as_default:
        _clear_default_jds(db, current_user.id)

    record = JobDescription(
        id=f"jd_{uuid4().hex}",
        user_id=current_user.id,
        title=_resolve_jd_title(payload.title, structured.title),
        company_name=(structured.company_name or "").strip() or None,
        source_type=payload.source_type,
        source_url=source_url,
        raw_text=raw_text,
        structured_data=structured.model_dump(),
        is_default=payload.set_as_default,
        fetched_at=fetched_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _format_jd_record(record)
@router.patch("/api/jds/{jd_id}")
def update_jd(
    jd_id: str,
    payload: UpdateJDRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="JD 名称不能为空")

    record = _get_owned_jd(db, current_user.id, jd_id)
    record.title = title
    db.commit()
    db.refresh(record)
    return _format_jd_record(record)
@router.post("/api/jds/{jd_id}/default")
def set_default_jd(
    jd_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = _get_owned_jd(db, current_user.id, jd_id)
    _clear_default_jds(db, current_user.id)
    record.is_default = True
    db.commit()
    db.refresh(record)
    return _format_jd_record(record)
@router.get("/api/jds/{jd_id}/latest-analysis")
def get_latest_analysis(
    jd_id: str,
    resume_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(JDAnalysisResult)
        .filter(
            JDAnalysisResult.user_id == current_user.id,
            JDAnalysisResult.jd_id == jd_id,
            JDAnalysisResult.resume_id == resume_id,
        )
        .order_by(JDAnalysisResult.created_at.desc())
        .first()
    )
    if not record:
        return {"item": None}
    return {"item": _format_analysis_record(record)}
@router.post("/api/jd-analyses/stream")
async def stream_jd_analysis(
    payload: JDAnalysisStreamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.resume_data:
        raise HTTPException(status_code=422, detail="缺少当前简历数据，无法执行 JD 分析")

    llm_profile = _ensure_llm_profile(payload.llm_profile)
    jd = _get_owned_jd(db, current_user.id, payload.jd_id)

    async def event_stream():
        orchestrator = JDAlignmentOrchestrator(LLM(config_name=llm_profile))
        jd.last_used_at = _utc_now()
        db.commit()
        try:
            yield _sse_event(
                "jd_analysis_stage",
                {"stage": "fetch_jd", "label": "获取 JD", "status": "in_progress"},
            )
            yield _sse_event(
                "jd_analysis_stage",
                {"stage": "structure_jd", "label": "结构化 JD", "status": "in_progress"},
            )
            async for kind, payload_item in orchestrator.stream(
                raw_text=jd.raw_text,
                source_url=jd.source_url,
                structured_seed=jd.structured_data,
                resume_data=payload.resume_data,
            ):
                if kind == "stage":
                    yield _sse_event("jd_analysis_stage", payload_item.model_dump())
                    continue

                bundle = payload_item
                record = JDAnalysisResult(
                    id=f"jda_{uuid4().hex}",
                    user_id=current_user.id,
                    resume_id=payload.resume_id,
                    jd_id=jd.id,
                    match_score=bundle.match.match_score,
                    report_data=bundle.to_report(),
                    learning_path_data=[
                        item.model_dump() for item in bundle.learning_path
                    ],
                    patch_batches_data=[
                        item.model_dump() for item in bundle.patch_batches
                    ],
                )
                db.add(record)
                jd.structured_data = bundle.structured_jd.model_dump()
                db.commit()
                db.refresh(record)
                yield _sse_event("jd_analysis_result", _format_analysis_record(record))
                yield _sse_event("done", {"status": "complete"})
        except Exception as exc:
            db.rollback()
            yield _sse_event("jd_analysis_error", {"message": str(exc)})
            yield _sse_event("done", {"status": "error"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )
