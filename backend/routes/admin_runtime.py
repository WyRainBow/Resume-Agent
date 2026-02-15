"""后台管理：运行状态与受限运维操作。"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from middleware.auth import require_admin_only, require_admin_or_member
from services.runtime_ops import (
    CommandRejected,
    append_audit_event,
    exec_restricted_command,
    get_runtime_status,
    now_utc_iso,
    pm2_log_paths,
    tail_file,
)


router = APIRouter(prefix="/api/admin/runtime", tags=["AdminRuntime"])


class RuntimeExecRequest(BaseModel):
    command: str = Field(..., description="Restricted command (allowlist enforced)")
    timeout_sec: Optional[int] = Field(default=None, ge=1, le=120)


class RuntimeRestartRequest(BaseModel):
    service: str = Field(default="resume-backend")


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.client.host if request.client else None


@router.get("/status")
def runtime_status(
    request: Request,
    current_user=Depends(require_admin_or_member),
    service: str = Query(default="resume-backend"),
):
    # "current_user" may be a lightweight AuthenticatedUser for /api/admin/*
    data = get_runtime_status(service_name=service)
    data["request"] = {"ip": _client_ip(request)}
    return data


@router.get("/logs")
def runtime_logs(
    request: Request,
    current_user=Depends(require_admin_or_member),
    service: str = Query(default="resume-backend"),
    stream: Literal["out", "error"] = Query(default="error"),
    lines: int = Query(default=200, ge=1, le=2000),
):
    paths = pm2_log_paths(service)
    path = paths["out_path"] if stream == "out" else paths["error_path"]
    try:
        content = tail_file(path, lines=lines)
    except FileNotFoundError:
        content = ""
    return {
        "service": service,
        "stream": stream,
        "lines": lines,
        "path": path,
        "content": content,
        "request": {"ip": _client_ip(request)},
    }


@router.post("/actions/restart")
def runtime_restart(
    request: Request,
    payload: RuntimeRestartRequest,
    current_user=Depends(require_admin_only),
):
    service = payload.service or "resume-backend"
    try:
        result = exec_restricted_command(f"pm2 restart {service}", timeout_sec=60)
    except CommandRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    append_audit_event(
        {
            "ts_utc": now_utc_iso(),
            "action": "restart",
            "service": service,
            "user_id": getattr(current_user, "id", None),
            "role": getattr(current_user, "role", None),
            "ip": _client_ip(request),
            "exit_code": result.get("exit_code"),
            "duration_ms": result.get("duration_ms"),
        }
    )
    return {"ok": result.get("exit_code") == 0, "service": service, "result": result}


@router.post("/actions/exec")
def runtime_exec(
    request: Request,
    payload: RuntimeExecRequest,
    current_user=Depends(require_admin_only),
):
    try:
        result = exec_restricted_command(payload.command, timeout_sec=payload.timeout_sec or 30)
    except CommandRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Audit (do not store full stdout/stderr to avoid leaking secrets)
    append_audit_event(
        {
            "ts_utc": now_utc_iso(),
            "action": "exec",
            "command": payload.command[:2000],
            "argv": result.get("argv"),
            "user_id": getattr(current_user, "id", None),
            "role": getattr(current_user, "role", None),
            "ip": _client_ip(request),
            "exit_code": result.get("exit_code"),
            "duration_ms": result.get("duration_ms"),
        }
    )
    return result
