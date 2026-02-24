"""Chat history routes.

Provides endpoints for chat history management.
"""

import logging
import hashlib
from typing import Any

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.agent.memory.chat_history_manager import ChatHistoryManager
from backend.agent.memory.conversation_manager import ConversationManager
from backend.agent.cltp.storage.factory import get_conversation_storage
from backend.agent.schema import Message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])
storage = get_conversation_storage()
conversation_manager = ConversationManager(storage=storage)
_save_fingerprint_cache: dict[str, tuple[int, str]] = {}


def _history_error_detail(message: str, action: str = "CHECK_SERVER_LOGS") -> dict[str, str]:
    code = "AGENT_HISTORY_ERROR"
    if "DB_SCHEMA_MISMATCH" in message:
        code = "DB_SCHEMA_MISMATCH"
        action = "RUN_ALEMBIC_UPGRADE"
    return {
        "code": code,
        "message": message,
        "action": action,
    }


class HistoryResponse(BaseModel):
    """Chat history response."""

    session_id: str
    messages: list[dict[str, Any]]
    count: int


class HistoryClearResponse(BaseModel):
    """History clear response."""

    session_id: str
    message: str


class SessionTitleUpdateRequest(BaseModel):
    title: str


class BatchDeleteRequest(BaseModel):
    session_ids: List[str]


class SessionSaveRequest(BaseModel):
    messages: List[Message]
    client_save_seq: Optional[int] = None
    last_message_hash: Optional[str] = None


class SessionAppendRequest(BaseModel):
    base_seq: int
    messages_delta: List[Message]
    client_save_seq: Optional[int] = None
    last_message_hash: Optional[str] = None


@router.get("/{session_id}", response_model=HistoryResponse)
async def get_history(session_id: str) -> HistoryResponse:
    """Get chat history for a session.

    Args:
        session_id: The session identifier

    Returns:
        HistoryResponse with messages
    """
    try:
        messages = conversation_manager.get_history(session_id)

        return HistoryResponse(
            session_id=session_id,
            messages=[
                {"role": m.role, "content": m.content, "thought": m.thought}
                for m in messages
            ],
            count=len(messages),
        )
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error getting history: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.delete("/{session_id}", response_model=HistoryClearResponse)
async def clear_history(session_id: str) -> HistoryClearResponse:
    """Clear chat history for a session.

    Args:
        session_id: The session identifier

    Returns:
        HistoryClearResponse with confirmation
    """
    try:
        # Import _active_sessions from stream module to clean up active session
        from backend.agent.web.routes.stream import _active_sessions
        
        history_manager = ChatHistoryManager(session_id=session_id, storage=storage)
        history_manager.clear_messages()
        await history_manager.save_checkpoint()
        conversation_manager.delete_session(session_id)
        
        # Clean up active session in memory
        if session_id in _active_sessions:
            del _active_sessions[session_id]
            logger.info(f"[History] Cleared active session: {session_id}")

        return HistoryClearResponse(
            session_id=session_id,
            message="History cleared successfully",
        )
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error clearing history: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.post("/{session_id}/restore")
async def restore_history(session_id: str) -> dict[str, Any]:
    """Restore chat history from checkpoint.

    Args:
        session_id: The session identifier

    Returns:
        dict with restored message count
    """
    try:
        history_manager = ChatHistoryManager(session_id=session_id, storage=storage)
        await history_manager.restore_from_checkpoint()
        messages = history_manager.get_messages()

        return {
            "session_id": session_id,
            "message_count": len(messages),
            "messages": [
                {"role": m.role, "content": m.content}
                for m in messages
            ],
        }
    except Exception as e:
        logger.error(f"Error restoring history: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error restoring history: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.get("/sessions/list")
async def list_sessions(page: int = 1, page_size: int = 20) -> dict[str, Any]:
    """List conversation sessions with pagination."""
    try:
        metas = conversation_manager.list_sessions()
        metas.sort(
            key=lambda m: (m.updated_at or m.created_at or ""),
            reverse=True,
        )

        total = len(metas)
        page_size = max(1, page_size)
        page = max(1, page)
        total_pages = (total + page_size - 1) // page_size if total else 0

        start = (page - 1) * page_size
        end = start + page_size
        sliced = metas[start:end]

        return {
            "sessions": [
                {
                    "session_id": m.session_id,
                    "title": m.title,
                    "created_at": m.created_at,
                    "updated_at": m.updated_at,
                    "message_count": m.message_count,
                }
                for m in sliced
            ],
            "pagination": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
            },
        }
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error listing sessions: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.get("/sessions/{session_id}")
async def get_session_messages(
    session_id: str, offset: int = 0, limit: int = 200
) -> dict[str, Any]:
    """Get session history with pagination."""
    try:
        messages = conversation_manager.get_history(session_id)
        sliced = messages[offset: offset + limit]
        return {
            "session_id": session_id,
            "offset": offset,
            "limit": limit,
            "total": len(messages),
            "messages": [
                {"role": m.role, "content": m.content, "thought": m.thought}
                for m in sliced
            ],
        }
    except Exception as e:
        logger.error(f"Error getting session messages: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error getting session messages: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.post("/sessions/{session_id}/save")
async def save_session_messages(
    session_id: str, request: SessionSaveRequest
) -> dict[str, Any]:
    """Save session messages immediately."""
    try:
        messages = request.messages or []
        client_save_seq = request.client_save_seq or 0
        last_message_hash = (request.last_message_hash or "").strip()
        if not last_message_hash and messages:
            last = messages[-1]
            digest_input = f"{last.role}|{last.content or ''}|{last.thought or ''}"
            last_message_hash = hashlib.sha1(
                digest_input.encode("utf-8"),
                usedforsecurity=False,
            ).hexdigest()

        cached = _save_fingerprint_cache.get(session_id)
        if (
            cached
            and last_message_hash
            and cached[1] == last_message_hash
            and client_save_seq <= cached[0]
        ):
            return {
                "session_id": session_id,
                "message_count": len(messages),
                "skipped": True,
                "reason": "idempotent-noop",
            }

        # Use a large sliding window here to avoid truncating saved history snapshots.
        # Session save endpoint should persist the full client snapshot.
        history_manager = ChatHistoryManager(
            session_id=session_id,
            storage=storage,
            k=max(1000, len(messages) + 10),
        )
        history_manager.load_messages(messages)
        meta = conversation_manager.save_history(session_id, history_manager)
        if last_message_hash:
            _save_fingerprint_cache[session_id] = (
                max(client_save_seq, (cached[0] if cached else 0)),
                last_message_hash,
            )
        return {
            "session_id": meta.session_id,
            "title": meta.title,
            "created_at": meta.created_at,
            "updated_at": meta.updated_at,
            "message_count": meta.message_count,
            "skipped": False,
        }
    except Exception as e:
        logger.error(f"Error saving session: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error saving session: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.post("/sessions/{session_id}/append")
async def append_session_messages(
    session_id: str, request: SessionAppendRequest
) -> dict[str, Any]:
    """Append message delta incrementally.

    Returns 409 when base_seq conflicts with current persisted sequence.
    """
    try:
        messages_delta = request.messages_delta or []
        base_seq = max(0, int(request.base_seq))
        client_save_seq = request.client_save_seq or 0
        last_message_hash = (request.last_message_hash or "").strip()
        if not last_message_hash and messages_delta:
            last = messages_delta[-1]
            digest_input = f"{last.role}|{last.content or ''}|{last.thought or ''}"
            last_message_hash = hashlib.sha1(
                digest_input.encode("utf-8"),
                usedforsecurity=False,
            ).hexdigest()

        cached = _save_fingerprint_cache.get(session_id)
        if (
            cached
            and last_message_hash
            and cached[1] == last_message_hash
            and client_save_seq <= cached[0]
        ):
            return {
                "session_id": session_id,
                "skipped": True,
                "reason": "idempotent-noop",
            }

        append_method = getattr(storage, "append_session_messages", None)
        if not callable(append_method):
            # Fallback for storage adapters without append support:
            existing = conversation_manager.get_history(session_id)
            if base_seq != len(existing):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "base_seq conflict",
                        "expected_base_seq": len(existing),
                    },
                )
            merged = existing + messages_delta
            history_manager = ChatHistoryManager(
                session_id=session_id,
                storage=storage,
                k=max(1000, len(merged) + 10),
            )
            history_manager.load_messages(merged)
            meta = conversation_manager.save_history(session_id, history_manager)
            new_seq = len(merged)
            accepted_count = len(messages_delta)
            skipped = accepted_count == 0
        else:
            result = append_method(session_id, base_seq, messages_delta)
            if result.get("conflict"):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "base_seq conflict",
                        "expected_base_seq": result.get("expected_base_seq", 0),
                    },
                )
            meta = result["meta"]
            new_seq = int(result.get("new_seq", meta.message_count))
            accepted_count = int(result.get("accepted_count", 0))
            skipped = bool(result.get("skipped", False))

        if last_message_hash:
            _save_fingerprint_cache[session_id] = (
                max(client_save_seq, (cached[0] if cached else 0)),
                last_message_hash,
            )

        return {
            "session_id": meta.session_id,
            "title": meta.title,
            "created_at": meta.created_at,
            "updated_at": meta.updated_at,
            "message_count": meta.message_count,
            "accepted_count": accepted_count,
            "new_seq": new_seq,
            "skipped": skipped,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error appending session: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error appending session: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.put("/sessions/{session_id}/title")
async def update_session_title(
    session_id: str, request: SessionTitleUpdateRequest
) -> dict[str, Any]:
    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    meta = conversation_manager.update_session_title(session_id, title)
    if not meta:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": meta.session_id,
        "title": meta.title,
        "created_at": meta.created_at,
        "updated_at": meta.updated_at,
        "message_count": meta.message_count,
    }


@router.post("/sessions/{session_id}/load")
async def load_session(session_id: str) -> dict[str, Any]:
    """Load a session and return its messages."""
    try:
        history = conversation_manager.get_or_create_history(session_id)
        messages = history.get_messages()
        return {
            "session_id": session_id,
            "message_count": len(messages),
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
    except Exception as e:
        logger.error(f"Error loading session: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error loading session: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.get("/sessions/{session_id}/export")
async def export_session(session_id: str, fmt: str = "json") -> dict[str, Any]:
    """Export a session to a file (json/markdown)."""
    try:
        export_dir = "data/exports"
        extension = "md" if fmt == "markdown" else "json"
        export_path = f"{export_dir}/{session_id}.{extension}"
        path = conversation_manager.export_session(session_id, export_path, fmt=fmt)
        return {"session_id": session_id, "export_path": path}
    except Exception as e:
        logger.error(f"Error exporting session: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error exporting session: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.post("/sessions/batch-delete")
async def batch_delete_sessions(request: BatchDeleteRequest) -> dict[str, Any]:
    """Delete multiple sessions.

    Args:
        request: BatchDeleteRequest with session_ids list

    Returns:
        dict with deleted_count
    """
    try:
        # Import _active_sessions from stream module to clean up active sessions
        from backend.agent.web.routes.stream import _active_sessions
        
        deleted_count = conversation_manager.delete_sessions(request.session_ids)
        
        # Clean up active sessions in memory
        for session_id in request.session_ids:
            if session_id in _active_sessions:
                del _active_sessions[session_id]
                logger.info(f"[History] Cleared active session: {session_id}")
        
        logger.info(f"Batch deleted {deleted_count}/{len(request.session_ids)} sessions")
        return {
            "deleted_count": deleted_count,
            "total_requested": len(request.session_ids),
            "message": f"Successfully deleted {deleted_count} session(s)"
        }
    except Exception as e:
        logger.error(f"Error batch deleting sessions: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error batch deleting sessions: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )


@router.delete("/sessions/all")
async def delete_all_sessions() -> dict[str, Any]:
    """Delete all sessions.

    Returns:
        dict with deleted_count
    """
    try:
        # Import _active_sessions from stream module to clean up active sessions
        from backend.agent.web.routes.stream import _active_sessions
        
        # Get all session IDs before deletion
        all_sessions = conversation_manager.list_sessions()
        session_ids = [meta.session_id for meta in all_sessions]
        
        deleted_count = conversation_manager.delete_all_sessions()
        
        # Clean up all active sessions in memory
        _active_sessions.clear()
        logger.info(f"[History] Cleared all active sessions (count: {len(session_ids)})")
        
        logger.info(f"Deleted all {deleted_count} sessions")
        return {
            "deleted_count": deleted_count,
            "message": f"Successfully deleted all {deleted_count} session(s)"
        }
    except Exception as e:
        logger.error(f"Error deleting all sessions: {e}")
        raise HTTPException(
            status_code=500,
            detail=_history_error_detail(
                f"Error deleting all sessions: {e}",
                action="CHECK_DB_CONNECTION_AND_RUN_ALEMBIC_UPGRADE",
            ),
        )
