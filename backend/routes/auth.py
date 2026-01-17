"""
认证相关路由
"""
import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User
from auth import hash_password, verify_password, create_access_token
from middleware.auth import get_current_user

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: str  # 改为普通字符串，支持任意格式的账户名
    password: str


class LoginRequest(BaseModel):
    email: str  # 改为普通字符串，支持任意格式的账户名
    password: str


class UserResponse(BaseModel):
    id: int
    email: str  # 改为普通字符串


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """用户注册"""
    try:
        logger.info(f"[注册] 收到注册请求，邮箱: {body.email}")
        
        # 检查邮箱是否已存在
        logger.debug(f"[注册] 检查邮箱是否已注册: {body.email}")
        existing = db.query(User).filter(User.email == body.email).first()
        if existing:
            logger.warning(f"[注册] 邮箱已注册: {body.email}")
            raise HTTPException(status_code=400, detail="该邮箱已注册")

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
            user = User(email=body.email, password_hash=password_hash)
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
            token = create_access_token({"sub": str(user.id), "email": user.email})
            logger.info(f"[注册] 注册成功，用户ID: {user.id}, 邮箱: {user.email}")
        except Exception as e:
            logger.error(f"[注册] 生成token失败: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"生成token失败: {str(e)}")

        return TokenResponse(
            access_token=token,
            user=UserResponse(id=user.id, email=user.email)
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


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email)
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse(id=current_user.id, email=current_user.email)
