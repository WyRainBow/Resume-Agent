"""
CLTP 类型定义
"""

from typing import Literal, Optional, Any, Dict
from dataclasses import dataclass
from datetime import datetime

# Span 名称类型
SpanName = Literal[
    'run', 'plan', 'procedure', 'task', 'step',
    'plain', 'think', 'hitl', 'tool_calling', 'output', 'user'
]


@dataclass
class SpanCLChunk:
    """Span CLTP Chunk"""
    type: Literal['span']
    status: Literal['start', 'end']
    id: str
    parentCLSpanId: Optional[str]
    clmessageId: str
    clspanId: str
    sequence: Literal[0]
    timestamp: str
    metadata: Dict[str, Any]


@dataclass
class ContentCLChunk:
    """Content CLTP Chunk"""
    type: Literal['content']
    id: str
    parentCLSpanId: Optional[str]
    clmessageId: str
    sequence: int
    timestamp: str
    metadata: Dict[str, Any]


@dataclass
class HeartbeatChunk:
    """Heartbeat CLTP Chunk"""
    type: Literal['heartbeat']
    id: str
    timestamp: str


CLChunk = SpanCLChunk | ContentCLChunk | HeartbeatChunk
