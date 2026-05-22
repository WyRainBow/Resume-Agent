"""会话归属与访问范围辅助。"""

from __future__ import annotations

from typing import Any, Optional


class SessionAccessError(PermissionError):
    """当前用户无权访问该会话。"""


def normalize_user_id(user_id: Optional[int]) -> Optional[int]:
    if user_id is None:
        return None
    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


def stored_user_id(data: Optional[dict[str, Any]]) -> Optional[int]:
    if not data:
        return None
    return normalize_user_id(data.get("user_id"))


def can_read_session(
    owner_id: Optional[int],
    user_id: Optional[int],
    *,
    is_admin: bool = False,
) -> bool:
    if user_id is None:
        return True
    if is_admin:
        return True
    if owner_id is None:
        return False
    return owner_id == user_id


def can_write_session(
    owner_id: Optional[int],
    user_id: Optional[int],
    *,
    is_admin: bool = False,
) -> bool:
    if user_id is None:
        return True
    if is_admin:
        return True
    if owner_id is None:
        return True
    return owner_id == user_id


def assert_can_read(
    owner_id: Optional[int],
    user_id: Optional[int],
    *,
    is_admin: bool = False,
) -> None:
    if not can_read_session(owner_id, user_id, is_admin=is_admin):
        raise SessionAccessError("SESSION_FORBIDDEN_OR_NOT_FOUND")


def assert_can_write(
    owner_id: Optional[int],
    user_id: Optional[int],
    *,
    is_admin: bool = False,
) -> None:
    if not can_write_session(owner_id, user_id, is_admin=is_admin):
        raise SessionAccessError("SESSION_FORBIDDEN_OR_NOT_FOUND")
