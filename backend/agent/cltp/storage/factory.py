"""Conversation storage factory."""

from __future__ import annotations

import os
import logging

from backend.agent.cltp.storage.conversation_storage import FileConversationStorage
from backend.agent.cltp.storage.db_conversation_storage import DBConversationStorage

logger = logging.getLogger(__name__)


def get_conversation_storage():
    """Build conversation storage adapter from environment configuration.

    Env:
    - AGENT_HISTORY_BACKEND=file|db (default: db)
    """
    backend = (os.getenv("AGENT_HISTORY_BACKEND") or "db").strip().lower()
    if backend == "db":
        try:
            storage = DBConversationStorage()
            # Validate table availability at startup.
            storage.list_sessions()
            logger.info("[AgentStorage] Using database conversation storage")
            return storage
        except Exception as exc:
            logger.warning(
                "[AgentStorage] Database storage unavailable, fallback to file storage: "
                f"{exc}"
            )
    logger.info("[AgentStorage] Using file conversation storage")
    return FileConversationStorage()
