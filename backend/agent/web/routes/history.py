"""Chat history routes.

Provides endpoints for chat history management.
"""

import logging
from typing import Any

from typing import List
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
            detail=f"Error getting history: {e}",
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
            detail=f"Error clearing history: {e}",
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
            detail=f"Error restoring history: {e}",
        )


@router.get("/sessions/list")
async def list_sessions(page: int = 1, page_size: int = 20) -> dict[str, Any]:
    """List conversation sessions with pagination."""
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


@router.get("/sessions/{session_id}")
async def get_session_messages(
    session_id: str, offset: int = 0, limit: int = 200
) -> dict[str, Any]:
    """Get session history with pagination."""
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


@router.post("/sessions/{session_id}/save")
async def save_session_messages(
    session_id: str, request: SessionSaveRequest
) -> dict[str, Any]:
    """Save session messages immediately."""
    try:
        messages = request.messages or []
        history_manager = ChatHistoryManager(session_id=session_id, storage=storage)
        history_manager.load_messages(messages)
        meta = conversation_manager.save_history(session_id, history_manager)
        return {
            "session_id": meta.session_id,
            "title": meta.title,
            "created_at": meta.created_at,
            "updated_at": meta.updated_at,
            "message_count": meta.message_count,
        }
    except Exception as e:
        logger.error(f"Error saving session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error saving session: {e}",
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
    history = conversation_manager.get_or_create_history(session_id)
    messages = history.get_messages()
    return {
        "session_id": session_id,
        "message_count": len(messages),
        "messages": [{"role": m.role, "content": m.content} for m in messages],
    }


@router.get("/sessions/{session_id}/export")
async def export_session(session_id: str, fmt: str = "json") -> dict[str, Any]:
    """Export a session to a file (json/markdown)."""
    export_dir = "data/exports"
    extension = "md" if fmt == "markdown" else "json"
    export_path = f"{export_dir}/{session_id}.{extension}"
    path = conversation_manager.export_session(session_id, export_path, fmt=fmt)
    return {"session_id": session_id, "export_path": path}


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
            detail=f"Error batch deleting sessions: {e}",
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
            detail=f"Error deleting all sessions: {e}",
        )
