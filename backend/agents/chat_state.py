"""
ChatState - 对话状态管理

管理多轮对话的状态，包括：
- 对话历史
- 待补充的数据（pending_data）
- 当前任务上下文
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time


class IntentType(str, Enum):
    """意图类型"""
    ADD = "add"
    UPDATE = "update"
    DELETE = "delete"
    READ = "read"
    UNKNOWN = "unknown"


@dataclass
class Message:
    """对话消息"""
    role: str  # "user" | "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "metadata": self.metadata
        }


@dataclass
class PendingData:
    """待补充的数据"""
    module: str = ""  # 当前操作模块：workExperience, education, basic, skills, projects
    intent: IntentType = IntentType.UNKNOWN
    data: Dict[str, Any] = field(default_factory=dict)  # 已收集的数据
    missing_fields: List[str] = field(default_factory=list)  # 缺失的字段
    created_at: float = field(default_factory=time.time)
    
    def is_empty(self) -> bool:
        """检查是否为空"""
        return not self.module or not self.data
    
    def has_missing_fields(self) -> bool:
        """检查是否有缺失字段"""
        return len(self.missing_fields) > 0
    
    def merge(self, new_data: Dict[str, Any]) -> None:
        """合并新数据（非空值覆盖）"""
        for key, value in new_data.items():
            if value:  # 只合并非空值
                self.data[key] = value
    
    def update_missing_fields(self, required_fields: List[str]) -> None:
        """更新缺失字段列表"""
        self.missing_fields = [
            f for f in required_fields 
            if not self.data.get(f)
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "module": self.module,
            "intent": self.intent.value,
            "data": self.data,
            "missing_fields": self.missing_fields,
            "created_at": self.created_at
        }
    
    def clear(self) -> None:
        """清空数据"""
        self.module = ""
        self.intent = IntentType.UNKNOWN
        self.data = {}
        self.missing_fields = []


class ChatState:
    """
    对话状态管理器
    
    功能：
    1. 管理对话历史（滑动窗口）
    2. 管理待补充数据（pending_data）
    3. 提供状态查询和更新方法
    """
    
    # 最大历史记录数
    MAX_HISTORY_SIZE = 20
    
    # 模块必填字段定义
    REQUIRED_FIELDS = {
        "workExperience": ["company", "position", "startDate", "endDate"],
        "education": ["school", "major", "degree", "startDate", "endDate"],
        "basic": ["name"],
        "skills": ["name"],
        "projects": ["name", "description"]
    }
    
    def __init__(self):
        self.history: List[Message] = []
        self.pending: PendingData = PendingData()
        self.is_waiting_for_supplement: bool = False
        self.created_at: float = time.time()
        self.last_active: float = time.time()
    
    def add_message(self, role: str, content: str, metadata: Dict[str, Any] = None) -> Message:
        """添加消息到历史"""
        msg = Message(
            role=role,
            content=content,
            metadata=metadata or {}
        )
        self.history.append(msg)
        self.last_active = time.time()
        
        # 滑动窗口
        if len(self.history) > self.MAX_HISTORY_SIZE:
            self.history = self.history[-self.MAX_HISTORY_SIZE:]
        
        return msg
    
    def get_recent_history(self, n: int = 10) -> List[Message]:
        """获取最近 n 条历史"""
        return self.history[-n:] if len(self.history) > n else self.history
    
    def get_history_for_llm(self, n: int = 10) -> List[Dict[str, str]]:
        """获取适合 LLM 的历史格式"""
        return [
            {"role": msg.role, "content": msg.content}
            for msg in self.get_recent_history(n)
        ]
    
    def start_pending_task(self, module: str, intent: IntentType, initial_data: Dict[str, Any] = None) -> None:
        """开始一个待补充任务"""
        self.pending = PendingData(
            module=module,
            intent=intent,
            data=initial_data or {}
        )
        # 更新缺失字段
        required = self.REQUIRED_FIELDS.get(module, [])
        self.pending.update_missing_fields(required)
        self.is_waiting_for_supplement = self.pending.has_missing_fields()
    
    def update_pending_data(self, new_data: Dict[str, Any]) -> None:
        """更新待补充数据"""
        if self.pending.is_empty():
            return
        
        self.pending.merge(new_data)
        # 重新计算缺失字段
        required = self.REQUIRED_FIELDS.get(self.pending.module, [])
        self.pending.update_missing_fields(required)
        self.is_waiting_for_supplement = self.pending.has_missing_fields()
        self.last_active = time.time()
    
    def complete_pending_task(self) -> Dict[str, Any]:
        """完成待补充任务，返回完整数据"""
        result = {
            "module": self.pending.module,
            "intent": self.pending.intent,
            "data": self.pending.data.copy()
        }
        self.clear_pending()
        return result
    
    def clear_pending(self) -> None:
        """清空待补充数据"""
        self.pending.clear()
        self.is_waiting_for_supplement = False
    
    def has_pending_task(self) -> bool:
        """是否有待补充任务"""
        return not self.pending.is_empty()
    
    def get_pending_module(self) -> str:
        """获取当前待补充模块"""
        return self.pending.module
    
    def get_pending_intent(self) -> IntentType:
        """获取当前待补充意图"""
        return self.pending.intent
    
    def get_missing_fields(self) -> List[str]:
        """获取缺失字段"""
        return self.pending.missing_fields
    
    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "history": [msg.to_dict() for msg in self.history],
            "pending": self.pending.to_dict(),
            "is_waiting_for_supplement": self.is_waiting_for_supplement,
            "created_at": self.created_at,
            "last_active": self.last_active
        }
    
    def __repr__(self) -> str:
        return f"ChatState(history={len(self.history)}, pending={self.pending.module}, waiting={self.is_waiting_for_supplement})"

