"""
Conversation manager for handling session history persistence.
"""

from typing import Any, List, Optional

from backend.agent.cltp.storage.conversation_storage import ConversationMeta
from backend.agent.memory.chat_history_manager import ChatHistoryManager
from backend.agent.schema import Message


class ConversationManager:
    """Manage conversation sessions and persistence."""

    def __init__(self, storage: Optional[Any] = None):
        if storage is None:
            from backend.agent.cltp.storage.factory import get_conversation_storage

            self.storage = get_conversation_storage()
        else:
            self.storage = storage

    def list_sessions(self, user_id: Optional[int] = None) -> List[ConversationMeta]:
        return self.storage.list_sessions(user_id=user_id)

    def get_history(self, session_id: str, user_id: Optional[int] = None) -> List[Message]:
        return self.storage.load_messages(session_id, user_id=user_id)

    def get_or_create_history(self, session_id: str, user_id: Optional[int] = None) -> ChatHistoryManager:
        history = ChatHistoryManager(session_id=session_id, storage=self.storage)
        messages = self.storage.load_messages(session_id, user_id=user_id)
        if messages:
            history.load_messages(messages)
        return history

    def save_history(
        self, session_id: str, history: ChatHistoryManager, user_id: Optional[int] = None
    ) -> ConversationMeta:
        return self.storage.save_session(session_id, history.get_messages(), user_id=user_id)

    def delete_session(self, session_id: str, user_id: Optional[int] = None) -> bool:
        return self.storage.delete_session(session_id, user_id=user_id)

    def delete_sessions(self, session_ids: List[str], user_id: Optional[int] = None) -> int:
        """Delete multiple sessions.

        Args:
            session_ids: List of session IDs to delete

        Returns:
            Number of successfully deleted sessions
        """
        deleted_count = 0
        for session_id in session_ids:
            if self.storage.delete_session(session_id, user_id=user_id):
                deleted_count += 1
        return deleted_count

    def delete_all_sessions(self, user_id: Optional[int] = None) -> int:
        """Delete all sessions.

        Returns:
            Number of deleted sessions
        """
        all_sessions = self.storage.list_sessions(user_id=user_id)
        session_ids = [meta.session_id for meta in all_sessions]
        return self.delete_sessions(session_ids, user_id=user_id)

    def update_session_title(
        self, session_id: str, title: str, user_id: Optional[int] = None
    ) -> Optional[ConversationMeta]:
        return self.storage.update_session_title(session_id, title, user_id=user_id)

    def export_session(
        self, session_id: str, export_path: str, fmt: str = "json", user_id: Optional[int] = None
    ) -> str:
        return self.storage.export_session(session_id, export_path, fmt=fmt, user_id=user_id)
