"""Agent 会话内存态统一入口（架构优化 Wave 0.5 façade）。

_active_sessions 字典及其增删改查收口到本模块：stream / history / approval
等路由层通过这里操作内存会话，不再各自 import 内部字典。原 history.py 直接
del 条目、clear_active_sessions_for_user 只删条目，都会漏掉 ResumeDataStore
清理，导致简历/JD 泄漏到类级字典——统一走 discard_session 后一并修复。

只包住既有操作、不迁移其它状态：ResumeDataStore / AgentSharedState /
ChatHistory 的完整收拢是 Wave 2（AgentSessionManager 完全体）的事。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from backend.core.logger import get_logger

logger = get_logger(__name__)

# 内存中的活跃会话（conversation_id -> {agent, chat_history, resume_path,
# created_at, last_accessed, user_id, ...}）
_active_sessions: dict[str, dict] = {}


def get_session(conversation_id: str) -> Optional[dict]:
    """取内存会话条目（可能已被 TTL 回收，返回 None）。"""
    return _active_sessions.get(conversation_id)


def register_session(conversation_id: str, session: dict) -> None:
    """登记新会话条目；created_at / last_accessed 缺失时补齐。

    TTL 回收按 last_accessed（活跃时间）判定，created_at 仅保留作诊断。
    """
    now = datetime.now()
    session.setdefault("created_at", now)
    session.setdefault("last_accessed", now)
    _active_sessions[conversation_id] = session


def touch(conversation_id: str) -> None:
    """刷新活跃时间，防止使用中的会话被 TTL 误回收。"""
    session = _active_sessions.get(conversation_id)
    if session is not None:
        session["last_accessed"] = datetime.now()


def get_active_agent(conversation_id: str):
    """按会话取仍在内存中的 agent 实例(可能已被 TTL 回收,返回 None)。
    供 approval 等旁路端点把执行结果回写进 agent.memory,让 LLM 后续轮次
    知道邮件到底发没发、发了什么(审查 #24)。"""
    session = _active_sessions.get(conversation_id)
    return session.get("agent") if session else None


def discard_session(conversation_id: str, *, clear_resume_data: bool = True) -> bool:
    """移除内存会话（清 agent 记忆），并默认同步清理 ResumeDataStore。

    clear_resume_data=False 仅用于"存储文件被删、原地重建会话"的路径：
    该路径只需重置 agent 记忆，简历数据是否保留由重建后的请求决定。

    返回是否存在过该会话条目；clear_resume_data=True 时无论条目是否
    还在内存都清一次数据（条目可能早被回收但类级字典仍留存数据）。
    """
    from backend.agent.tool.resume_data_store import ResumeDataStore

    session = _active_sessions.pop(conversation_id, None)
    if session is not None and "agent" in session:
        try:
            agent = session["agent"]
            if hasattr(agent, "memory") and agent.memory:
                agent.memory.messages.clear()
        except Exception:
            pass
    if clear_resume_data:
        ResumeDataStore.clear_data(conversation_id)
    # 整份优化进度是任务级状态，不是简历数据：无论是否保留简历数据都要清，
    # 放在 clear_resume_data 门外无条件调用（设计方案七点三）。
    ResumeDataStore.clear_progress(conversation_id)
    return session is not None


def clear_sessions_for_user(user_id: str) -> int:
    """移除某用户全部内存会话（含 ResumeDataStore 清理），返回清理数量。"""
    stale_ids = [
        conversation_id
        for conversation_id, session in list(_active_sessions.items())
        if session.get("user_id") == user_id
    ]
    for conversation_id in stale_ids:
        discard_session(conversation_id)
        logger.info(
            f"[SessionManager] Cleared active session for user {user_id}: {conversation_id}"
        )
    return len(stale_ids)


def evict_idle_sessions(current_conversation_id: str, ttl_seconds: int) -> list[str]:
    """touch-then-sweep TTL 回收，返回被回收的会话 id 列表。

    判据是 last_accessed（活跃时间）而非 created_at，避免单次运行超过 TTL
    的长流、或持续对话的长会话被误回收。当前会话的 stream 刚结束，本身就是
    活跃证据：先 touch 再清扫，保证本会话不会在自己的 finally 里被回收。
    """
    now = datetime.now()
    touch(current_conversation_id)
    stale = [
        cid
        for cid, sess in list(_active_sessions.items())
        if (
            now - (sess.get("last_accessed") or sess.get("created_at", now))
        ).total_seconds()
        > ttl_seconds
    ]
    for cid in stale:
        discard_session(cid)
        logger.info(f"[SessionManager] Evicted stale session: {cid}")
    return stale
