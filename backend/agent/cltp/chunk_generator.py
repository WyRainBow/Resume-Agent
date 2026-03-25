"""
CLTP Chunk Generator
生成标准的 CLTP chunks，适配现有的 SSE 流

关键保护：
- 确保生成的 chunks 中文本内容格式正确
- content(channel='plain') payload 中的文本可以直接用于 Markdown 渲染
- 保持文本内容原样，不进行任何修改
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Literal

from backend.agent.cltp.types import SpanCLChunk, ContentCLChunk, HeartbeatChunk, CLChunk, SpanName
from backend.agent.cltp.session_state import (
    get_or_create_session,
    SessionState,
    save_session_state,
)


def generate_id() -> str:
    """生成唯一的 ID"""
    return str(uuid.uuid4())


def get_timestamp() -> str:
    """获取当前时间戳（ISO 格式）"""
    return datetime.now(timezone.utc).isoformat()


class CLTPChunkGenerator:
    """
    CLTP Chunk 生成器

    管理会话状态（内存中，无需 Redis）
    生成符合 CLTP 规范的 chunks
    """

    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self._state = get_or_create_session(conversation_id)
        # 跟踪每个 channel 的 message ID
        self._message_ids: Dict[str, str] = {}

    def emit_span_start(
        self,
        name: SpanName,
        parent_span_id: Optional[str] = None
    ) -> SpanCLChunk:
        """
        发送 span:start chunk

        Args:
            name: Span 名称（run, plan, procedure, task, step 等）
            parent_span_id: 父 span ID（可选）

        Returns:
            SpanCLChunk
        """
        span_id = generate_id()
        chunk_id = generate_id()

        # 更新状态
        self._state.span_stack.append(span_id)
        if name == 'run':
            self._state.current_run_span_id = span_id
        save_session_state(self._state)

        chunk = SpanCLChunk(
            type='span',
            status='start',
            id=chunk_id,
            parentCLSpanId=parent_span_id,
            clmessageId=chunk_id,
            clspanId=span_id,
            sequence=0,
            timestamp=get_timestamp(),
            metadata={
                'name': name,
            },
        )

        return chunk

    def emit_span_end(
        self,
        name: SpanName,
        outcome: Optional[Literal['error']] = None,
        error: Optional[Dict[str, Any]] = None
    ) -> SpanCLChunk:
        """
        发送 span:end chunk

        Args:
            name: Span 名称
            outcome: 结果（可选，'error' 表示错误）
            error: 错误信息（可选）

        Returns:
            SpanCLChunk
        """
        if not self._state.span_stack:
            raise ValueError("Cannot end span: no open spans")

        span_id = self._state.span_stack.pop()
        chunk_id = generate_id()

        # 如果是 run span，清理状态
        if name == 'run' and self._state.current_run_span_id == span_id:
            self._state.current_run_span_id = None
            self._message_ids.clear()
        save_session_state(self._state)

        metadata: Dict[str, Any] = {'name': name}
        if outcome:
            metadata['outcome'] = outcome
        if error:
            metadata['error'] = error

        chunk = SpanCLChunk(
            type='span',
            status='end',
            id=chunk_id,
            parentCLSpanId=None,  # end chunk 不需要 parent
            clmessageId=chunk_id,
            clspanId=span_id,
            sequence=0,
            timestamp=get_timestamp(),
            metadata=metadata,
        )

        return chunk

    def emit_content(
        self,
        channel: str,
        payload: Dict[str, Any],
        done: bool = False
    ) -> ContentCLChunk:
        """
        发送 content chunk

        关键：payload 中的文本内容必须保持原样，不进行任何修改

        Args:
            channel: 频道名称（'plain', 'think', 'output' 等）
            payload: 载荷数据（必须包含 text 字段用于 plain/think 频道）
            done: 是否完成

        Returns:
            ContentCLChunk
        """
        # 获取或创建 message ID（同一个 channel 在同一个 run 内使用相同的 messageId）
        message_id = self._get_or_create_message_id(channel)

        # 获取下一个 sequence 号
        sequence = self._get_next_sequence(channel)

        # 获取当前父 span（栈顶）
        parent_span_id = (
            self._state.span_stack[-1] if self._state.span_stack
            else self._state.current_run_span_id
        )

        chunk = ContentCLChunk(
            type='content',
            id=generate_id(),
            parentCLSpanId=parent_span_id,
            clmessageId=message_id,
            sequence=sequence,
            timestamp=get_timestamp(),
            metadata={
                'channel': channel,
                'payload': payload,  # 关键：保持原样，不进行任何修改
                'done': done,
            },
        )
        save_session_state(self._state)

        return chunk

    def emit_heartbeat(self) -> HeartbeatChunk:
        """
        发送 heartbeat chunk

        Returns:
            HeartbeatChunk
        """
        return HeartbeatChunk(
            type='heartbeat',
            id=generate_id(),
            timestamp=get_timestamp(),
        )

    def _get_or_create_message_id(self, channel: str) -> str:
        """获取或创建 message ID（同一个 channel 在同一个 run 内使用相同的 messageId）"""
        key = f"{channel}-{self._state.current_run_span_id or 'default'}"
        if key not in self._message_ids:
            self._message_ids[key] = generate_id()
            # 初始化 sequence
            self._state.message_sequence[channel] = 0
            save_session_state(self._state)
        return self._message_ids[key]

    def _get_next_sequence(self, channel: str) -> int:
        """获取下一个 sequence 号"""
        current = self._state.message_sequence.get(channel, 0)
        self._state.message_sequence[channel] = current + 1
        save_session_state(self._state)
        return current

    def get_current_run_span_id(self) -> Optional[str]:
        """获取当前 run span ID"""
        return self._state.current_run_span_id
