"""后台管理：成员管理。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from middleware.auth import require_admin_or_member
from models import Member, PermissionAuditLog, User

router = APIRouter(prefix="/api/admin/members", tags=["AdminMembers"])


class MemberPayload(BaseModel):
    user_id: int
    position: Optional[str] = None
    team: Optional[str] = None
    status: str = "active"
    user_role: Optional[str] = "member"


class MemberItem(BaseModel):
    id: int
    name: str
    username: Optional[str] = None
    position: Optional[str] = None
    team: Optional[str] = None
    status: str
    user_id: Optional[int] = None
    user_role: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MembersListResponse(BaseModel):
    items: list[MemberItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=MembersListResponse)
def list_members(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    keyword: Optional[str] = None,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    query = (
        db.query(
            Member,
            User.username.label("username"),
            User.role.label("user_role"),
        )
        .outerjoin(User, User.id == Member.user_id)
    )
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(Member.name.like(like), User.username.like(like)))

    total = query.count()
    rows = query.order_by(Member.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return MembersListResponse(
        items=[
            MemberItem(
                id=member.id,
                name=member.name,
                username=username,
                position=member.position,
                team=member.team,
                status=member.status,
                user_id=member.user_id,
                user_role=user_role,
                created_at=member.created_at.isoformat() if member.created_at else None,
                updated_at=member.updated_at.isoformat() if member.updated_at else None,
            )
            for member, username, user_role in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=MemberItem)
def create_member(
    payload: MemberPayload,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    if payload.user_role and payload.user_role not in {"admin", "member", "user"}:
        raise HTTPException(status_code=400, detail="不支持的角色")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="关联用户不存在")
    if current_user.role == "member" and (user.role == "admin" or payload.user_role == "admin"):
        raise HTTPException(status_code=403, detail="member 无权操作 admin")

    exists = db.query(Member).filter(Member.user_id == payload.user_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="该用户已是成员")

    row = Member(
        name=user.username,
        email=None,
        position=payload.position,
        team=payload.team,
        status=payload.status,
        user_id=payload.user_id,
    )

    if payload.user_role and user.role != payload.user_role:
        db.add(
            PermissionAuditLog(
                operator_user_id=current_user.id,
                target_user_id=user.id,
                from_role=user.role,
                to_role=payload.user_role,
                action="update_role_from_member",
            )
        )
        user.role = payload.user_role

    db.add(row)
    db.commit()
    db.refresh(row)
    db.refresh(user)
    return MemberItem(
        id=row.id,
        name=row.name,
        username=user.username,
        position=row.position,
        team=row.team,
        status=row.status,
        user_id=row.user_id,
        user_role=user.role,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.patch("/{member_id}", response_model=MemberItem)
def update_member(
    member_id: int,
    payload: MemberPayload,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    if payload.user_role and payload.user_role not in {"admin", "member", "user"}:
        raise HTTPException(status_code=400, detail="不支持的角色")

    row = db.query(Member).filter(Member.id == member_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="成员不存在")
    if current_user.role == "member" and row.user_id:
        existing_user = db.query(User).filter(User.id == row.user_id).first()
        if existing_user and existing_user.role == "admin":
            raise HTTPException(status_code=403, detail="member 无权操作 admin")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="关联用户不存在")
    if current_user.role == "member" and (user.role == "admin" or payload.user_role == "admin"):
        raise HTTPException(status_code=403, detail="member 无权操作 admin")

    dup = db.query(Member).filter(Member.user_id == payload.user_id, Member.id != member_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="该用户已是其他成员")

    row.name = user.username
    row.email = None
    row.position = payload.position
    row.team = payload.team
    row.status = payload.status
    row.user_id = payload.user_id

    if payload.user_role and user.role != payload.user_role:
        db.add(
            PermissionAuditLog(
                operator_user_id=current_user.id,
                target_user_id=user.id,
                from_role=user.role,
                to_role=payload.user_role,
                action="update_role_from_member",
            )
        )
        user.role = payload.user_role

    db.commit()
    db.refresh(row)
    db.refresh(user)
    return MemberItem(
        id=row.id,
        name=row.name,
        username=user.username,
        position=row.position,
        team=row.team,
        status=row.status,
        user_id=row.user_id,
        user_role=user.role,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.delete("/{member_id}")
def delete_member(
    member_id: int,
    current_user: User = Depends(require_admin_or_member),
    db: Session = Depends(get_db),
):
    row = db.query(Member).filter(Member.id == member_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="成员不存在")
    db.delete(row)
    db.commit()
    return {"success": True}
