"""
邮箱发信凭证路由(仅管理员)
- GET    /api/email/credential  查询连接状态(脱敏,不回传授权码)
- PUT    /api/email/credential  保存/更新 QQ 邮箱地址 + 授权码(加密入库)
- DELETE /api/email/credential  断开连接(删除凭证)
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import EmailCredential, User
from middleware.auth import get_current_user

try:
    from backend.utils.crypto import encrypt_secret
except ImportError:
    from utils.crypto import encrypt_secret

router = APIRouter(prefix="/api", tags=["Email"])

QQ_EMAIL_RE = re.compile(r"^[A-Za-z0-9._-]+@(qq\.com|foxmail\.com)$")


def _require_admin(user: User) -> None:
    if getattr(user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可使用邮箱发送功能")


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 3:
        return f"{local[0]}***@{domain}"
    return f"{local[:3]}***@{domain}"


class PutCredentialRequest(BaseModel):
    email_address: str
    auth_code: str


@router.get("/email/credential")
async def get_email_credential(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    row = db.query(EmailCredential).filter(EmailCredential.user_id == current_user.id).first()
    if not row:
        return {"configured": False, "masked_email": None}
    return {"configured": True, "masked_email": _mask_email(row.email_address)}


@router.put("/email/credential")
async def put_email_credential(
    payload: PutCredentialRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    email = payload.email_address.strip()
    auth_code = payload.auth_code.strip()
    if not QQ_EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="仅支持 QQ 邮箱(@qq.com / @foxmail.com)")
    if not auth_code:
        raise HTTPException(status_code=400, detail="授权码不能为空")

    encrypted = encrypt_secret(auth_code)
    row = db.query(EmailCredential).filter(EmailCredential.user_id == current_user.id).first()
    if row:
        row.email_address = email
        row.encrypted_auth_code = encrypted
    else:
        db.add(EmailCredential(
            user_id=current_user.id,
            email_address=email,
            encrypted_auth_code=encrypted,
        ))
    db.commit()
    return {"configured": True, "masked_email": _mask_email(email)}


@router.delete("/email/credential")
async def delete_email_credential(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    db.query(EmailCredential).filter(EmailCredential.user_id == current_user.id).delete()
    db.commit()
    return {"configured": False, "masked_email": None}
