"""
Agent 全局状态管理

参考：sophia-pro/backend/agent/src/amplift/agent_state.py

提供一个状态容器，在 Agent 运行期间共享信息。
简化版：不需要线程安全（单线程处理）

优化：
- 滑动窗口限制历史消息数量
- Token 估算避免超出上下文窗口
- 上下文摘要支持长对话
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
import time


@dataclass
class PendingTask:
    """待补充任务"""
    module: str                          # 操作模块（workExperience, education 等）
    intent: str                          # 意图类型（add, update, delete）
    collected_data: Dict[str, Any]       # 已收集的数据
    missing_fields: list                 # 缺失的字段
    created_at: float = field(default_factory=time.time)


class AgentState:
    """Agent 状态容器
    
    用于在 Agent 处理过程中共享数据：
    - 简历数据
    - 对话历史（滑动窗口 + Token 限制）
    - 待补充任务
    - 自定义状态
    - 上下文摘要
    
    使用示例:
        state = AgentState()
        state.set("user_id", "123")
        state.resume_data = {"basic": {"name": "张三"}}
    """
    
    # ==================== 配置常量 ====================
    # 参考 sophia-pro：加大上下文窗口，由 LLM 兜底处理复杂场景
    MAX_HISTORY_SIZE = 50           # 最大历史消息数（增大支持更长对话）
    MAX_HISTORY_TOKENS = 8000       # 历史消息最大 token 数（估算）
    CHARS_PER_TOKEN = 2             # 中文约 2 字符/token
    SUMMARY_THRESHOLD = 20          # 超过此数量时生成摘要
    
    def __init__(
        self, 
        resume_data: Optional[Dict[str, Any]] = None,
        session_id: str = ""
    ):
        """
        初始化 AgentState
        
        Args:
            resume_data: 初始简历数据
            session_id: 会话 ID
        """
        self.session_id = session_id
        self.resume_data = resume_data.copy() if resume_data else {}
        self.chat_history: list = []
        self.pending_task: Optional[PendingTask] = None
        self._custom_data: Dict[str, Any] = {}
        self.created_at = time.time()
        self.last_active = time.time()
        
        # 上下文摘要（用于长对话）
        self._context_summary: str = ""
        self._summarized_count: int = 0  # 已摘要的消息数
    
    # ==================== 自定义状态管理 ====================
    
    def set(self, key: str, value: Any) -> None:
        """设置自定义状态值"""
        self._custom_data[key] = value
        self.last_active = time.time()
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取自定义状态值"""
        return self._custom_data.get(key, default)
    
    def has(self, key: str) -> bool:
        """检查状态键是否存在"""
        return key in self._custom_data
    
    def delete(self, key: str) -> bool:
        """删除状态键"""
        if key in self._custom_data:
            del self._custom_data[key]
            return True
        return False
    
    # ==================== 对话历史管理 ====================
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None) -> None:
        """添加对话消息（自动应用滑动窗口）"""
        self.chat_history.append({
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time()
        })
        self.last_active = time.time()
        
        # 滑动窗口：超过最大数量时，截断旧消息
        if len(self.chat_history) > self.MAX_HISTORY_SIZE:
            # 保留最近的消息
            self.chat_history = self.chat_history[-self.MAX_HISTORY_SIZE:]
    
    def get_history(self, limit: int = 10) -> list:
        """获取最近的对话历史"""
        return self.chat_history[-limit:] if limit > 0 else self.chat_history
    
    def get_history_for_llm(self, max_tokens: int = None) -> List[Dict[str, str]]:
        """
        获取适合 LLM 的对话历史
        
        特性：
        1. 只返回 role 和 content（LLM 需要的格式）
        2. 应用 token 限制（避免超出上下文窗口）
        3. 保证消息成对出现（user + assistant）
        
        Args:
            max_tokens: 最大 token 数，默认使用 MAX_HISTORY_TOKENS
            
        Returns:
            适合 LLM 的消息列表
        """
        if not self.chat_history:
            return []
        
        max_tokens = max_tokens or self.MAX_HISTORY_TOKENS
        max_chars = max_tokens * self.CHARS_PER_TOKEN
        
        result = []
        total_chars = 0
        
        # 从最新的消息开始，倒序遍历
        for msg in reversed(self.chat_history):
            content = msg.get("content", "")
            msg_chars = len(content)
            
            if total_chars + msg_chars > max_chars:
                break
            
            result.insert(0, {
                "role": msg["role"],
                "content": content
            })
            total_chars += msg_chars
        
        return result
    
    def get_context_for_llm(self, current_message: str, resume_summary: str = "") -> List[Dict[str, str]]:
        """
        获取完整的 LLM 上下文（包含摘要 + 历史 + 当前消息）
        
        结构：
        1. [可选] 上下文摘要（如果有）
        2. 最近的对话历史
        3. 当前用户消息 + 简历摘要
        
        Args:
            current_message: 当前用户消息
            resume_summary: 简历摘要
            
        Returns:
            完整的 LLM 消息列表（不含 system prompt）
        """
        messages = []
        
        # 1. 添加上下文摘要（如果有）
        if self._context_summary:
            messages.append({
                "role": "system",
                "content": f"[对话上下文摘要]\n{self._context_summary}"
            })
        
        # 2. 添加历史消息（应用 token 限制）
        history = self.get_history_for_llm()
        messages.extend(history)
        
        # 3. 添加当前消息（包含简历摘要）
        user_content = current_message
        if resume_summary:
            user_content = f"当前简历: {resume_summary}\n\n用户: {current_message}"
        
        messages.append({
            "role": "user",
            "content": user_content
        })
        
        return messages
    
    def update_context_summary(self, summary: str) -> None:
        """
        更新上下文摘要
        
        用于长对话时，将早期对话摘要为简短描述
        
        Args:
            summary: 摘要内容
        """
        self._context_summary = summary
        self._summarized_count = len(self.chat_history)
    
    def get_context_summary(self) -> str:
        """获取当前上下文摘要"""
        return self._context_summary
    
    def needs_summarization(self) -> bool:
        """检查是否需要生成摘要"""
        unsummarized = len(self.chat_history) - self._summarized_count
        return unsummarized >= self.SUMMARY_THRESHOLD
    
    def estimate_tokens(self) -> int:
        """估算当前历史消息的 token 数"""
        total_chars = sum(len(msg.get("content", "")) for msg in self.chat_history)
        return total_chars // self.CHARS_PER_TOKEN
    
    def clear_history(self) -> None:
        """清空对话历史"""
        self.chat_history = []
        self._context_summary = ""
        self._summarized_count = 0
    
    # ==================== 待补充任务管理 ====================
    
    def start_pending_task(
        self, 
        module: str, 
        intent: str, 
        collected_data: Dict[str, Any],
        missing_fields: list
    ) -> None:
        """开始一个待补充任务"""
        self.pending_task = PendingTask(
            module=module,
            intent=intent,
            collected_data=collected_data,
            missing_fields=missing_fields
        )
        self.last_active = time.time()
    
    def has_pending_task(self) -> bool:
        """是否有待补充任务"""
        return self.pending_task is not None
    
    def get_pending_task(self) -> Optional[PendingTask]:
        """获取待补充任务"""
        return self.pending_task
    
    def update_pending_task(self, new_data: Dict[str, Any], new_missing: list) -> None:
        """更新待补充任务"""
        if self.pending_task:
            self.pending_task.collected_data.update(new_data)
            self.pending_task.missing_fields = new_missing
            self.last_active = time.time()
    
    def clear_pending_task(self) -> None:
        """清空待补充任务"""
        self.pending_task = None
        self.last_active = time.time()
    
    # ==================== 简历数据管理 ====================
    
    def update_resume(self, new_data: Dict[str, Any]) -> None:
        """更新简历数据"""
        self.resume_data = new_data
        self.last_active = time.time()
    
    def get_resume(self) -> Dict[str, Any]:
        """获取简历数据"""
        return self.resume_data
    
    # ==================== 序列化 ====================
    
    def to_dict(self) -> Dict[str, Any]:
        """导出状态"""
        return {
            "session_id": self.session_id,
            "resume_data": self.resume_data,
            "chat_history": self.chat_history,
            "pending_task": {
                "module": self.pending_task.module,
                "intent": self.pending_task.intent,
                "collected_data": self.pending_task.collected_data,
                "missing_fields": self.pending_task.missing_fields,
            } if self.pending_task else None,
            "custom_data": self._custom_data,
            "created_at": self.created_at,
            "last_active": self.last_active,
        }
    
    def __repr__(self) -> str:
        return f"AgentState(session={self.session_id}, history={len(self.chat_history)}, pending={self.has_pending_task()})"

