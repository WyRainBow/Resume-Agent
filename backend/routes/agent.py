"""
Agent proxy routes.

Forward AI Resume frontend requests to OpenManus Agent SSE stream.
"""
from typing import Any, AsyncGenerator, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/agent", tags=["agent"])

OPENMANUS_URL = "http://localhost:8080"


class AgentStreamRequest(BaseModel):
    """Agent stream request model."""

    message: str = Field(..., description="User message")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    resume_data: Optional[Dict[str, Any]] = Field(
        None, description="Resume data for agent context"
    )


@router.post("/stream")
async def proxy_agent_stream(request: AgentStreamRequest) -> StreamingResponse:
    """Proxy OpenManus SSE stream."""

    async def stream_generator() -> AsyncGenerator[bytes, None]:
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{OPENMANUS_URL}/api/stream",
                    json={
                        "prompt": request.message,
                        "conversation_id": request.conversation_id,
                        "resume_data": request.resume_data,
                        "resume": True,
                    },
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        detail = error_text.decode("utf-8", errors="ignore")
                        raise HTTPException(
                            status_code=502,
                            detail=f"OpenManus stream error: {detail}",
                        )
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )
