"""
聊天消息模板系统

支持构建多消息（system/user/assistant）的提示词模板。
"""

from typing import Any, Union

from backend.agent.prompt.base import PromptTemplate
from backend.agent.schema import Message, Role


class ChatMessageTemplate:
    """单条聊天消息模板

    示例：
        msg = ChatMessageTemplate("user", "Hello, {name}!")
        msg.format(name="Alice")
        # => Message(role="user", content="Hello, Alice!")
    """

    def __init__(self, role: str | Role, template: Union[str, PromptTemplate]):
        """初始化聊天消息模板

        Args:
            role: 消息角色 ("system", "user", "assistant") 或 Role 枚举
            template: 消息内容模板（字符串或 PromptTemplate）
        """
        if isinstance(role, Role):
            self.role = role.value
        else:
            self.role = role

        if isinstance(template, PromptTemplate):
            self.template = template
        else:
            self.template = PromptTemplate(template)

    def format(self, **kwargs: Any) -> Message:
        """格式化为 Message 对象

        Args:
            **kwargs: 变量值

        Returns:
            Message 实例
        """
        content = self.template.format(**kwargs)

        if self.role == "system":
            return Message.system_message(content)
        elif self.role == "user":
            return Message.user_message(content)
        else:  # assistant
            return Message.assistant_message(content)

    def partial(self, **kwargs: Any) -> "ChatMessageTemplate":
        """预填充变量

        Args:
            **kwargs: 要预填充的变量

        Returns:
            新的 ChatMessageTemplate 实例
        """
        return ChatMessageTemplate(
            role=self.role,
            template=self.template.partial(**kwargs)
        )

    @property
    def variables(self) -> list[str]:
        """获取模板中的变量名"""
        return self.template.variables


class ChatPromptTemplate:
    """聊天消息模板，支持多条消息

    示例：
        template = ChatPromptTemplate.from_strings(
            system="You are a helpful assistant named {name}.",
            user="Hello! Please help me with {task}."
        )
        messages = template.format_messages(name="Bob", task="coding")
        # => [
        #      Message(role="system", content="You are a helpful assistant named Bob."),
        #      Message(role="user", content="Hello! Please help me with coding.")
        #    ]
    """

    def __init__(self, messages: list[ChatMessageTemplate]):
        """初始化聊天消息模板

        Args:
            messages: ChatMessageTemplate 列表
        """
        self.messages = messages

    def format_messages(self, **kwargs: Any) -> list[Message]:
        """格式化为 Message 对象列表

        Args:
            **kwargs: 变量值

        Returns:
            Message 列表
        """
        return [msg.format(**kwargs) for msg in self.messages]

    def format(self, **kwargs: Any) -> str:
        """格式化为字符串（向后兼容）

        将所有消息内容合并为一个字符串。

        Args:
            **kwargs: 变量值

        Returns:
            合并后的字符串
        """
        messages = self.format_messages(**kwargs)
        return "\n\n".join(msg.content or "" for msg in messages)

    def partial(self, **kwargs: Any) -> "ChatPromptTemplate":
        """预填充变量

        Args:
            **kwargs: 要预填充的变量

        Returns:
            新的 ChatPromptTemplate 实例
        """
        new_messages = [
            ChatMessageTemplate(
                role=msg.role,
                template=msg.template.partial(**kwargs)
            )
            for msg in self.messages
        ]
        return ChatPromptTemplate(new_messages)

    def __add__(self, other: "ChatPromptTemplate") -> "ChatPromptTemplate":
        """组合两个聊天模板"""
        return ChatPromptTemplate(self.messages + other.messages)

    @property
    def variables(self) -> list[str]:
        """获取所有消息模板中的变量名"""
        all_vars = set()
        for msg in self.messages:
            all_vars.update(msg.variables)
        return list(all_vars)

    @classmethod
    def from_strings(cls, **kwargs: str) -> "ChatPromptTemplate":
        """从字符串创建聊天模板的便捷方法

        Args:
            **kwargs: 键为角色名，值为消息内容模板
                支持: system, user, assistant

        Returns:
            ChatPromptTemplate 实例

        示例：
            ChatPromptTemplate.from_strings(
                system="You are {name}.",
                user="Help with {task}."
            )
        """
        messages = []
        for role, content in kwargs.items():
            if role in ("system", "user", "assistant"):
                messages.append(ChatMessageTemplate(role, content))
        return cls(messages)

    @classmethod
    def from_messages(cls, messages: list[tuple[str, str]]) -> "ChatPromptTemplate":
        """从消息列表创建聊天模板

        Args:
            messages: [(role, template), ...] 列表
                role: "system", "user", "assistant"

        Returns:
            ChatPromptTemplate 实例

        示例：
            ChatPromptTemplate.from_messages([
                ("system", "You are a helpful assistant."),
                ("user", "Hello, {name}!")
            ])
        """
        msg_templates = [ChatMessageTemplate(role, tpl) for role, tpl in messages]
        return cls(msg_templates)
