"""
简历存储相关路由
"""
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Resume, User
from middleware.auth import get_current_user
from services.sync_service import sync_resumes

router = APIRouter(prefix="/api/resumes", tags=["Resumes"])


class ResumePayload(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    data: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ResumeResponse(BaseModel):
    id: str
    name: str
    data: Dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]


class SyncRequest(BaseModel):
    resumes: List[ResumePayload]


@router.get("", response_model=List[ResumeResponse])
def list_resumes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前用户所有简历"""
    resumes = db.query(Resume).filter(Resume.user_id == current_user.id).order_by(Resume.updated_at.desc()).all()
    return [
        ResumeResponse(
            id=r.id,
            name=r.name,
            data=r.data,
            created_at=r.created_at.isoformat() if r.created_at else None,
            updated_at=r.updated_at.isoformat() if r.updated_at else None
        )
        for r in resumes
    ]


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取单个简历"""
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    return ResumeResponse(
        id=resume.id,
        name=resume.name,
        data=resume.data,
        created_at=resume.created_at.isoformat() if resume.created_at else None,
        updated_at=resume.updated_at.isoformat() if resume.updated_at else None
    )


@router.post("", response_model=ResumeResponse)
def create_resume(
    payload: ResumePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建简历"""
    resume_id = payload.id or f"resume_{uuid4().hex}"
    name = payload.name or payload.data.get("basic", {}).get("name") or "未命名简历"

    resume = Resume(
        id=resume_id,
        user_id=current_user.id,
        name=name,
        data=payload.data
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return ResumeResponse(
        id=resume.id,
        name=resume.name,
        data=resume.data,
        created_at=resume.created_at.isoformat() if resume.created_at else None,
        updated_at=resume.updated_at.isoformat() if resume.updated_at else None
    )


@router.put("/{resume_id}", response_model=ResumeResponse)
def update_resume(
    resume_id: str,
    payload: ResumePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新简历"""
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    resume.name = payload.name or payload.data.get("basic", {}).get("name") or resume.name
    resume.data = payload.data
    db.commit()
    db.refresh(resume)

    return ResumeResponse(
        id=resume.id,
        name=resume.name,
        data=resume.data,
        created_at=resume.created_at.isoformat() if resume.created_at else None,
        updated_at=resume.updated_at.isoformat() if resume.updated_at else None
    )


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除简历"""
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    db.delete(resume)
    db.commit()
    return {"success": True}


@router.post("/sync", response_model=List[ResumeResponse])
def sync_resume_data(
    payload: SyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """同步简历数据（localStorage ↔ 数据库）"""
    merged = sync_resumes(db, current_user, [r.dict() for r in payload.resumes])
    return [
        ResumeResponse(
            id=r.id,
            name=r.name,
            data=r.data,
            created_at=r.created_at.isoformat() if r.created_at else None,
            updated_at=r.updated_at.isoformat() if r.updated_at else None
        )
        for r in merged
    ]
