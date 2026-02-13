"""
投递进展表 API
"""
from typing import List, Optional, Any
from uuid import uuid4
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import ApplicationProgress, User
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/application-progress", tags=["ApplicationProgress"])


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
    rows = (
        db.query(ApplicationProgress)
        .filter(ApplicationProgress.user_id == current_user.id)
        .order_by(ApplicationProgress.sort_order.asc(), ApplicationProgress.updated_at.desc())
        .all()
    )
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=ApplicationProgressResponse)
def create_entry(
    payload: ApplicationProgressPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建一条投递记录"""
    max_order = (
        db.query(ApplicationProgress)
        .filter(ApplicationProgress.user_id == current_user.id)
        .count()
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
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


@router.patch("/{entry_id}", response_model=ApplicationProgressResponse)
def update_entry(
    entry_id: str,
    payload: ApplicationProgressPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新单条投递记录（部分字段）"""
    row = (
        db.query(ApplicationProgress)
        .filter(ApplicationProgress.id == entry_id, ApplicationProgress.user_id == current_user.id)
        .first()
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
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除单条投递记录"""
    row = (
        db.query(ApplicationProgress)
        .filter(ApplicationProgress.id == entry_id, ApplicationProgress.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(row)
    db.commit()
    return {"success": True}


class ReorderPayload(BaseModel):
    order: List[str]  # list of entry ids in new order


@router.patch("/reorder")
def reorder_entries(
    payload: ReorderPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """批量更新 sort_order（拖拽后）"""
    for i, entry_id in enumerate(payload.order):
        row = (
            db.query(ApplicationProgress)
            .filter(ApplicationProgress.id == entry_id, ApplicationProgress.user_id == current_user.id)
            .first()
        )
        if row:
            row.sort_order = i
    db.commit()
    return {"success": True}
