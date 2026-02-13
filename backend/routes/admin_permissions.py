"""后台管理：权限视图与审计。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import aliased
from sqlalchemy.orm import Session

from database import get_db
from middleware.auth import require_admin_or_member
from models import PermissionAuditLog, User

router = APIRouter(prefix="/api/admin/permissions", tags=["AdminPermissions"])


ROLE_MATRIX = {
    "admin": {
        "users": ["read", "write", "grant_admin"],
        "members": ["read", "write"],
        "logs": ["read"],
        "traces": ["read"],
    },
    "member": {
        "users": ["read", "write_non_admin"],
        "members": ["read", "write"],
        "logs": ["read"],
        "traces": ["read"],
    },
    "user": {
        "users": [],
        "members": [],
        "logs": [],
        "traces": [],
    },
}


class PermissionAuditItem(BaseModel):
    id: int
    operator_user_id: int | None = None
    target_user_id: int | None = None
    operator_username: str | None = None
    target_username: str | None = None
    from_role: str | None = None
    to_role: str | None = None
    action: str
    created_at: str | None = None


class PermissionAuditListResponse(BaseModel):
    items: list[PermissionAuditItem]
    total: int
    page: int
    page_size: int


@router.get("/roles")
def get_role_matrix(current_user: User = Depends(require_admin_or_member)):
    return {"roles": ROLE_MATRIX}


@router.get("/audits", response_model=PermissionAuditListResponse)
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    operator_user = aliased(User)
    target_user = aliased(User)
    query = (
        db.query(
            PermissionAuditLog,
            operator_user.username.label("operator_username"),
            target_user.username.label("target_username"),
        )
        .outerjoin(operator_user, operator_user.id == PermissionAuditLog.operator_user_id)
        .outerjoin(target_user, target_user.id == PermissionAuditLog.target_user_id)
    )
    total = query.count()
    rows = (
        query.order_by(PermissionAuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PermissionAuditListResponse(
        items=[
            PermissionAuditItem(
                id=log.id,
                operator_user_id=log.operator_user_id,
                target_user_id=log.target_user_id,
                operator_username=operator_name,
                target_username=target_name,
                from_role=log.from_role,
                to_role=log.to_role,
                action=log.action,
                created_at=log.created_at.isoformat() if log.created_at else None,
            )
            for log, operator_name, target_name in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
