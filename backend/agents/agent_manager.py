"""
AgentManager - Agent 管理器

负责：
1. 管理会话生命周期（创建、获取、销毁）
2. 缓存 Agent 实例（同一 session_id 复用同一个 Agent）
3. 处理会话过期清理
"""
import time
import uuid
from typing import Any, Dict, Optional
from dataclasses import dataclass, field

from .cv_agent import CVAgent


@dataclass
class AgentSession:
    """Agent 会话"""
    session_id: str
    agent: CVAgent
    created_at: float = field(default_factory=time.time)
    last_active: float = field(default_factory=time.time)
    
    def touch(self) -> None:
        """更新最后活跃时间"""
        self.last_active = time.time()
    
    def is_expired(self, expire_seconds: int = 3600) -> bool:
        """检查是否过期"""
        return time.time() - self.last_active > expire_seconds


class AgentManager:
    """
    Agent 管理器
    
    功能：
    1. 创建和管理 Agent 会话
    2. 支持会话复用（多轮对话）
    3. 自动清理过期会话
    """
    
    # 会话过期时间（秒）
    SESSION_EXPIRE_TIME = 3600  # 1 小时
    
    # 最大会话数
    MAX_SESSIONS = 100
    
    _instance = None
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._sessions: Dict[str, AgentSession] = {}
        return cls._instance
    
    def _generate_session_id(self) -> str:
        """生成会话 ID"""
        return f"sess_{uuid.uuid4().hex[:16]}"
    
    def get_or_create(
        self,
        session_id: Optional[str] = None,
        resume_data: Optional[Dict[str, Any]] = None,
        capability: Optional[str] = None  # 新增：Capability 支持
    ) -> tuple[str, CVAgent]:
        """
        获取或创建 Agent

        Args:
            session_id: 会话 ID（可选）
            resume_data: 简历数据
            capability: 能力包名称（base|advanced|optimizer）

        Returns:
            (session_id, agent)
        """
        # 清理过期会话
        self._cleanup_expired()

        # 如果有 session_id，尝试获取已有会话
        if session_id and session_id in self._sessions:
            session = self._sessions[session_id]
            session.touch()

            # 如果传入了新的 capability，动态更新
            if capability:
                session.agent.set_capability(capability)

            # ⚠️ 重要：在多轮对话中，信任 Agent 自己维护的数据
            # 不要用前端传递的旧数据覆盖 Agent 中已更新的数据
            # 这解决了"更新后再操作，数据被覆盖"的 Bug
            #
            # 前端传递的 resume_data 只在**创建新会话时**使用
            # 已有会话中，Agent 通过工具调用自己维护数据

            return session_id, session.agent

        # 创建新会话
        new_session_id = session_id or self._generate_session_id()
        agent = CVAgent(
            resume_data=resume_data or {},
            session_id=new_session_id,
            enable_llm=True,  # 启用 LLM 兜底
            debug=False,
            capability=capability  # 传递 Capability
        )

        # 存储会话
        self._sessions[new_session_id] = AgentSession(
            session_id=new_session_id,
            agent=agent
        )

        return new_session_id, agent
    
    def get(self, session_id: str) -> Optional[CVAgent]:
        """获取 Agent"""
        session = self._sessions.get(session_id)
        if session:
            session.touch()
            return session.agent
        return None
    
    def has(self, session_id: str) -> bool:
        """检查会话是否存在"""
        return session_id in self._sessions
    
    def remove(self, session_id: str) -> bool:
        """移除会话"""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
    
    def clear_all(self) -> int:
        """清空所有会话"""
        count = len(self._sessions)
        self._sessions.clear()
        return count
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话信息"""
        session = self._sessions.get(session_id)
        if session:
            return {
                "session_id": session.session_id,
                "created_at": session.created_at,
                "last_active": session.last_active,
                "agent_state": session.agent.get_state_summary()
            }
        return None
    
    def list_sessions(self) -> list:
        """列出所有会话"""
        return [
            {
                "session_id": s.session_id,
                "created_at": s.created_at,
                "last_active": s.last_active
            }
            for s in self._sessions.values()
        ]
    
    def _cleanup_expired(self) -> int:
        """清理过期会话"""
        expired = [
            sid for sid, session in self._sessions.items()
            if session.is_expired(self.SESSION_EXPIRE_TIME)
        ]
        
        for sid in expired:
            del self._sessions[sid]
        
        # 如果会话数超过限制，清理最老的
        if len(self._sessions) > self.MAX_SESSIONS:
            sorted_sessions = sorted(
                self._sessions.items(),
                key=lambda x: x[1].last_active
            )
            to_remove = len(self._sessions) - self.MAX_SESSIONS
            for sid, _ in sorted_sessions[:to_remove]:
                del self._sessions[sid]
                expired.append(sid)
        
        return len(expired)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "total_sessions": len(self._sessions),
            "max_sessions": self.MAX_SESSIONS,
            "expire_time_seconds": self.SESSION_EXPIRE_TIME
        }


# 全局实例
agent_manager = AgentManager()

