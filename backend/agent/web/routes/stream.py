"""SSE Stream route for agent interaction.

This module provides:
- POST /stream: SSE endpoint for streaming agent responses
- Heartbeat mechanism for keeping connection alive
- StreamEvent -> SSE 对外协议（前端再适配为 CLTP chunk）
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import PermissionDeniedError

from backend.agent.agent.manus import Manus
from backend.agent.config import NetworkConfig, config
from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.schema import AgentState as SchemaAgentState, Message, Role
from backend.agent.web.schemas.stream import StreamRequest, SSEEvent, HeartbeatEvent
from backend.agent.web.streaming.agent_stream import StreamProcessor
from backend.agent.web.streaming.state_machine import AgentStateMachine
from backend.agent.web.streaming.events import StreamEvent
from backend.agent.cltp.storage.factory import get_conversation_storage
from backend.agent.memory.conversation_manager import ConversationManager

router = APIRouter()

# Create stream processor for agent execution
stream_processor = StreamProcessor()
storage = get_conversation_storage()
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
    # Check if session exists in memory but file has been deleted
    if conversation_id in _active_sessions:
        # Verify file still exists in storage
        existing_messages = storage.load_messages(conversation_id)
        if not existing_messages:
            # File has been deleted, but session still exists in memory
            # Clean up old session and create a new one
            logger.info(
                f"[SSE] Session {conversation_id} exists in memory but file deleted, "
                "cleaning up and creating new session"
            )
            # Clear agent memory before deleting session
            old_session = _active_sessions.get(conversation_id)
            if old_session and "agent" in old_session:
                old_agent = old_session["agent"]
                if hasattr(old_agent, "memory") and old_agent.memory:
                    old_agent.memory.messages.clear()
                    logger.info(f"[SSE] Cleared memory for session: {conversation_id}")
            del _active_sessions[conversation_id]

    if conversation_id not in _active_sessions:
        from backend.agent.memory import ChatHistoryManager
        from backend.agent.tool.resume_data_store import ResumeDataStore

        agent = None
        chat_history = None
        last_exc: Exception | None = None

        # Use network configuration manager for retry settings
        network_config = config.network or NetworkConfig()
        max_retries = network_config.agent_init_max_retries
        retry_delay_base = network_config.agent_init_retry_delay
        retry_backoff = network_config.agent_init_retry_backoff

        for attempt in range(1, max_retries + 1):
            try:
                # Use network configuration manager's context manager
                with network_config.without_proxy():
                    agent = Manus(session_id=conversation_id)
                chat_history = conversation_manager.get_or_create_history(
                    conversation_id
                )
                break
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    f"[SSE] Agent init failed (attempt {attempt}/{max_retries}): {exc}"
                )
                # Exponential backoff: delay = delay_base * (backoff ^ (attempt - 1))
                delay = retry_delay_base * (retry_backoff ** (attempt - 1))
                time.sleep(delay)

        if agent is None or chat_history is None:
            raise last_exc or RuntimeError("Failed to create agent session")
        # Align agent's internal history with session history
        if hasattr(agent, "_chat_history"):
            agent._chat_history = chat_history

        if resume_data:
            ResumeDataStore.set_data(resume_data, session_id=conversation_id)
            # 🔍 诊断日志：验证元数据是否正确设置
            stored_meta = ResumeDataStore._meta_by_session.get(conversation_id, {})
            logger.info(f"[SSE] ResumeDataStore meta after set_data: {stored_meta}")
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
            if (
                agent
                and hasattr(agent, "_conversation_state")
                and agent._conversation_state
            ):
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
    logger.info(
        f"[SSE Generator] Starting generator for conversation: {conversation_id}"
    )
    try:
        session = _get_or_create_session(conversation_id, resume_path, resume_data)
        agent = session["agent"]
        chat_history = session["chat_history"]
        logger.info(f"[SSE Generator] Session created/retrieved successfully")

        # Create state machine for this execution
        state_machine = AgentStateMachine(conversation_id)

        # Track last message time for heartbeat
        last_message_time = time.time()

        # Send initial status event
        logger.info(f"[SSE Generator] Preparing initial status event")
        status_event = SSEEvent(
            type="status",
            data={"content": "processing", "conversation_id": conversation_id},
        )
        logger.info(f"[SSE Generator] Yielding initial status event")
        yield status_event.to_sse_format()
        last_message_time = time.time()
        logger.info(f"[SSE Generator] Initial status event yielded successfully")

        # Restore chat history to agent memory if needed
        existing_messages = chat_history.get_messages()

        # If chat_history is empty but agent.memory has messages, clear agent.memory
        # This can happen when a session file was deleted but the active session still exists in memory
        if not existing_messages and len(agent.memory.messages) > 0:
            logger.info(
                f"[SSE] Chat history is empty but agent.memory has {len(agent.memory.messages)} messages. "
                "Clearing agent.memory to prevent stale context."
            )
            agent.memory.messages.clear()

        if existing_messages and len(agent.memory.messages) == 0:
            logger.info(
                f"[SSE] Restoring {len(existing_messages)} history messages to agent"
            )
            for msg in existing_messages:
                role_value = (
                    msg.role.value if hasattr(msg.role, "value") else str(msg.role)
                )
                if role_value == "user":
                    agent.memory.add_message(Message.user_message(msg.content))
                elif role_value == "assistant":
                    agent.memory.add_message(
                        Message(
                            role=Role.ASSISTANT,
                            content=msg.content,
                            tool_calls=msg.tool_calls,
                        )
                    )
                elif role_value == "tool":
                    agent.memory.add_message(
                        Message.tool_message(
                            content=msg.content,
                            name=msg.name or "unknown",
                            tool_call_id=msg.tool_call_id or "",
                        )
                    )

        # Add user message to chat history (don't persist yet, wait for agent to complete)
        chat_history.add_message(Message(role=Role.USER, content=prompt), persist=False)

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
                type=event_dict.get("type", "unknown"), data=event_dict
            )
            yield sse_event.to_sse_format()
            last_message_time = time.time()

            # 真流式场景下不再固定 sleep，降低首字与逐段延迟
            await asyncio.sleep(0)

            # Check if heartbeat is needed during long operations
            current_time = time.time()
            if current_time - last_message_time > HEARTBEAT_INTERVAL:
                heartbeat = HeartbeatEvent()
                yield heartbeat.to_sse_format()
                last_message_time = current_time

        # Send completion status
        complete_event = SSEEvent(
            type="status",
            data={"content": "complete", "conversation_id": conversation_id},
        )
        yield complete_event.to_sse_format()

    except asyncio.CancelledError:
        logger.info(f"[SSE] Stream cancelled for session: {conversation_id}")
        cancel_event = SSEEvent(
            type="status",
            data={"content": "cancelled", "conversation_id": conversation_id},
        )
        yield cancel_event.to_sse_format()

    except PermissionDeniedError as e:
        logger.warning(f"[SSE] Model quota/403 for session {conversation_id}: {e}")
        error_payload = {
            "content": "模型余额不足，请充值",
            "error_type": type(e).__name__,
            "error_details": str(e),
        }
        error_event = SSEEvent(type="error", data=error_payload)
        yield error_event.to_sse_format()
    except Exception as e:
        logger.exception(f"[SSE] Error in stream for session {conversation_id}: {e}")
        error_msg = str(e)
        if "proxy" in error_msg.lower() or "connection refused" in error_msg.lower():
            logger.warning(f"[SSE] Proxy connection error detected: {error_msg}")
            error_payload = {
                "content": "网络连接失败：请检查代理配置或网络连接",
                "error_type": type(e).__name__,
                "error_details": "代理连接失败可能导致 Agent 初始化失败",
            }
        elif (
            "403" in error_msg
            or "free tier" in error_msg.lower()
            or "FreeTierOnly" in error_msg
        ):
            error_payload = {
                "content": "余额不足，请充值",
                "error_type": type(e).__name__,
                "error_details": error_msg,
            }
        else:
            error_payload = {"content": error_msg, "error_type": type(e).__name__}
        error_event = SSEEvent(type="error", data=error_payload)
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

    # 🔍 诊断日志：检查 resume_data 元数据
    if request.resume_data:
        rd = request.resume_data
        resume_id = (
            rd.get("resume_id")
            or rd.get("id")
            or (rd.get("_meta") or {}).get("resume_id")
        )
        user_id = rd.get("user_id") or (rd.get("_meta") or {}).get("user_id")
        logger.info(
            f"[SSE] resume_data metadata: resume_id={resume_id}, user_id={user_id}"
        )
    else:
        logger.warning("[SSE] No resume_data provided in request")

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
        },
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
    # Idempotent delete: do not 404 for missing session
    logger.info(f"[SSE] Session not found (already cleared): {conversation_id}")
    return {"status": "not_found", "conversation_id": conversation_id}
