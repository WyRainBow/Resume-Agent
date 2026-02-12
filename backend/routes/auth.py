"""
认证相关路由
"""
import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_
from typing import Optional

from database import get_db
from models import User
from auth import hash_password, verify_password, create_access_token
from middleware.auth import get_current_user

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """用户注册"""
    try:
        logger.info(f"[注册] 收到注册请求，账号: {body.username}")
        
        # 检查账号是否已存在
        logger.debug(f"[注册] 检查账号是否已注册: {body.username}")
        existing = db.query(User).filter(User.username == body.username).first()
        if existing:
            logger.warning(f"[注册] 账号已注册: {body.username}")
            raise HTTPException(status_code=400, detail="该账号已注册")

        # 加密密码
        logger.debug(f"[注册] 开始加密密码")
        try:
            password_hash = hash_password(body.password)
            logger.debug(f"[注册] 密码加密成功，hash长度: {len(password_hash)}")
        except Exception as e:
            logger.error(f"[注册] 密码加密失败: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"密码加密失败: {str(e)}")

        # 创建用户
        logger.debug(f"[注册] 创建用户对象")
        try:
            # email 字段保留兼容：默认与 username 相同
            user = User(username=body.username, email=body.username, password_hash=password_hash)
            logger.debug(f"[注册] 用户对象创建成功")
        except Exception as e:
            logger.error(f"[注册] 创建用户对象失败: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"创建用户对象失败: {str(e)}")

        # 保存到数据库
        logger.debug(f"[注册] 保存用户到数据库")
        try:
            db.add(user)
            db.commit()
            logger.info(f"[注册] 用户已保存到数据库，ID: {user.id}")
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"[注册] 数据库保存失败: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"数据库保存失败: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"[注册] 保存用户时发生未知错误: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"保存用户失败: {str(e)}")

        # 刷新用户对象
        try:
            db.refresh(user)
            logger.debug(f"[注册] 用户对象已刷新")
        except Exception as e:
            logger.warning(f"[注册] 刷新用户对象失败（非致命）: {str(e)}")

        # 生成 token
        logger.debug(f"[注册] 生成访问令牌")
        try:
            token = create_access_token({"sub": str(user.id), "username": user.username})
            logger.info(f"[注册] 注册成功，用户ID: {user.id}, 账号: {user.username}")
        except Exception as e:
            logger.error(f"[注册] 生成token失败: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"生成token失败: {str(e)}")

        return TokenResponse(
            access_token=token,
            user=UserResponse(id=user.id, username=user.username, email=user.email)
        )
    
    except HTTPException:
        # 重新抛出 HTTPException（这些是我们预期的错误）
        raise
    except Exception as e:
        # 捕获所有未预期的错误
        logger.error(f"[注册] 注册过程中发生未预期的错误: {str(e)}")
        logger.error(f"[注册] 错误类型: {type(e).__name__}")
        logger.error(f"[注册] 完整错误堆栈:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")


def _client_ip(request: Request) -> str:
    """从请求中获取客户端 IP（兼容代理 X-Forwarded-For）"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or ""
    return ""


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(
        or_(User.username == body.username, User.email == body.username)
    ).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")

    # 记录本次登录 IP
    try:
        user.last_login_ip = _client_ip(request)
        db.commit()
    except Exception as e:
        logger.warning(f"[登录] 更新 last_login_ip 失败: {e}")
        db.rollback()

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, username=user.username, email=user.email)
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse(id=current_user.id, username=current_user.username, email=current_user.email)
