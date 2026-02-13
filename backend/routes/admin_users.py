"""后台管理：用户管理与权限变更。"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, load_only
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from time import sleep

from database import get_db
from middleware.auth import require_admin_or_member
from models import PermissionAuditLog, User

router = APIRouter(prefix="/api/admin/users", tags=["AdminUsers"])


def _run_with_db_retry(db: Session, fn, retries: int = 1):
    last_error: Exception | None = None
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


class AdminUserItem(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: str
    last_login_ip: Optional[str] = None
    api_quota: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminUsersListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    page_size: int


class UpdateRolePayload(BaseModel):
    role: str


class UpdateQuotaPayload(BaseModel):
    api_quota: Optional[int] = None


@router.get("", response_model=AdminUsersListResponse)
def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    keyword: Optional[str] = None,
    role: Optional[str] = None,
    ip: Optional[str] = None,
    with_total: bool = Query(default=False),
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    query = query.options(
        load_only(
            User.id,
            User.username,
            User.email,
            User.role,
            User.last_login_ip,
            User.api_quota,
            User.created_at,
            User.updated_at,
        )
    )
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(User.username.like(like), User.email.like(like)))
    if role:
        query = query.filter(User.role == role)
    if ip:
        query = query.filter(User.last_login_ip == ip.strip())

    rows = _run_with_db_retry(
        db,
        lambda: (
            query.order_by(User.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        ),
    )
    # total count 在数据量大时开销明显，默认关闭；仅在前端显式需要时计算
    total = _run_with_db_retry(db, lambda: query.count()) if with_total else 0
    return AdminUsersListResponse(
        items=[
            AdminUserItem(
                id=row.id,
                username=row.username,
                email=row.email,
                role=row.role,
                last_login_ip=row.last_login_ip,
                api_quota=row.api_quota,
                created_at=row.created_at.isoformat() if row.created_at else None,
                updated_at=row.updated_at.isoformat() if row.updated_at else None,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{user_id}/role", response_model=AdminUserItem)
def update_user_role(
    user_id: int,
    payload: UpdateRolePayload,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    new_role = payload.role.strip().lower()
    if new_role not in {"admin", "member", "user"}:
        raise HTTPException(status_code=400, detail="不支持的角色")

    row = _run_with_db_retry(
        db,
        lambda: (
            db.query(User)
            .options(
                load_only(
                    User.id,
                    User.username,
                    User.email,
                    User.role,
                    User.last_login_ip,
                    User.api_quota,
                    User.created_at,
                    User.updated_at,
                )
            )
            .filter(User.id == user_id)
            .first()
        ),
    )
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    if current_user.role == "member":
        if row.role == "admin" or new_role == "admin":
            raise HTTPException(status_code=403, detail="member 无权操作 admin")

    old_role = row.role
    if old_role != new_role:
        row.role = new_role
        db.add(
            PermissionAuditLog(
                operator_user_id=current_user.id,
                target_user_id=row.id,
                from_role=old_role,
                to_role=new_role,
                action="update_role",
            )
        )
        _run_with_db_retry(db, db.commit)

    return AdminUserItem(
        id=row.id,
        username=row.username,
        email=row.email,
        role=row.role,
        last_login_ip=row.last_login_ip,
        api_quota=row.api_quota,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.patch("/{user_id}/quota", response_model=AdminUserItem)
def update_user_quota(
    user_id: int,
    payload: UpdateQuotaPayload,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    row = _run_with_db_retry(db, lambda: db.query(User).filter(User.id == user_id).first())
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    if current_user.role == "member" and row.role == "admin":
        raise HTTPException(status_code=403, detail="member 无权操作 admin")

    row.api_quota = payload.api_quota
    db.add(
        PermissionAuditLog(
            operator_user_id=current_user.id,
            target_user_id=row.id,
            from_role=row.role,
            to_role=row.role,
            action="update_quota",
        )
    )
    _run_with_db_retry(db, db.commit)
    _run_with_db_retry(db, lambda: db.refresh(row))
    return AdminUserItem(
        id=row.id,
        username=row.username,
        email=row.email,
        role=row.role,
        last_login_ip=row.last_login_ip,
        api_quota=row.api_quota,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )
