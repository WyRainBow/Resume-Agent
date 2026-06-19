"""
BetterAuth handoff helpers for FastAPI.

Next.js owns authentication. FastAPI validates incoming bearer tokens by asking
the BetterAuth server for the current session.
"""
import os
from typing import Any, Optional

import httpx
from fastapi import Header, HTTPException
from pydantic import BaseModel


class BetterAuthUser(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    image: Optional[str] = None


def _get_better_auth_base_url() -> str:
    return (
        os.getenv("BETTER_AUTH_INTERNAL_URL")
        or os.getenv("BETTER_AUTH_URL")
        or os.getenv("NEXT_PUBLIC_AUTH_BASE_URL")
        or "http://localhost:3000"
    ).rstrip("/")


def get_better_auth_base_url() -> str:
    return _get_better_auth_base_url()


def has_internal_auth_secret() -> bool:
    return bool(os.getenv("FASTAPI_INTERNAL_AUTH_SECRET", "").strip())


def extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供 BetterAuth Bearer Token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="未提供 BetterAuth Bearer Token")
    return token


def _parse_session_payload(payload: Any) -> BetterAuthUser:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=401, detail="BetterAuth session 无效或已过期")

    user = payload.get("user")
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="BetterAuth session 无效或已过期")

    return BetterAuthUser(
        id=str(user.get("id")),
        email=user.get("email"),
        name=user.get("name"),
        image=user.get("image"),
    )


async def verify_better_auth_token(
    token: str,
    *,
    auth_base_url: Optional[str] = None,
) -> BetterAuthUser:
    base_url = (auth_base_url or _get_better_auth_base_url()).rstrip("/")
    timeout = httpx.Timeout(connect=3.0, read=8.0, write=3.0, pool=3.0)

    try:
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response = await client.get(
                f"{base_url}/api/auth/get-session",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="BetterAuth 服务暂时不可用") from exc

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail="BetterAuth session 无效或已过期")
    if response.status_code >= 400:
        raise HTTPException(status_code=503, detail="BetterAuth 服务暂时不可用")

    return _parse_session_payload(response.json())


async def get_current_better_auth_user(
    authorization: Optional[str] = Header(default=None),
    x_internal_auth_secret: Optional[str] = Header(default=None),
    x_better_auth_user_id: Optional[str] = Header(default=None),
    x_better_auth_user_email: Optional[str] = Header(default=None),
    x_better_auth_user_name: Optional[str] = Header(default=None),
    x_better_auth_user_image: Optional[str] = Header(default=None),
) -> BetterAuthUser:
    internal_secret = os.getenv("FASTAPI_INTERNAL_AUTH_SECRET", "").strip()
    if x_internal_auth_secret:
        if not internal_secret or x_internal_auth_secret != internal_secret:
            raise HTTPException(status_code=401, detail="内部认证信息无效")
        if not x_better_auth_user_id:
            raise HTTPException(status_code=401, detail="缺少 BetterAuth 用户信息")
        return BetterAuthUser(
            id=x_better_auth_user_id,
            email=x_better_auth_user_email,
            name=x_better_auth_user_name,
            image=x_better_auth_user_image,
        )

    token = extract_bearer_token(authorization)
    return await verify_better_auth_token(token)
