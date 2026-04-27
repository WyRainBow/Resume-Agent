"""
后台管理路由
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User
from middleware.auth import require_admin_or_member

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats/users")
def get_user_stats(
    _current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    return {
        "total_users": int(total_users),
    }

