"""Conversation storage factory."""

from __future__ import annotations

import os
import logging

from backend.agent.cltp.storage.conversation_storage import FileConversationStorage
from backend.agent.cltp.storage.db_conversation_storage import DBConversationStorage

logger = logging.getLogger(__name__)

# 缓存结果，避免多处 import 时重复探测 DB（每次探测都可能触发连接超时）
_cached_storage = None


def get_conversation_storage():
    """Build conversation storage adapter from environment configuration.

    Env:
    - AGENT_HISTORY_BACKEND=file|db (default: db)
    """
    global _cached_storage
    if _cached_storage is not None:
        return _cached_storage

    backend = (os.getenv("AGENT_HISTORY_BACKEND") or "db").strip().lower()
    if backend == "db":
        try:
            storage = DBConversationStorage()
            # Validate table availability at startup.
            storage.list_sessions()
            logger.info("[AgentStorage] Using database conversation storage")
            _cached_storage = storage
            return storage
        except Exception as exc:
            logger.warning(
                "[AgentStorage] Database storage unavailable, fallback to file storage: "
                f"{exc}"
            )
    logger.info("[AgentStorage] Using file conversation storage")
    _cached_storage = FileConversationStorage()
    return _cached_storage
