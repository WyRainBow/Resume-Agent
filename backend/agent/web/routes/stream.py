"""SSE Stream route for agent interaction.

This module provides:
- POST /stream: SSE endpoint for streaming agent responses
- Heartbeat mechanism for keeping connection alive
- CLTP chunks are generated server-side and adapted to SSE for compatibility
"""

import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.agent.agent.manus import Manus
from backend.agent.logger import logger
from backend.agent.schema import AgentState as SchemaAgentState, Message, Role
from backend.agent.web.schemas.stream import StreamRequest, SSEEvent, HeartbeatEvent
from backend.agent.web.streaming.agent_stream import StreamProcessor
from backend.agent.web.streaming.state_machine import AgentStateMachine
from backend.agent.web.streaming.events import StreamEvent
from backend.agent.cltp.storage.conversation_storage import FileConversationStorage
from backend.agent.memory.conversation_manager import ConversationManager

router = APIRouter()

# Create stream processor for agent execution
stream_processor = StreamProcessor()
storage = FileConversationStorage()
conversation_manager = ConversationManager(storage=storage)

# Store active sessions (conversation_id -> agent instance)
_active_sessions: dict[str, dict] = {}

# Heartbeat configuration
HEARTBEAT_INTERVAL = 30  # seconds


def _get_or_create_session(
    conversation_id: str,
    resume_path: Optional[str] = None,
    resume_data: Optional[dict] = None,
) -> dict:
    """Get existing session or create a new one.

    Args:
        conversation_id: Conversation identifier
        resume_path: Optional path to resume file

    Returns:
        Session dict containing agent and chat history
    """
    if conversation_id not in _active_sessions:
        from backend.agent.memory import ChatHistoryManager
        from backend.agent.tool.resume_data_store import ResumeDataStore

        agent = Manus(session_id=conversation_id)
        chat_history = conversation_manager.get_or_create_history(conversation_id)
        # Align agent's internal history with session history
        if hasattr(agent, "_chat_history"):
            agent._chat_history = chat_history

        if resume_data:
            ResumeDataStore.set_data(resume_data, session_id=conversation_id)
            if hasattr(agent, "_conversation_state") and agent._conversation_state:
                agent._conversation_state.update_resume_loaded(True)

        _active_sessions[conversation_id] = {
            "agent": agent,
            "chat_history": chat_history,
            "resume_path": resume_path,
            "created_at": datetime.now(),
        }
        logger.info(f"[SSE] Created new session: {conversation_id}")
    else:
        # Update resume path if provided
        if resume_path:
            _active_sessions[conversation_id]["resume_path"] = resume_path
        if resume_data:
            from backend.agent.tool.resume_data_store import ResumeDataStore
            ResumeDataStore.set_data(resume_data, session_id=conversation_id)
            agent = _active_sessions[conversation_id].get("agent")
            if agent and hasattr(agent, "_conversation_state") and agent._conversation_state:
                agent._conversation_state.update_resume_loaded(True)

    return _active_sessions[conversation_id]


def _cleanup_session(conversation_id: str) -> None:
    """Cleanup session after completion.

    Args:
        conversation_id: Conversation identifier to cleanup
    """
    # Keep sessions for now to maintain conversation history
    # Only cleanup very old sessions (e.g., > 1 hour)
    pass


async def _stream_event_generator(
    conversation_id: str,
    prompt: str,
    resume_path: Optional[str] = None,
    resume_data: Optional[dict] = None,
    cursor: Optional[str] = None,
    resume: bool = False,
) -> AsyncGenerator[str, None]:
    """Generate SSE events from agent execution.

    This generator:
    1. Creates/gets agent session
    2. Streams agent events as SSE format
    3. Sends heartbeat when idle
    4. Handles errors gracefully

    Args:
        conversation_id: Conversation identifier
        prompt: User message
        resume_path: Optional resume file path

    Yields:
        SSE formatted strings
    """
    session = _get_or_create_session(conversation_id, resume_path, resume_data)
    agent = session["agent"]
    chat_history = session["chat_history"]

    # Create state machine for this execution
    state_machine = AgentStateMachine(conversation_id)

    # Track last message time for heartbeat
    last_message_time = time.time()

    try:
        # Send initial status event
        status_event = SSEEvent(
            type="status",
            data={"content": "processing", "conversation_id": conversation_id}
        )
        yield status_event.to_sse_format()
        last_message_time = time.time()

        # Restore chat history to agent memory if needed
        existing_messages = chat_history.get_messages()
        if existing_messages and len(agent.memory.messages) == 0:
            logger.info(f"[SSE] Restoring {len(existing_messages)} history messages to agent")
            for msg in existing_messages:
                role_value = msg.role.value if hasattr(msg.role, 'value') else str(msg.role)
                if role_value == "user":
                    agent.memory.add_message(Message.user_message(msg.content))
                elif role_value == "assistant":
                    agent.memory.add_message(Message(
                        role=Role.ASSISTANT,
                        content=msg.content,
                        tool_calls=msg.tool_calls
                    ))
                elif role_value == "tool":
                    agent.memory.add_message(Message.tool_message(
                        content=msg.content,
                        name=msg.name or "unknown",
                        tool_call_id=msg.tool_call_id or ""
                    ))

        # Add user message to chat history
        chat_history.add_message(Message(role=Role.USER, content=prompt))

        # Execute agent and stream events
        async for event in stream_processor.start_stream(
            session_id=conversation_id,
            agent=agent,
            state_machine=state_machine,
            event_sender=lambda d: None,  # Not used in SSE mode
            user_message=prompt,
            chat_history_manager=chat_history,
        ):
            # Convert StreamEvent to SSE format
            event_dict = event.to_dict()
            sse_event = SSEEvent(
                type=event_dict.get("type", "unknown"),
                data=event_dict
            )
            yield sse_event.to_sse_format()
            last_message_time = time.time()

            # Small delay to prevent overwhelming the client
            await asyncio.sleep(0.01)

            # Check if heartbeat is needed during long operations
            current_time = time.time()
            if current_time - last_message_time > HEARTBEAT_INTERVAL:
                heartbeat = HeartbeatEvent()
                yield heartbeat.to_sse_format()
                last_message_time = current_time

        # Send completion status
        complete_event = SSEEvent(
            type="status",
            data={"content": "complete", "conversation_id": conversation_id}
        )
        yield complete_event.to_sse_format()

    except asyncio.CancelledError:
        logger.info(f"[SSE] Stream cancelled for session: {conversation_id}")
        cancel_event = SSEEvent(
            type="status",
            data={"content": "cancelled", "conversation_id": conversation_id}
        )
        yield cancel_event.to_sse_format()

    except Exception as e:
        logger.exception(f"[SSE] Error in stream for session {conversation_id}: {e}")
        error_event = SSEEvent(
            type="error",
            data={"content": str(e), "error_type": type(e).__name__}
        )
        yield error_event.to_sse_format()

    finally:
        _cleanup_session(conversation_id)


@router.post("/stream")
async def stream_events(request: StreamRequest) -> StreamingResponse:
    """SSE streaming endpoint for agent interaction.

    This endpoint:
    1. Accepts user messages
    2. Returns Server-Sent Events stream
    3. Includes heartbeat for connection keep-alive

    Args:
        request: StreamRequest with prompt and optional conversation_id

    Returns:
        StreamingResponse with SSE content
    """
    # Generate conversation ID if not provided
    conversation_id = request.conversation_id or str(uuid.uuid4())

    prompt = request.prompt or request.message
    if not prompt:
        raise HTTPException(status_code=422, detail="Missing prompt/message")

    logger.info(f"[SSE] Starting stream for conversation: {conversation_id}")
    if request.resume:
        logger.info(
            f"[SSE] Resume requested for conversation: {conversation_id} cursor={request.cursor}"
        )
    logger.info(f"[SSE] Prompt: {prompt[:100]}...")

    return StreamingResponse(
        _stream_event_generator(
            conversation_id=conversation_id,
            prompt=prompt,
            resume_path=request.resume_path,
            resume_data=request.resume_data,
            cursor=request.cursor,
            resume=bool(request.resume),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


@router.post("/stream/stop/{conversation_id}")
async def stop_stream(conversation_id: str) -> dict:
    """Stop an active stream.

    Args:
        conversation_id: The conversation to stop

    Returns:
        Status message
    """
    success = await stream_processor.stop_stream(conversation_id)

    if success:
        logger.info(f"[SSE] Stopped stream for conversation: {conversation_id}")
        return {"status": "stopped", "conversation_id": conversation_id}
    else:
        raise HTTPException(status_code=404, detail="Stream not found")


@router.delete("/stream/session/{conversation_id}")
async def clear_session(conversation_id: str) -> dict:
    """Clear a conversation session.

    Args:
        conversation_id: The conversation to clear

    Returns:
        Status message
    """
    if conversation_id in _active_sessions:
        del _active_sessions[conversation_id]
        logger.info(f"[SSE] Cleared session: {conversation_id}")
        return {"status": "cleared", "conversation_id": conversation_id}
    else:
        raise HTTPException(status_code=404, detail="Session not found")



