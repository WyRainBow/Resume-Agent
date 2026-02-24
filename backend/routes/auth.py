"""
认证相关路由
"""
import logging
import traceback
import time
from time import sleep
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError
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
        username = (body.username or "").strip()
        password = body.password or ""
        logger.info(f"[注册] 收到注册请求，账号: {username}")

        if not username:
            raise HTTPException(status_code=400, detail="账号不能为空")
        if len(username) < 2:
            raise HTTPException(status_code=400, detail="账号长度至少 2 位")
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="密码长度至少 6 位")
        
        # 检查账号是否已存在
        logger.debug(f"[注册] 检查账号是否已注册: {username}")
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            logger.warning(f"[注册] 账号已注册: {username}")
            raise HTTPException(status_code=400, detail="该账号已注册")

        # 加密密码
        logger.debug(f"[注册] 开始加密密码")
        try:
            password_hash = hash_password(password)
            logger.debug(f"[注册] 密码加密成功，hash长度: {len(password_hash)}")
        except Exception as e:
            logger.error(f"[注册] 密码加密失败: {str(e)}")
            logger.error(f"[注册] 错误堆栈:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"密码加密失败: {str(e)}")

        # 创建用户
        logger.debug(f"[注册] 创建用户对象")
        try:
            # email 字段保留兼容：默认与 username 相同
            user = User(username=username, email=username, password_hash=password_hash)
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
            token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})
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
    t0 = time.perf_counter()
    login_identifier = (body.username or "").strip()
    password = body.password or ""
    logger.info(f"[登录] 开始登录流程 username={login_identifier}")

    if not login_identifier:
        raise HTTPException(status_code=400, detail="账号不能为空")
    if not password:
        raise HTTPException(status_code=400, detail="密码不能为空")

    # 数据库连接偶发中断时，允许一次快速重试，避免直接 500
    t_query_start = time.perf_counter()
    user = None
    query_error: Optional[Exception] = None
    for attempt in range(1, 3):
        try:
            # 避免 OR 条件导致索引利用不稳定：优先按输入形态走单索引查询
            if "@" in login_identifier:
                user = db.query(User).filter(User.email == login_identifier).first()
                if not user:
                    user = db.query(User).filter(User.username == login_identifier).first()
            else:
                user = db.query(User).filter(User.username == login_identifier).first()
                if not user:
                    user = db.query(User).filter(User.email == login_identifier).first()
            query_error = None
            break
        except OperationalError as exc:
            query_error = exc
            db.rollback()
            logger.warning(f"[登录] 查询用户失败(尝试{attempt}/2): {exc}")
            if attempt < 2:
                sleep(0.1)
                continue
        except SQLAlchemyError as exc:
            query_error = exc
            db.rollback()
            logger.error(f"[登录] 查询用户发生数据库错误: {exc}")
            break

    logger.info(f"[登录] 查询用户耗时 {(time.perf_counter() - t_query_start) * 1000:.1f}ms")
    if query_error is not None:
        raise HTTPException(status_code=503, detail="数据库连接异常、请稍后重试")

    t_verify_start = time.perf_counter()
    if not user or not verify_password(password, user.password_hash):
        logger.warning(
            f"[登录] 账号或密码错误 username={login_identifier} verify耗时 {(time.perf_counter() - t_verify_start) * 1000:.1f}ms"
        )
        raise HTTPException(status_code=401, detail="账号或密码错误")
    logger.info(f"[登录] 密码校验耗时 {(time.perf_counter() - t_verify_start) * 1000:.1f}ms")

    # 记录本次登录 IP
    t_ip_start = time.perf_counter()
    try:
        current_ip = _client_ip(request)
        if current_ip and user.last_login_ip != current_ip:
            user.last_login_ip = current_ip
            db.commit()
            logger.info(f"[登录] 更新 last_login_ip 耗时 {(time.perf_counter() - t_ip_start) * 1000:.1f}ms")
        else:
            logger.info(f"[登录] 跳过 last_login_ip 更新（IP 未变化）耗时 {(time.perf_counter() - t_ip_start) * 1000:.1f}ms")
    except Exception as e:
        logger.warning(f"[登录] 更新 last_login_ip 失败: {e}")
        db.rollback()

    t_token_start = time.perf_counter()
    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})
    token_cost_ms = (time.perf_counter() - t_token_start) * 1000
    logger.info(f"[登录] 生成 token 耗时 {token_cost_ms:.1f}ms")
    logger.info(f"[登录] 登录流程完成 user_id={user.id} 总耗时 {(time.perf_counter() - t0) * 1000:.1f}ms")
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, username=user.username, email=user.email)
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse(id=current_user.id, username=current_user.username, email=current_user.email)
