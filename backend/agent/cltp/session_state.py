"""
CLTP Session State Management
会话状态管理（内存中，无需 Redis）
"""

from typing import Optional, Dict, List
from dataclasses import dataclass, field
from datetime import datetime

from backend.agent.config import config
from backend.agent.cltp.storage.file_adapter import FileSessionStateStorage


@dataclass
class SessionState:
    """会话状态（内存中）"""
    conversation_id: str
    span_stack: List[str] = field(default_factory=list)  # 当前打开的 span ID 栈
    message_sequence: Dict[str, int] = field(default_factory=dict)  # channel -> sequence
    current_run_span_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


# 全局会话状态存储（内存中）
_active_sessions: Dict[str, SessionState] = {}
_storage = FileSessionStateStorage()


def _persistence_enabled() -> bool:
    try:
        return bool(getattr(config, "enable_session_persistence", False))
    except Exception:
        return False


def _load_session(conversation_id: str) -> Optional[SessionState]:
    data = _storage.load(conversation_id)
    if not data:
        return None
    return SessionState(
        conversation_id=conversation_id,
        span_stack=data.get("span_stack", []),
        message_sequence=data.get("message_sequence", {}),
        current_run_span_id=data.get("current_run_span_id"),
        created_at=datetime.fromisoformat(data.get("created_at"))
        if data.get("created_at")
        else datetime.now(),
    )


def save_session_state(state: SessionState) -> None:
    if not _persistence_enabled():
        return
    _storage.save(
        state.conversation_id,
        {
            "conversation_id": state.conversation_id,
            "span_stack": state.span_stack,
            "message_sequence": state.message_sequence,
            "current_run_span_id": state.current_run_span_id,
            "created_at": state.created_at.isoformat(),
        },
    )


def get_or_create_session(conversation_id: str) -> SessionState:
    """获取或创建会话状态"""
    if conversation_id not in _active_sessions:
        restored = _load_session(conversation_id) if _persistence_enabled() else None
        _active_sessions[conversation_id] = restored or SessionState(
            conversation_id=conversation_id
        )
    return _active_sessions[conversation_id]


def cleanup_session(conversation_id: str) -> None:
    """清理会话状态"""
    _active_sessions.pop(conversation_id, None)
    if _persistence_enabled():
        _storage.delete(conversation_id)
