"""Per-user conversation session quota."""

from __future__ import annotations

from typing import Any, Optional

MAX_SESSIONS_PER_USER = 10


class SessionLimitExceeded(Exception):
    """用户历史会话数量已达上限。"""

    def __init__(self, current: int, limit: int = MAX_SESSIONS_PER_USER) -> None:
        self.current = current
        self.limit = limit
        super().__init__(f"Session limit exceeded: {current}/{limit}")


def count_user_sessions(storage: Any, user_id: int) -> int:
    return len(storage.list_sessions(user_id=user_id))


def user_owns_session(
    storage: Any,
    session_id: str,
    user_id: int,
    *,
    is_admin: bool = False,
) -> bool:
    getter = getattr(storage, "get_session_owner", None)
    if callable(getter):
        owner = getter(session_id)
        if owner is not None:
            return owner == user_id or is_admin

    loader = getattr(storage, "load_session", None)
    if callable(loader):
        payload = loader(session_id, user_id=user_id, is_admin=is_admin)
        return payload is not None
    return False


def ensure_can_create_session(
    storage: Any,
    session_id: str,
    user_id: Optional[int],
    *,
    is_admin: bool = False,
) -> None:
    """新建会话前校验配额；更新已有会话不受限。"""
    if user_id is None:
        return
    if user_owns_session(storage, session_id, user_id, is_admin=is_admin):
        return

    current = count_user_sessions(storage, user_id)
    if current >= MAX_SESSIONS_PER_USER:
        raise SessionLimitExceeded(current=current)


def session_limit_status(storage: Any, user_id: int) -> dict[str, int | bool]:
    current = count_user_sessions(storage, user_id)
    limit = MAX_SESSIONS_PER_USER
    return {
        "max_sessions": limit,
        "current_count": current,
        "can_create": current < limit,
    }
