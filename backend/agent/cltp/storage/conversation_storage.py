"""
Conversation storage adapter (file-based).

Stores session history on disk for persistence and recovery.
"""

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.agent.schema import Message, Role


@dataclass
class ConversationMeta:
    session_id: str
    created_at: str
    updated_at: str
    title: str
    message_count: int


class FileConversationStorage:
    """File-based conversation storage adapter."""

    def __init__(self, base_dir: str = "data/conversations"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _session_path(self, session_id: str) -> Path:
        safe_id = session_id.replace("/", "_")
        return self.base_dir / f"{safe_id}.json"

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

    def save_session(self, session_id: str, messages: List[Message]) -> ConversationMeta:
        now = datetime.now().isoformat()
        path = self._session_path(session_id)
        created_at = now
        updated_at = now
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                created_at = data.get("created_at", now)
                # If messages are the same, we might want to keep the old updated_at
                # But for simplicity, we'll use the file's last modified time or a dedicated field
                updated_at = data.get("updated_at", now)
                if messages:
                    # If there are messages, we update the timestamp
                    updated_at = now
            except Exception:
                created_at = now

        meta = ConversationMeta(
            session_id=session_id,
            created_at=created_at,
            updated_at=updated_at,
            title=self._derive_title(messages),
            message_count=len(messages),
        )
        payload = {
            "session_id": session_id,
            "created_at": meta.created_at,
            "updated_at": meta.updated_at,
            "title": meta.title,
            "message_count": meta.message_count,
            "messages": [self._serialize_message(m) for m in messages],
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return meta

    def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        path = self._session_path(session_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def list_sessions(self) -> List[ConversationMeta]:
        metas: List[ConversationMeta] = []
        for path in sorted(self.base_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                metas.append(
                    ConversationMeta(
                        session_id=data.get("session_id", path.stem),
                        created_at=data.get("created_at", ""),
                        updated_at=data.get("updated_at", ""),
                        title=data.get("title", "Conversation"),
                        message_count=int(data.get("message_count", 0)),
                    )
                )
            except Exception:
                continue
        return metas

    def delete_session(self, session_id: str) -> bool:
        path = self._session_path(session_id)
        if not path.exists():
            return False
        path.unlink()
        return True

    def update_session_title(self, session_id: str, title: str) -> Optional[ConversationMeta]:
        data = self.load_session(session_id)
        if not data:
            return None

        now = datetime.now().isoformat()
        created_at = data.get("created_at", now)
        data["title"] = title
        data["updated_at"] = now
        data["message_count"] = len(data.get("messages", []))

        path = self._session_path(session_id)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

        return ConversationMeta(
            session_id=data.get("session_id", session_id),
            created_at=created_at,
            updated_at=now,
            title=title,
            message_count=data.get("message_count", 0),
        )

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
            except Exception:
                continue
        return messages

    def append_session_messages(
        self,
        session_id: str,
        base_seq: int,
        messages_delta: List[Message],
    ) -> Dict[str, Any]:
        """Append messages incrementally with base sequence check."""
        existing = self.load_messages(session_id)
        existing_count = len(existing)

        if base_seq < 0:
            base_seq = 0

        # Idempotent replay: if caller re-sends already appended tail, treat as no-op.
        if base_seq < existing_count:
            tail = existing[base_seq : base_seq + len(messages_delta)]
            tail_sig = [self._serialize_message(m) for m in tail]
            delta_sig = [self._serialize_message(m) for m in messages_delta]
            if tail_sig == delta_sig:
                meta = self.save_session(session_id, existing)
                return {
                    "conflict": False,
                    "skipped": True,
                    "accepted_count": 0,
                    "new_seq": existing_count,
                    "meta": meta,
                }
            return {
                "conflict": True,
                "expected_base_seq": existing_count,
            }

        if base_seq > existing_count:
            return {
                "conflict": True,
                "expected_base_seq": existing_count,
            }

        merged = existing + messages_delta
        meta = self.save_session(session_id, merged)
        return {
            "conflict": False,
            "skipped": len(messages_delta) == 0,
            "accepted_count": len(messages_delta),
            "new_seq": len(merged),
            "meta": meta,
        }
