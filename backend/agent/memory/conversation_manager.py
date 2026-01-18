"""
Conversation manager for handling session history persistence.
"""

from typing import List, Optional

from backend.agent.cltp.storage.conversation_storage import (
    FileConversationStorage,
    ConversationMeta,
)
from backend.agent.memory.chat_history_manager import ChatHistoryManager
from backend.agent.schema import Message


class ConversationManager:
    """Manage conversation sessions and persistence."""

    def __init__(self, storage: Optional[FileConversationStorage] = None):
        self.storage = storage or FileConversationStorage()

    def list_sessions(self) -> List[ConversationMeta]:
        return self.storage.list_sessions()

    def get_history(self, session_id: str) -> List[Message]:
        return self.storage.load_messages(session_id)

    def get_or_create_history(self, session_id: str) -> ChatHistoryManager:
        history = ChatHistoryManager(session_id=session_id, storage=self.storage)
        messages = self.storage.load_messages(session_id)
        if messages:
            history.load_messages(messages)
        return history

    def save_history(self, session_id: str, history: ChatHistoryManager) -> ConversationMeta:
        return self.storage.save_session(session_id, history.get_messages())

    def delete_session(self, session_id: str) -> bool:
        return self.storage.delete_session(session_id)

    def delete_sessions(self, session_ids: List[str]) -> int:
        """Delete multiple sessions.

        Args:
            session_ids: List of session IDs to delete

        Returns:
            Number of successfully deleted sessions
        """
        deleted_count = 0
        for session_id in session_ids:
            if self.storage.delete_session(session_id):
                deleted_count += 1
        return deleted_count

    def delete_all_sessions(self) -> int:
        """Delete all sessions.

        Returns:
            Number of deleted sessions
        """
        all_sessions = self.storage.list_sessions()
        session_ids = [meta.session_id for meta in all_sessions]
        return self.delete_sessions(session_ids)

    def update_session_title(self, session_id: str, title: str) -> Optional[ConversationMeta]:
        return self.storage.update_session_title(session_id, title)

    def export_session(self, session_id: str, export_path: str, fmt: str = "json") -> str:
        return self.storage.export_session(session_id, export_path, fmt=fmt)
