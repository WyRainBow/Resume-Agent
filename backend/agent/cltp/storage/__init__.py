"""Storage adapters for CLTP and conversation history."""

from backend.agent.cltp.storage.conversation_storage import FileConversationStorage, ConversationMeta
from backend.agent.cltp.storage.factory import get_conversation_storage

try:
    from backend.agent.cltp.storage.db_conversation_storage import DBConversationStorage
except Exception:  # pragma: no cover - optional when DB deps are unavailable
    DBConversationStorage = None

__all__ = [
    "FileConversationStorage",
    "ConversationMeta",
    "get_conversation_storage",
]

if DBConversationStorage is not None:
    __all__.append("DBConversationStorage")
