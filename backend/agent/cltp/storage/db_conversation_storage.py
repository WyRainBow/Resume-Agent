"""
Database-backed conversation storage adapter.

Stores session history in SQL tables for persistence and queryability.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.agent.schema import Message, Role

try:
    from backend.database import SessionLocal
    from backend.models import AgentConversation, AgentMessage
except ImportError:
    from database import SessionLocal
    from models import AgentConversation, AgentMessage

from backend.agent.cltp.storage.conversation_storage import ConversationMeta

logger = logging.getLogger(__name__)


class DBConversationStorage:
    """Database-backed conversation storage adapter."""

    def _serialize_message(self, message: Message) -> Dict[str, Any]:
        payload = message.to_dict()
        role = payload.get("role")
        if isinstance(role, Role):
            payload["role"] = role.value
        return payload

    def _deserialize_message(self, payload: Dict[str, Any]) -> Message:
        data = dict(payload)
        role = data.get("role")
        if isinstance(role, Role):
            data["role"] = role.value
        return Message(**data)

    def _derive_title(self, messages: List[Message]) -> str:
        def _first_non_empty(contents: List[Message], role: Optional[Role] = None) -> Optional[str]:
            for msg in contents:
                if role is not None and msg.role != role:
                    continue
                content = (msg.content or "").strip()
                if content:
                    return content
            return None

        title = _first_non_empty(messages, Role.USER)
        if not title:
            title = _first_non_empty(messages)
        return (title or "New Conversation")[:40]

    def _message_to_row(self, conversation_pk: int, seq: int, message: Message) -> AgentMessage:
        payload = self._serialize_message(message)
        role = payload.get("role")
        if isinstance(role, Role):
            role = role.value
        return AgentMessage(
            conversation_id=conversation_pk,
            seq=seq,
            role=str(role or ""),
            content=payload.get("content"),
            thought=payload.get("thought"),
            name=payload.get("name"),
            tool_call_id=payload.get("tool_call_id"),
            tool_calls=payload.get("tool_calls"),
            base64_image=payload.get("base64_image"),
        )

    def _row_to_message(self, row: AgentMessage) -> Message:
        payload: Dict[str, Any] = {"role": row.role}
        if row.content is not None:
            payload["content"] = row.content
        if row.thought is not None:
            payload["thought"] = row.thought
        if row.name is not None:
            payload["name"] = row.name
        if row.tool_call_id is not None:
            payload["tool_call_id"] = row.tool_call_id
        if row.tool_calls is not None:
            payload["tool_calls"] = row.tool_calls
        if row.base64_image is not None:
            payload["base64_image"] = row.base64_image
        return self._deserialize_message(payload)

    def save_session(self, session_id: str, messages: List[Message]) -> ConversationMeta:
        now = datetime.now()
        db = SessionLocal()
        try:
            conversation = (
                db.query(AgentConversation)
                .filter(AgentConversation.session_id == session_id)
                .first()
            )

            if conversation is None:
                conversation = AgentConversation(
                    session_id=session_id,
                    title=self._derive_title(messages),
                    message_count=len(messages),
                    created_at=now,
                    updated_at=now,
                    last_message_at=now if messages else None,
                )
                db.add(conversation)
                db.flush()
            else:
                conversation.title = self._derive_title(messages)
                conversation.message_count = len(messages)
                conversation.updated_at = now
                conversation.last_message_at = now if messages else conversation.last_message_at

            # Always clear existing rows before re-inserting the full ordered snapshot.
            db.query(AgentMessage).filter(
                AgentMessage.conversation_id == conversation.id
            ).delete(synchronize_session=False)

            for seq, message in enumerate(messages):
                db.add(self._message_to_row(conversation.id, seq, message))

            db.commit()

            created_at = conversation.created_at or now
            updated_at = conversation.updated_at or now
            return ConversationMeta(
                session_id=conversation.session_id,
                created_at=created_at.isoformat(),
                updated_at=updated_at.isoformat(),
                title=conversation.title or "New Conversation",
                message_count=conversation.message_count or 0,
            )
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        db = SessionLocal()
        try:
            conversation = (
                db.query(AgentConversation)
                .filter(AgentConversation.session_id == session_id)
                .first()
            )
            if conversation is None:
                return None

            rows = (
                db.query(AgentMessage)
                .filter(AgentMessage.conversation_id == conversation.id)
                .order_by(AgentMessage.seq.asc())
                .all()
            )
            messages = [self._serialize_message(self._row_to_message(row)) for row in rows]
            return {
                "session_id": conversation.session_id,
                "created_at": conversation.created_at.isoformat() if conversation.created_at else "",
                "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else "",
                "title": conversation.title or "Conversation",
                "message_count": conversation.message_count or len(messages),
                "messages": messages,
            }
        finally:
            db.close()

    def list_sessions(self) -> List[ConversationMeta]:
        db = SessionLocal()
        try:
            rows = (
                db.query(AgentConversation)
                .order_by(AgentConversation.updated_at.desc())
                .all()
            )
            metas: List[ConversationMeta] = []
            for row in rows:
                metas.append(
                    ConversationMeta(
                        session_id=row.session_id,
                        created_at=row.created_at.isoformat() if row.created_at else "",
                        updated_at=row.updated_at.isoformat() if row.updated_at else "",
                        title=row.title or "Conversation",
                        message_count=row.message_count or 0,
                    )
                )
            return metas
        finally:
            db.close()

    def delete_session(self, session_id: str) -> bool:
        db = SessionLocal()
        try:
            conversation = (
                db.query(AgentConversation)
                .filter(AgentConversation.session_id == session_id)
                .first()
            )
            if conversation is None:
                return False
            db.query(AgentMessage).filter(
                AgentMessage.conversation_id == conversation.id
            ).delete(synchronize_session=False)
            db.delete(conversation)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def update_session_title(self, session_id: str, title: str) -> Optional[ConversationMeta]:
        db = SessionLocal()
        try:
            conversation = (
                db.query(AgentConversation)
                .filter(AgentConversation.session_id == session_id)
                .first()
            )
            if conversation is None:
                return None

            conversation.title = title
            conversation.updated_at = datetime.now()
            db.commit()
            db.refresh(conversation)

            return ConversationMeta(
                session_id=conversation.session_id,
                created_at=conversation.created_at.isoformat() if conversation.created_at else "",
                updated_at=conversation.updated_at.isoformat() if conversation.updated_at else "",
                title=conversation.title or "Conversation",
                message_count=conversation.message_count or 0,
            )
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def export_session(self, session_id: str, export_path: str, fmt: str = "json") -> str:
        data = self.load_session(session_id)
        if not data:
            raise FileNotFoundError("Session not found")

        export_file = Path(export_path)
        export_file.parent.mkdir(parents=True, exist_ok=True)

        if fmt == "markdown":
            lines = [f"# Conversation {session_id}", ""]
            for msg in data.get("messages", []):
                role = msg.get("role", "assistant")
                content = msg.get("content", "")
                lines.append(f"## {role}")
                lines.append(content or "")
                lines.append("")
            export_file.write_text("\n".join(lines), encoding="utf-8")
        else:
            export_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(export_file)

    def load_messages(self, session_id: str) -> List[Message]:
        data = self.load_session(session_id)
        if not data:
            return []
        messages = []
        for payload in data.get("messages", []):
            try:
                messages.append(self._deserialize_message(payload))
            except Exception as exc:
                logger.warning(f"Failed to deserialize message in session {session_id}: {exc}")
                continue
        return messages
