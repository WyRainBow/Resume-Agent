"""
简历数据同步服务
"""
from datetime import datetime
from typing import List, Dict, Any
import logging
import time
from sqlalchemy.orm import Session

from models import Resume, User

logger = logging.getLogger("backend")

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
    t0 = time.perf_counter()
    inserted = 0
    updated = 0
    skipped = 0

    resume_ids = [item.get("id") for item in resumes if item.get("id")]
    existing_map: Dict[str, Resume] = {}
    if resume_ids:
        existing_rows = (
            db.query(Resume)
            .filter(Resume.user_id == user.id, Resume.id.in_(resume_ids))
            .all()
        )
        existing_map = {r.id: r for r in existing_rows}

    for item in resumes:
        resume_id = item.get("id")
        name = item.get("name") or "未命名简历"
        alias = item.get("alias")
        data = item.get("data") or {}
        template_type = item.get("template_type")
        incoming_updated_at = _parse_iso_datetime(item.get("updated_at"))

        if not resume_id:
            # 无 id，跳过
            skipped += 1
            continue

        # 如果有 template_type，确保同步到 data 中
        if template_type:
            data = {**data, "templateType": template_type}

        existing = existing_map.get(resume_id)
        if existing:
            # 比较时间戳，只有更新更晚才覆盖
            if incoming_updated_at and existing.updated_at and incoming_updated_at <= existing.updated_at:
                skipped += 1
                continue
            existing.name = name
            existing.alias = alias
            existing.data = data
            updated += 1
        else:
            new_resume = Resume(
                id=resume_id,
                user_id=user.id,
                name=name,
                alias=alias,
                data=data
            )
            db.add(new_resume)
            inserted += 1

    db.commit()

    merged = db.query(Resume).filter(Resume.user_id == user.id).order_by(Resume.updated_at.desc()).all()
    logger.info(
        f"[同步] merge统计 user_id={user.id} incoming={len(resumes)} inserted={inserted} updated={updated} skipped={skipped} total={len(merged)} 耗时={(time.perf_counter() - t0) * 1000:.1f}ms"
    )
    return merged
