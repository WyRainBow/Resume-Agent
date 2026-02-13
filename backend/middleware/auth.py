"""
JWT 认证依赖
"""
from typing import Optional
from time import sleep
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from database import get_db
from models import User
from auth import decode_access_token


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
) -> User:
    """从 Authorization 头获取当前用户"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证信息")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")

    user_id = payload.get("sub")
    # 处理 user_id 可能是字符串或整数的情况
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(status_code=401, detail="Token 格式错误")
    user = None
    db_error: Optional[Exception] = None
    # MySQL 偶发断连时快速重试一次，避免直接 500
    for attempt in range(1, 3):
        try:
            user = db.query(User).filter(User.id == user_id).first()
            db_error = None
            break
        except OperationalError as exc:
            db_error = exc
            db.rollback()
            if attempt < 2:
                sleep(0.1)
                continue
        except SQLAlchemyError as exc:
            db_error = exc
            db.rollback()
            break

    if db_error is not None:
        raise HTTPException(status_code=503, detail="数据库连接异常，请稍后重试")
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user
