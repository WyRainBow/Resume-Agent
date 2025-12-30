"""
会话管理系统 (Session Manager)

基于参考架构设计，实现：
1. 会话 ID 管理
2. 会话状态持久化
3. 对话历史管理
4. 会话生命周期控制
"""
import uuid
import json
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum


class SessionStatus(str, Enum):
    """会话状态枚举"""
    ACTIVE = "active"          # 活跃
    PAUSED = "paused"          # 暂停
    COMPLETED = "completed"    # 完成
    EXPIRED = "expired"        # 过期


@dataclass
class ChatMessage:
    """对话消息"""
    role: str                  # 'user' | 'assistant' | 'system'
    content: str               # 消息内容
    timestamp: float           # 时间戳
    tool_call: Optional[Dict[str, Any]] = None    # 工具调用（可选）
    tool_result: Optional[Dict[str, Any]] = None  # 工具结果（可选）
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "tool_call": self.tool_call,
            "tool_result": self.tool_result
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChatMessage':
        return cls(
            role=data["role"],
            content=data["content"],
            timestamp=data.get("timestamp", time.time()),
            tool_call=data.get("tool_call"),
            tool_result=data.get("tool_result")
        )


@dataclass
class TaskState:
    """任务状态"""
    current_task: Optional[str] = None            # 当前任务
    sub_tasks: List[str] = field(default_factory=list)  # 子任务队列
    completed_tasks: List[str] = field(default_factory=list)  # 已完成任务
    paused_tasks: List[Dict[str, Any]] = field(default_factory=list)  # 暂停的任务
    temp_data: Dict[str, Any] = field(default_factory=dict)  # 临时数据
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TaskState':
        return cls(
            current_task=data.get("current_task"),
            sub_tasks=data.get("sub_tasks", []),
            completed_tasks=data.get("completed_tasks", []),
            paused_tasks=data.get("paused_tasks", []),
            temp_data=data.get("temp_data", {})
        )


@dataclass
class Session:
    """
    会话对象
    
    包含：
    - 会话标识
    - 对话历史
    - 任务状态
    - 简历关联
    - 时间戳
    """
    session_id: str                                      # 会话唯一标识
    user_id: Optional[str] = None                        # 用户 ID（可选）
    resume_id: Optional[str] = None                      # 关联的简历 ID
    status: SessionStatus = SessionStatus.ACTIVE         # 会话状态
    chat_history: List[ChatMessage] = field(default_factory=list)  # 对话历史
    task_state: TaskState = field(default_factory=TaskState)       # 任务状态
    resume_snapshot: Optional[Dict[str, Any]] = None     # 简历快照
    created_at: float = field(default_factory=time.time)           # 创建时间
    updated_at: float = field(default_factory=time.time)           # 更新时间
    metadata: Dict[str, Any] = field(default_factory=dict)         # 元数据
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "resume_id": self.resume_id,
            "status": self.status.value,
            "chat_history": [msg.to_dict() for msg in self.chat_history],
            "task_state": self.task_state.to_dict(),
            "resume_snapshot": self.resume_snapshot,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Session':
        return cls(
            session_id=data["session_id"],
            user_id=data.get("user_id"),
            resume_id=data.get("resume_id"),
            status=SessionStatus(data.get("status", "active")),
            chat_history=[ChatMessage.from_dict(msg) for msg in data.get("chat_history", [])],
            task_state=TaskState.from_dict(data.get("task_state", {})),
            resume_snapshot=data.get("resume_snapshot"),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            metadata=data.get("metadata", {})
        )
    
    def add_message(self, role: str, content: str, 
                    tool_call: Optional[Dict] = None,
                    tool_result: Optional[Dict] = None) -> ChatMessage:
        """添加消息到对话历史"""
        message = ChatMessage(
            role=role,
            content=content,
            timestamp=time.time(),
            tool_call=tool_call,
            tool_result=tool_result
        )
        self.chat_history.append(message)
        self.updated_at = time.time()
        return message
    
    def get_recent_history(self, n: int = 10) -> List[ChatMessage]:
        """获取最近 n 轮对话（滑动窗口）"""
        return self.chat_history[-n:] if len(self.chat_history) > n else self.chat_history
    
    def get_context_window(self, max_tokens: int = 4000) -> List[ChatMessage]:
        """
        获取上下文窗口内的对话历史
        使用简单的字符估计（每个 token 约 4 个字符）
        """
        result = []
        total_chars = 0
        max_chars = max_tokens * 4
        
        for msg in reversed(self.chat_history):
            msg_chars = len(msg.content) + len(str(msg.tool_call or "")) + len(str(msg.tool_result or ""))
            if total_chars + msg_chars > max_chars:
                break
            result.insert(0, msg)
            total_chars += msg_chars
        
        return result


class SessionManager:
    """
    会话管理器
    
    功能：
    1. 创建、获取、更新会话
    2. 管理会话生命周期
    3. 处理会话持久化（内存存储，可扩展为数据库）
    """
    
    # 会话过期时间（秒）
    SESSION_EXPIRE_TIME = 24 * 60 * 60  # 24 小时
    
    # 最大会话数
    MAX_SESSIONS = 1000
    
    def __init__(self):
        # 内存存储（生产环境应使用数据库）
        self._sessions: Dict[str, Session] = {}
        # 用户 -> 会话映射
        self._user_sessions: Dict[str, List[str]] = {}
    
    def create_session(self, 
                       user_id: Optional[str] = None,
                       resume_id: Optional[str] = None,
                       resume_data: Optional[Dict[str, Any]] = None) -> Session:
        """
        创建新会话
        
        Args:
            user_id: 用户 ID（可选）
            resume_id: 简历 ID（可选）
            resume_data: 简历数据快照（可选）
        
        Returns:
            新创建的会话对象
        """
        # 清理过期会话
        self._cleanup_expired_sessions()
        
        # 生成唯一会话 ID
        session_id = f"sess_{uuid.uuid4().hex[:16]}"
        
        # 创建会话
        session = Session(
            session_id=session_id,
            user_id=user_id,
            resume_id=resume_id,
            resume_snapshot=resume_data
        )
        
        # 存储会话
        self._sessions[session_id] = session
        
        # 更新用户映射
        if user_id:
            if user_id not in self._user_sessions:
                self._user_sessions[user_id] = []
            self._user_sessions[user_id].append(session_id)
        
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """
        获取会话
        
        Args:
            session_id: 会话 ID
        
        Returns:
            会话对象，不存在或已过期返回 None
        """
        session = self._sessions.get(session_id)
        
        if session is None:
            return None
        
        # 检查是否过期
        if self._is_expired(session):
            session.status = SessionStatus.EXPIRED
            return None
        
        return session
    
    def update_session(self, session: Session) -> bool:
        """
        更新会话
        
        Args:
            session: 会话对象
        
        Returns:
            是否更新成功
        """
        if session.session_id not in self._sessions:
            return False
        
        session.updated_at = time.time()
        self._sessions[session.session_id] = session
        return True
    
    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        if session_id not in self._sessions:
            return False
        
        session = self._sessions[session_id]
        
        # 从用户映射中移除
        if session.user_id and session.user_id in self._user_sessions:
            self._user_sessions[session.user_id] = [
                sid for sid in self._user_sessions[session.user_id] 
                if sid != session_id
            ]
        
        del self._sessions[session_id]
        return True
    
    def get_user_sessions(self, user_id: str) -> List[Session]:
        """获取用户的所有会话"""
        session_ids = self._user_sessions.get(user_id, [])
        sessions = []
        for sid in session_ids:
            session = self.get_session(sid)
            if session:
                sessions.append(session)
        return sessions
    
    def get_or_create_session(self, 
                              session_id: Optional[str] = None,
                              user_id: Optional[str] = None,
                              resume_id: Optional[str] = None,
                              resume_data: Optional[Dict[str, Any]] = None) -> Session:
        """
        获取或创建会话
        
        如果提供了 session_id 且会话存在，返回现有会话
        否则创建新会话
        """
        if session_id:
            session = self.get_session(session_id)
            if session:
                # 更新简历数据（如果提供）
                if resume_data:
                    session.resume_snapshot = resume_data
                    session.updated_at = time.time()
                return session
        
        return self.create_session(user_id, resume_id, resume_data)
    
    def _is_expired(self, session: Session) -> bool:
        """检查会话是否过期"""
        return time.time() - session.updated_at > self.SESSION_EXPIRE_TIME
    
    def _cleanup_expired_sessions(self) -> int:
        """清理过期会话"""
        expired = [
            sid for sid, session in self._sessions.items()
            if self._is_expired(session)
        ]
        
        for sid in expired:
            self.delete_session(sid)
        
        # 如果会话数仍然过多，删除最旧的
        if len(self._sessions) > self.MAX_SESSIONS:
            sessions_by_time = sorted(
                self._sessions.items(),
                key=lambda x: x[1].updated_at
            )
            excess = len(self._sessions) - self.MAX_SESSIONS
            for sid, _ in sessions_by_time[:excess]:
                self.delete_session(sid)
        
        return len(expired)
    
    def get_session_summary(self, session: Session) -> Dict[str, Any]:
        """
        获取会话摘要（用于传递给 LLM）
        
        包含：
        - 最近的对话历史
        - 当前任务状态
        - 简历状态摘要
        """
        return {
            "session_id": session.session_id,
            "status": session.status.value,
            "recent_messages": len(session.chat_history),
            "current_task": session.task_state.current_task,
            "completed_tasks": session.task_state.completed_tasks,
            "has_resume": session.resume_snapshot is not None
        }


# 全局会话管理器实例
session_manager = SessionManager()


def get_session_manager() -> SessionManager:
    """获取会话管理器实例"""
    return session_manager

