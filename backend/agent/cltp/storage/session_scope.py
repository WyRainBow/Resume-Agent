"""会话归属与访问范围辅助。

2026-07-17 身份统一：用户 id 语义从旧 users 整数 id 切换为 BetterAuth
"user".id（32 位字符串）。normalize_user_id 不再做 int() 转换——那会把
字符串 id 吞成 None、导致会话属主丢失；统一归一为非空字符串后比较
（历史存量里的整数 id 也转成字符串，两侧口径一致）。
"""

from __future__ import annotations

from typing import Any, Optional


class SessionAccessError(PermissionError):
    """当前用户无权访问该会话。"""


def normalize_user_id(user_id: Optional[str]) -> Optional[str]:
    if user_id is None:
        return None
    value = str(user_id).strip()
    return value or None


def stored_user_id(data: Optional[dict[str, Any]]) -> Optional[str]:
    if not data:
        return None
    return normalize_user_id(data.get("user_id"))


def can_read_session(
    owner_id: Optional[str],
    user_id: Optional[str],
    *,
    is_admin: bool = False,
) -> bool:
    if user_id is None:
        return True
    if is_admin:
        return True
    if owner_id is None:
        return False
    return normalize_user_id(owner_id) == normalize_user_id(user_id)


def can_write_session(
    owner_id: Optional[str],
    user_id: Optional[str],
    *,
    is_admin: bool = False,
) -> bool:
    if user_id is None:
        return True
    if is_admin:
        return True
    if owner_id is None:
        return True
    return normalize_user_id(owner_id) == normalize_user_id(user_id)


def assert_can_read(
    owner_id: Optional[str],
    user_id: Optional[str],
    *,
    is_admin: bool = False,
) -> None:
    if not can_read_session(owner_id, user_id, is_admin=is_admin):
        raise SessionAccessError("SESSION_FORBIDDEN_OR_NOT_FOUND")


def assert_can_write(
    owner_id: Optional[str],
    user_id: Optional[str],
    *,
    is_admin: bool = False,
) -> None:
    if not can_write_session(owner_id, user_id, is_admin=is_admin):
        raise SessionAccessError("SESSION_FORBIDDEN_OR_NOT_FOUND")
