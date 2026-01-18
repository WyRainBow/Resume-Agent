"""Chat history routes.

Provides endpoints for chat history management.
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.agent.memory.chat_history_manager import ChatHistoryManager
from backend.agent.memory.conversation_manager import ConversationManager
from backend.agent.cltp.storage.conversation_storage import FileConversationStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])
storage = FileConversationStorage()
conversation_manager = ConversationManager(storage=storage)


class HistoryResponse(BaseModel):
    """Chat history response."""

    session_id: str
    messages: list[dict[str, str]]
    count: int


class HistoryClearResponse(BaseModel):
    """History clear response."""

    session_id: str
    message: str


class SessionTitleUpdateRequest(BaseModel):
    title: str


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
                {"role": m.role, "content": m.content}
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
        history_manager = ChatHistoryManager(session_id=session_id, storage=storage)
        history_manager.clear_messages()
        await history_manager.save_checkpoint()
        conversation_manager.delete_session(session_id)

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
async def list_sessions() -> dict[str, Any]:
    """List all conversation sessions."""
    metas = conversation_manager.list_sessions()
    return {
        "sessions": [
            {
                "session_id": m.session_id,
                "title": m.title,
                "created_at": m.created_at,
                "updated_at": m.updated_at,
                "message_count": m.message_count,
            }
            for m in metas
        ]
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
        "messages": [{"role": m.role, "content": m.content} for m in sliced],
    }


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
