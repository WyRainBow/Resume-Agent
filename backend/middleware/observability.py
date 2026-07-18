"""可观测性中间件：请求日志、错误日志、链路 span。"""
from __future__ import annotations

import os
import time
import traceback
import threading
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from database import SessionLocal
from models import APIErrorLog, APIRequestLog, APITraceSpan


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_perf = time.perf_counter()
        start_at = datetime.now(timezone.utc)
        trace_id = request.headers.get("x-trace-id") or uuid4().hex
        request_id = request.headers.get("x-request-id") or uuid4().hex

        request.state.trace_id = trace_id
        request.state.request_id = request_id

        user_id = _extract_user_id(request)
        response = None
        captured_error: Exception | None = None

        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            captured_error = exc
            raise
        finally:
            elapsed_ms = round((time.perf_counter() - start_perf) * 1000, 2)
            end_at = datetime.now(timezone.utc)
            # 异步写日志，避免观测落库阻塞主请求。
            threading.Thread(
                target=_persist_observability,
                kwargs={
                    "request": request,
                    "response": response,
                    "user_id": user_id,
                    "trace_id": trace_id,
                    "request_id": request_id,
                    "start_at": start_at,
                    "end_at": end_at,
                    "elapsed_ms": elapsed_ms,
                    "captured_error": captured_error,
                },
                daemon=True,
            ).start()
            if response is not None:
                response.headers["X-Trace-Id"] = trace_id
                response.headers["X-Request-Id"] = request_id


def _extract_user_id(request: Request) -> str | None:
    """请求归因：取 BetterAuth 可信头的用户 id（2026-07-17 身份统一，旧 JWT 解码归因下架）。

    仅当同请求带合法 X-Internal-Auth-Secret（web 代理注入）才采信
    X-Better-Auth-User-Id，防伪造归因。顺带修复旧实现只认 JWT 导致
    BetterAuth 请求 99% user_id=NULL 的观测盲区。
    """
    secret = (request.headers.get("x-internal-auth-secret") or "").strip()
    if not secret:
        return None
    expected = os.getenv("FASTAPI_INTERNAL_AUTH_SECRET", "").strip()
    if not expected or secret != expected:
        return None
    user_id = (request.headers.get("x-better-auth-user-id") or "").strip()
    return user_id or None


def _persist_observability(
    *,
    request: Request,
    response,
    user_id: str | None,
    trace_id: str,
    request_id: str,
    start_at: datetime,
    end_at: datetime,
    elapsed_ms: float,
    captured_error: Exception | None,
) -> None:
    db = SessionLocal()
    try:
        request_size = _safe_int(request.headers.get("content-length"))
        response_size = _safe_int(response.headers.get("content-length")) if response else None
        status_code = response.status_code if response is not None else 500

        row = APIRequestLog(
            trace_id=trace_id,
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            latency_ms=elapsed_ms,
            user_id=user_id,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            request_size=request_size,
            response_size=response_size,
        )
        db.add(row)

        if captured_error is not None:
            # 仅在需要关联错误日志时才强制 flush 获取 request_log_id，
            # 避免每个请求都产生额外往返，降低接口尾延迟。
            db.flush()
            db.add(
                APIErrorLog(
                    request_log_id=row.id,
                    trace_id=trace_id,
                    error_type=type(captured_error).__name__,
                    error_message=str(captured_error),
                    error_stack="".join(traceback.format_exception(captured_error)),
                    service="backend",
                )
            )

        # 管理端接口已迁移到 ops-portal，保留业务 API 的链路采样（排除健康检查）。
        if request.url.path.startswith("/api/") and request.url.path not in {"/api/health"}:
            db.add(
                APITraceSpan(
                    trace_id=trace_id,
                    span_id=request_id,
                    parent_span_id=None,
                    span_name=f"{request.method} {request.url.path}",
                    start_time=start_at,
                    end_time=end_at,
                    duration_ms=elapsed_ms,
                    status="error" if captured_error else "ok",
                    tags={
                        "status_code": status_code,
                        "ip": _client_ip(request),
                        "user_id": user_id,
                    },
                )
            )

        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _safe_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def register_observability_handlers(app: FastAPI) -> None:
    """注册中间件与兜底异常处理器。"""
    app.add_middleware(RequestObservabilityMiddleware)

    @app.exception_handler(BrokenPipeError)
    async def broken_pipe_handler(request: Request, exc: BrokenPipeError):
        trace_id = getattr(request.state, "trace_id", None) or uuid4().hex
        return JSONResponse(
            status_code=499,
            content={"detail": "客户端连接已断开", "trace_id": trace_id},
            headers={"X-Trace-Id": trace_id},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        trace_id = getattr(request.state, "trace_id", None) or uuid4().hex
        return JSONResponse(
            status_code=500,
            content={"detail": "服务器内部错误", "trace_id": trace_id},
            headers={"X-Trace-Id": trace_id},
        )
