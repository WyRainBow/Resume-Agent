"""
CLTP Chunk to SSE 转换工具
将 CLTP chunks 转换为 SSE 格式，保持向后兼容
"""

import json
from typing import Any, Dict
from backend.agent.cltp.types import CLChunk, SpanCLChunk, ContentCLChunk, HeartbeatChunk
from backend.agent.web.schemas.stream import SSEEvent


def chunk_to_sse(chunk: CLChunk) -> str:
    """
    将 CLTP chunk 转换为 SSE 格式字符串

    关键：保持文本内容原样，不进行任何修改

    Args:
        chunk: CLTP chunk

    Returns:
        SSE 格式字符串
    """
    if isinstance(chunk, SpanCLChunk):
        return _span_chunk_to_sse(chunk)
    elif isinstance(chunk, ContentCLChunk):
        return _content_chunk_to_sse(chunk)
    elif isinstance(chunk, HeartbeatChunk):
        return _heartbeat_chunk_to_sse(chunk)
    else:
        raise ValueError(f"Unknown chunk type: {type(chunk)}")


def _span_chunk_to_sse(chunk: SpanCLChunk) -> str:
    """将 Span chunk 转换为 SSE 格式"""
    if chunk.status == 'start' and chunk.metadata.get('name') == 'run':
        # agent_start 事件
        event = SSEEvent(
            type='agent_start',
            data={
                'agent_name': 'Manus',
                'task': '',  # 任务信息在 execute 方法中设置
            }
        )
    elif chunk.status == 'end' and chunk.metadata.get('name') == 'run':
        # agent_end 事件
        event = SSEEvent(
            type='agent_end',
            data={
                'agent_name': 'Manus',
                'success': chunk.metadata.get('outcome') != 'error',
            }
        )
    else:
        # 其他 span 事件（暂时忽略或转换为 system 事件）
        event = SSEEvent(
            type='system',
            data={
                'message': f"Span {chunk.metadata.get('name')} {chunk.status}",
            }
        )

    return event.to_sse_format()


def _content_chunk_to_sse(chunk: ContentCLChunk) -> str:
    """
    将 Content chunk 转换为 SSE 格式

    关键：保持文本内容原样，不进行任何修改
    """
    channel = chunk.metadata.get('channel', '')
    payload = chunk.metadata.get('payload', {})
    done = chunk.metadata.get('done', False)

    # 关键：直接提取文本内容，保持原样
    text = payload.get('text', '') if isinstance(payload, dict) else ''

    if channel == 'think':
        # Thought 事件
        event = SSEEvent(
            type='thought',
            data={
                'content': text,  # 保持原样，不进行任何修改
            }
        )
    elif channel == 'plain':
        # Answer 事件
        event = SSEEvent(
            type='answer',
            data={
                'content': text,  # 保持原样，不进行任何修改
                'is_complete': done,
            }
        )
    else:
        # 其他频道（暂时忽略或转换为 system 事件）
        event = SSEEvent(
            type='system',
            data={
                'message': f"Content in channel {channel}",
                'content': text,
            }
        )

    return event.to_sse_format()


def _heartbeat_chunk_to_sse(chunk: HeartbeatChunk) -> str:
    """将 Heartbeat chunk 转换为 SSE 格式"""
    from backend.agent.web.schemas.stream import HeartbeatEvent
    heartbeat = HeartbeatEvent()
    return heartbeat.to_sse_format()
