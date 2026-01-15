"""
简历数据同步服务
"""
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from models import Resume, User


def _parse_iso_datetime(value: str) -> datetime:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1]
        return datetime.fromisoformat(value)
    except Exception:
        return None


def sync_resumes(db: Session, user: User, resumes: List[Dict[str, Any]]) -> List[Resume]:
    """根据 updated_at 合并简历数据，返回合并后的数据库记录"""
    for item in resumes:
        resume_id = item.get("id")
        name = item.get("name") or "未命名简历"
        data = item.get("data") or {}
        incoming_updated_at = _parse_iso_datetime(item.get("updated_at"))

        if not resume_id:
            # 无 id，跳过
            continue

        existing = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user.id).first()
        if existing:
            # 比较时间戳，只有更新更晚才覆盖
            if incoming_updated_at and existing.updated_at and incoming_updated_at <= existing.updated_at:
                continue
            existing.name = name
            existing.data = data
        else:
            new_resume = Resume(
                id=resume_id,
                user_id=user.id,
                name=name,
                data=data
            )
            db.add(new_resume)

    db.commit()

    return db.query(Resume).filter(Resume.user_id == user.id).order_by(Resume.updated_at.desc()).all()
