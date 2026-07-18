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

    def list_sessions(
        self, user_id: Optional[str] = None, *, all_users: bool = False
    ) -> List[ConversationMeta]:
        return self.storage.list_sessions(user_id=user_id, all_users=all_users)

    def get_history(
        self,
        session_id: str,
        user_id: Optional[str] = None,
        *,
        is_admin: bool = False,
    ) -> List[Message]:
        return self.storage.load_messages(
            session_id, user_id=user_id, is_admin=is_admin
        )

    def get_or_create_history(
        self, session_id: str, user_id: Optional[str] = None, *, is_admin: bool = False
    ) -> ChatHistoryManager:
        history = ChatHistoryManager(
            session_id=session_id,
            storage=self.storage,
            user_id=user_id,
            is_admin=is_admin,
        )
        messages = self.storage.load_messages(
            session_id, user_id=user_id, is_admin=is_admin
        )
        if messages:
            history.load_messages(messages)
        return history

    def save_history(
        self,
        session_id: str,
        history: ChatHistoryManager,
        user_id: Optional[str] = None,
        *,
        is_admin: bool = False,
    ) -> ConversationMeta:
        return self.storage.save_session(
            session_id,
            history.get_messages(),
            user_id=user_id,
            is_admin=is_admin,
        )

    def delete_session(
        self,
        session_id: str,
        user_id: Optional[str] = None,
        *,
        is_admin: bool = False,
    ) -> bool:
        return self.storage.delete_session(
            session_id, user_id=user_id, is_admin=is_admin
        )

    def delete_sessions(
        self,
        session_ids: List[str],
        user_id: Optional[str] = None,
        *,
        is_admin: bool = False,
    ) -> int:
        """Delete multiple sessions.

        Args:
            session_ids: List of session IDs to delete

        Returns:
            Number of successfully deleted sessions
        """
        deleted_count = 0
        for session_id in session_ids:
            if self.storage.delete_session(
                session_id, user_id=user_id, is_admin=is_admin
            ):
                deleted_count += 1
        return deleted_count

    def delete_all_sessions(
        self, user_id: Optional[str] = None, *, is_admin: bool = False
    ) -> int:
        """Delete all sessions.

        Returns:
            Number of deleted sessions
        """
        all_sessions = self.storage.list_sessions(user_id=user_id)
        session_ids = [meta.session_id for meta in all_sessions]
        return self.delete_sessions(session_ids, user_id=user_id, is_admin=is_admin)

    def update_session_title(
        self,
        session_id: str,
        title: str,
        user_id: Optional[str] = None,
        *,
        is_admin: bool = False,
    ) -> Optional[ConversationMeta]:
        return self.storage.update_session_title(
            session_id, title, user_id=user_id, is_admin=is_admin
        )

    def export_session(
        self,
        session_id: str,
        export_path: str,
        fmt: str = "json",
        user_id: Optional[str] = None,
        *,
        is_admin: bool = False,
    ) -> str:
        return self.storage.export_session(
            session_id, export_path, fmt=fmt, user_id=user_id, is_admin=is_admin
        )

    def get_session_owner(self, session_id: str) -> Optional[int]:
        getter = getattr(self.storage, "get_session_owner", None)
        if callable(getter):
            return getter(session_id)
        return None
