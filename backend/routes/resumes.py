"""
简历存储相关路由
"""
from typing import List, Optional, Dict, Any
from uuid import uuid4
import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Resume, User
from middleware.auth import get_current_user
from services.sync_service import sync_resumes

router = APIRouter(prefix="/api/resumes", tags=["Resumes"])
logger = logging.getLogger("backend")


class ResumePayload(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    alias: Optional[str] = None  # 备注/别名
    template_type: Optional[str] = None  # html 或 latex
    data: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ResumeResponse(BaseModel):
    id: str
    name: str
    alias: Optional[str] = None  # 备注/别名
    template_type: Optional[str] = None  # html 或 latex
    data: Dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]


class SyncRequest(BaseModel):
    resumes: List[ResumePayload]


def _extract_template_type(data: Dict[str, Any]) -> str:
    """从简历数据中提取模板类型，默认为 latex"""
    return data.get("templateType") or "latex"


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
            alias=r.alias,
            template_type=_extract_template_type(r.data),
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
        alias=resume.alias,
        template_type=_extract_template_type(resume.data),
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
    
    # 如果 payload 中有 template_type，确保同步到 data 中
    data = payload.data.copy()
    if payload.template_type:
        data["templateType"] = payload.template_type

    resume = Resume(
        id=resume_id,
        user_id=current_user.id,
        name=name,
        alias=payload.alias,
        data=data
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return ResumeResponse(
        id=resume.id,
        name=resume.name,
        alias=resume.alias,
        template_type=_extract_template_type(resume.data),
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
    """更新简历（不存在时自动创建）"""
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()

    # 如果当前用户下不存在，尝试按 ID 创建（避免前端首次云端保存时 404）
    if not resume:
        # 若该 ID 已被其他用户占用，避免越权覆盖
        occupied = db.query(Resume).filter(Resume.id == resume_id).first()
        if occupied and occupied.user_id != current_user.id:
            raise HTTPException(status_code=409, detail="简历ID已存在，请重试")

        data = payload.data.copy()
        if payload.template_type:
            data["templateType"] = payload.template_type

        created = Resume(
            id=resume_id,
            user_id=current_user.id,
            name=payload.name or data.get("basic", {}).get("name") or "未命名简历",
            alias=payload.alias,
            data=data,
        )
        db.add(created)
        db.commit()
        db.refresh(created)
        return ResumeResponse(
            id=created.id,
            name=created.name,
            alias=created.alias,
            template_type=_extract_template_type(created.data),
            data=created.data,
            created_at=created.created_at.isoformat() if created.created_at else None,
            updated_at=created.updated_at.isoformat() if created.updated_at else None
        )

    # 如果 payload 中有 template_type，确保同步到 data 中
    data = payload.data.copy()
    if payload.template_type:
        data["templateType"] = payload.template_type

    resume.name = payload.name or data.get("basic", {}).get("name") or resume.name
    resume.alias = payload.alias if payload.alias is not None else resume.alias
    resume.data = data
    db.commit()
    db.refresh(resume)

    return ResumeResponse(
        id=resume.id,
        name=resume.name,
        alias=resume.alias,
        template_type=_extract_template_type(resume.data),
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
    t0 = time.perf_counter()
    logger.info(f"[同步] 开始同步简历 user_id={current_user.id} 本地条数={len(payload.resumes)}")
    if not payload.resumes:
        logger.info(f"[同步] 跳过同步（本地条数=0）user_id={current_user.id}")
        return []
    merged = sync_resumes(db, current_user, [r.dict() for r in payload.resumes])
    logger.info(
        f"[同步] 同步完成 user_id={current_user.id} 数据库返回条数={len(merged)} 耗时={(time.perf_counter() - t0) * 1000:.1f}ms"
    )
    return [
        ResumeResponse(
            id=r.id,
            name=r.name,
            alias=r.alias,
            template_type=_extract_template_type(r.data),
            data=r.data,
            created_at=r.created_at.isoformat() if r.created_at else None,
            updated_at=r.updated_at.isoformat() if r.updated_at else None
        )
        for r in merged
    ]
