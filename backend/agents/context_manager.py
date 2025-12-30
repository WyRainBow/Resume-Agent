"""
ContextManager - 上下文管理器

参考架构：sophia-pro/backend/agent/src/amplift/

功能：
1. 对话历史管理（滑动窗口 + Token 限制）
2. 上下文摘要生成
3. 简历数据摘要
4. LLM 上下文构建
"""
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
import time
import re
from collections import deque


class ContextStrategy(str, Enum):
    """上下文策略"""
    SLIDING_WINDOW = "sliding_window"  # 滑动窗口
    TOKEN_LIMIT = "token_limit"        # Token 限制
    SUMMARY = "summary"                 # 摘要策略


@dataclass
class Message:
    """对话消息"""
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    token_count: Optional[int] = None  # 估算的 token 数

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "metadata": self.metadata
        }

    def to_llm_format(self) -> Dict[str, str]:
        """转换为 LLM 格式"""
        return {"role": self.role, "content": self.content}


@dataclass
class ContextWindow:
    """上下文窗口"""
    messages: List[Message] = field(default_factory=list)
    total_tokens: int = 0
    total_chars: int = 0
    summary: str = ""
    summarized_count: int = 0

    def add_message(self, message: Message) -> None:
        """添加消息"""
        self.messages.append(message)
        self.total_chars += len(message.content)
        if message.token_count:
            self.total_tokens += message.token_count
        else:
            # 估算 token：中文约 2 字符/token，英文约 4 字符/token
            self.total_tokens += self._estimate_tokens(message.content)

    def get_messages(self, limit: Optional[int] = None) -> List[Message]:
        """获取消息"""
        if limit:
            return self.messages[-limit:]
        return self.messages

    def _estimate_tokens(self, text: str) -> int:
        """估算 token 数"""
        # 简单估算：中文字符 / 2，英文单词 * 1.3
        chinese_chars = len(re.findall(r'[\u4e00-\u9fa5]', text))
        other_chars = len(text) - chinese_chars
        return (chinese_chars // 2) + (other_chars // 3) + 1


class ContextManager:
    """
    上下文管理器

    功能：
    1. 管理对话历史（滑动窗口）
    2. 应用 token 限制
    3. 生成上下文摘要
    4. 构建完整的 LLM 上下文
    """

    # 配置常量
    DEFAULT_MAX_HISTORY = 20           # 默认最大历史消息数
    DEFAULT_MAX_TOKENS = 8000          # 默认最大 token 数
    DEFAULT_SUMMARY_THRESHOLD = 10     # 摘要阈值
    CHARS_PER_TOKEN = 2                # 中文约 2 字符/token

    def __init__(
        self,
        max_history: int = DEFAULT_MAX_HISTORY,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        summary_threshold: int = DEFAULT_SUMMARY_THRESHOLD,
        strategy: ContextStrategy = ContextStrategy.SLIDING_WINDOW
    ):
        """
        初始化上下文管理器

        Args:
            max_history: 最大历史消息数
            max_tokens: 最大 token 数
            summary_threshold: 触发摘要的消息数阈值
            strategy: 上下文策略
        """
        self.max_history = max_history
        self.max_tokens = max_tokens
        self.summary_threshold = summary_threshold
        self.strategy = strategy

        self.window = ContextWindow()
        self.created_at = time.time()
        self.last_active = time.time()

    def add_message(
        self,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Message:
        """
        添加消息到上下文

        Args:
            role: 消息角色 (user/assistant/system)
            content: 消息内容
            metadata: 元数据

        Returns:
            创建的消息对象
        """
        message = Message(
            role=role,
            content=content,
            metadata=metadata or {}
        )
        self.window.add_message(message)
        self.last_active = time.time()

        # 应用滑动窗口
        if len(self.window.messages) > self.max_history:
            self._apply_sliding_window()

        return message

    def _apply_sliding_window(self) -> None:
        """应用滑动窗口策略"""
        excess = len(self.window.messages) - self.max_history
        if excess > 0:
            # 移除最旧的消息
            removed = self.window.messages[:excess]
            self.window.messages = self.window.messages[excess:]

            # 更新统计
            for msg in removed:
                self.window.total_chars -= len(msg.content)
                if msg.token_count:
                    self.window.total_tokens -= msg.token_count
                else:
                    self.window.total_tokens -= self._estimate_tokens(msg.content)

    def _estimate_tokens(self, text: str) -> int:
        """估算 token 数"""
        chinese_chars = len(re.findall(r'[\u4e00-\u9fa5]', text))
        other_chars = len(text) - chinese_chars
        return (chinese_chars // self.CHARS_PER_TOKEN) + (other_chars // 3) + 1

    def get_history(
        self,
        limit: Optional[int] = None,
        for_llm: bool = False
    ) -> Union[List[Message], List[Dict[str, str]]]:
        """
        获取历史消息

        Args:
            limit: 限制数量
            for_llm: 是否返回 LLM 格式

        Returns:
            历史消息列表
        """
        messages = self.window.get_messages(limit)

        if for_llm:
            return [msg.to_llm_format() for msg in messages]

        return messages

    def get_context_for_llm(
        self,
        current_message: str,
        resume_summary: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        获取完整的 LLM 上下文

        结构：
        1. [可选] 系统提示
        2. [可选] 上下文摘要
        3. 对话历史（应用 token 限制）
        4. 当前用户消息（包含简历摘要）

        Args:
            current_message: 当前用户消息
            resume_summary: 简历摘要
            system_prompt: 系统提示

        Returns:
            LLM 消息列表
        """
        messages = []

        # 1. 添加系统提示
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })

        # 2. 添加上下文摘要（如果有）
        if self.window.summary:
            messages.append({
                "role": "system",
                "content": f"[对话上下文摘要]\n{self.window.summary}"
            })

        # 3. 添加历史消息（应用 token 限制）
        history = self._get_history_within_token_limit()
        messages.extend(history)

        # 4. 添加当前消息
        user_content = current_message
        if resume_summary:
            user_content = f"当前简历数据:\n{resume_summary}\n\n用户消息: {current_message}"

        messages.append({
            "role": "user",
            "content": user_content
        })

        return messages

    def _get_history_within_token_limit(self) -> List[Dict[str, str]]:
        """
        获取在 token 限制内的历史消息

        从最新消息开始，倒序遍历，确保不超出 token 限制
        同时保证消息成对出现（user + assistant）
        """
        if not self.window.messages:
            return []

        result = []
        total_tokens = 0
        max_chars = self.max_tokens * self.CHARS_PER_TOKEN

        # 从最新的消息开始，倒序遍历
        for msg in reversed(self.window.messages):
            content = msg.content
            msg_chars = len(content)

            if total_tokens + msg_chars > max_chars:
                break

            result.insert(0, msg.to_llm_format())
            total_tokens += msg_chars

        return result

    def generate_summary(self) -> str:
        """
        生成上下文摘要

        简单实现：提取关键信息
        高级实现：可调用 LLM 生成摘要
        """
        if len(self.window.messages) == 0:
            return ""

        # 收集用户操作
        user_actions = []
        for msg in self.window.messages:
            if msg.role == "user":
                content = msg.content[:50]  # 截断
                user_actions.append(f"- {content}...")

        summary = f"对话包含 {len(self.window.messages)} 条消息。\n"
        summary += f"用户操作包括:\n" + "\n".join(user_actions[:5])

        if len(user_actions) > 5:
            summary += f"\n... 还有 {len(user_actions) - 5} 条操作"

        return summary

    def set_summary(self, summary: str) -> None:
        """
        设置上下文摘要

        Args:
            summary: 摘要内容
        """
        self.window.summary = summary
        self.window.summarized_count = len(self.window.messages)

    def needs_summarization(self) -> bool:
        """检查是否需要生成摘要"""
        unsummarized = len(self.window.messages) - self.window.summarized_count
        return unsummarized >= self.summary_threshold

    def estimate_tokens(self) -> int:
        """估算当前上下文的 token 数"""
        return self.window.total_tokens

    def estimate_chars(self) -> int:
        """估算当前上下文的字符数"""
        return self.window.total_chars

    def clear(self) -> None:
        """清空上下文"""
        self.window = ContextWindow()
        self.last_active = time.time()

    def trim_to_messages(self, count: int) -> None:
        """
        裁剪到指定数量的消息

        Args:
            count: 保留的消息数量
        """
        if len(self.window.messages) > count:
            removed = self.window.messages[:-count]
            self.window.messages = self.window.messages[-count:]

            # 更新统计
            for msg in removed:
                self.window.total_chars -= len(msg.content)
                if msg.token_count:
                    self.window.total_tokens -= msg.token_count

    def get_conversation_summary(self) -> str:
        """
        获取对话摘要（用户友好的格式）
        """
        if not self.window.messages:
            return "暂无对话历史"

        user_msgs = [m for m in self.window.messages if m.role == "user"]
        assistant_msgs = [m for m in self.window.messages if m.role == "assistant"]

        return (
            f"对话包含 {len(self.window.messages)} 条消息 "
            f"({len(user_msgs)} 条用户消息，{len(assistant_msgs)} 条助手回复)"
        )

    def get_recent_user_messages(self, count: int = 3) -> List[str]:
        """
        获取最近的用户消息

        Args:
            count: 获取数量

        Returns:
            用户消息内容列表
        """
        user_messages = [
            m.content for m in reversed(self.window.messages)
            if m.role == "user"
        ]
        return user_messages[:count]

    def find_last_tool_call(self, tool_name: Optional[str] = None) -> Optional[Message]:
        """
        查找最后一次工具调用

        Args:
            tool_name: 工具名称（可选）

        Returns:
            包含工具调用的消息
        """
        for msg in reversed(self.window.messages):
            if msg.metadata.get("tool_call"):
                tool_call = msg.metadata["tool_call"]
                if tool_name is None or tool_call.get("name") == tool_name:
                    return msg
        return None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "max_history": self.max_history,
            "max_tokens": self.max_tokens,
            "summary_threshold": self.summary_threshold,
            "strategy": self.strategy.value,
            "message_count": len(self.window.messages),
            "total_tokens": self.window.total_tokens,
            "total_chars": self.window.total_chars,
            "has_summary": bool(self.window.summary),
            "summarized_count": self.window.summarized_count,
            "created_at": self.created_at,
            "last_active": self.last_active
        }


def create_context_manager(
    max_history: int = 20,
    max_tokens: int = 8000,
    strategy: ContextStrategy = ContextStrategy.SLIDING_WINDOW
) -> ContextManager:
    """
    创建上下文管理器的便捷函数

    Args:
        max_history: 最大历史消息数
        max_tokens: 最大 token 数
        strategy: 上下文策略

    Returns:
        上下文管理器实例
    """
    return ContextManager(
        max_history=max_history,
        max_tokens=max_tokens,
        strategy=strategy
    )
