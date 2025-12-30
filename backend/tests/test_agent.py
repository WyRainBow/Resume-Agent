"""
Agent 单元测试

测试范围：
1. 工具注册中心
2. 异常处理
3. 上下文管理器
4. 意图识别器
"""
import pytest
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.tool_registry_v2 import ToolRegistry, ToolMetadata, ToolStatus, register_tool
from agents.exceptions import (
    AgentError, ToolError, ToolNotFoundError, ToolExecutionError,
    DataError, DataNotFoundError, IntentError, ErrorHandler
)
from agents.context_manager import ContextManager, ContextStrategy, Message, create_context_manager


# ==================== 工具注册中心测试 ====================

class MockTool:
    """模拟工具类"""
    name = "mock_tool"
    description = "模拟工具"

    def __init__(self, **kwargs):
        self.kwargs = kwargs


class TestToolRegistry:
    """工具注册中心测试"""

    def test_register_tool_class(self):
        """测试工具类注册"""
        ToolRegistry.register("mock", MockTool)
        assert ToolRegistry.exists("mock")
        assert ToolRegistry.get_tool("mock") == MockTool

    def test_register_with_decorator(self):
        """测试装饰器注册"""
        @ToolRegistry.register("decorated")
        class DecoratedTool:
            pass

        assert ToolRegistry.exists("decorated")
        assert ToolRegistry.get_tool("decorated") == DecoratedTool

    def test_register_factory(self):
        """测试工厂函数注册"""
        def create_mock(**kwargs):
            return MockTool(**kwargs)

        ToolRegistry.register_factory("mock_factory", create_mock)
        assert ToolRegistry.get_factory("mock_factory") == create_mock

    def test_create_tool(self):
        """测试创建工具实例"""
        ToolRegistry.register("test_create", MockTool)
        instance = ToolRegistry.create_tool("test_create", param1="value1")

        assert isinstance(instance, MockTool)
        assert instance.kwargs == {"param1": "value1"}

    def test_get_or_create_singleton(self):
        """测试单例模式"""
        ToolRegistry.register("singleton", MockTool)

        instance1 = ToolRegistry.get_or_create_instance("singleton", param="value")
        instance2 = ToolRegistry.get_or_create_instance("singleton")

        assert instance1 is instance2

    def test_list_tools(self):
        """测试列出工具"""
        ToolRegistry.register("tool1", MockTool)
        ToolRegistry.register("tool2", MockTool)

        tools = ToolRegistry.list_tools()
        assert "tool1" in tools
        assert "tool2" in tools

    def test_unregister(self):
        """测试注销工具"""
        ToolRegistry.register("to_remove", MockTool)
        assert ToolRegistry.exists("to_remove")

        result = ToolRegistry.unregister("to_remove")
        assert result is True
        assert not ToolRegistry.exists("to_remove")

    def test_clear_cache(self):
        """测试清空缓存"""
        ToolRegistry.register("cached", MockTool)
        ToolRegistry.get_or_create_instance("cached", param="value")

        ToolRegistry.clear_cache()
        # 缓存清空后，重新创建应该是新实例
        instance1 = ToolRegistry.get_or_create_instance("cached", param="value")
        instance2 = ToolRegistry.get_or_create_instance("cached")
        assert instance1 is instance2  # 第一次创建后缓存

    def test_metadata(self):
        """测试元数据"""
        metadata = ToolMetadata(
            name="test_tool",
            description="测试工具",
            version="2.0.0",
            category="test"
        )

        ToolRegistry.register("with_meta", MockTool, metadata=metadata)
        retrieved = ToolRegistry.get_metadata("with_meta")

        assert retrieved.name == "test_tool"
        assert retrieved.version == "2.0.0"
        assert retrieved.category == "test"


# ==================== 异常处理测试 ====================

class TestExceptions:
    """异常处理测试"""

    def test_agent_error_creation(self):
        """测试 Agent 基础异常"""
        error = AgentError("测试错误")
        assert error.message == "测试错误"
        assert str(error) == "测试错误"

    def test_tool_error(self):
        """测试工具异常"""
        error = ToolError(
            message="工具执行失败",
            tool_name="test_tool",
            tool_params={"param": "value"}
        )

        assert error.tool_name == "test_tool"
        assert error.tool_params == {"param": "value"}

    def test_tool_not_found_error(self):
        """测试工具未找到异常"""
        error = ToolNotFoundError("missing_tool", ["tool1", "tool2"])

        assert error.tool_name == "missing_tool"
        assert error.available_tools == ["tool1", "tool2"]
        assert "可用工具" in error.message

    def test_tool_execution_error(self):
        """测试工具执行异常"""
        original = ValueError("原始错误")
        error = ToolExecutionError(
            tool_name="failing_tool",
            error_message="执行失败",
            original_error=original
        )

        assert error.original_error == original

    def test_data_error(self):
        """测试数据异常"""
        error = DataError("数据错误", path="basic.name")
        assert error.path == "basic.name"

    def test_data_not_found_error(self):
        """测试数据未找到异常"""
        error = DataNotFoundError(
            path="missing.field",
            available_paths=["basic", "education"]
        )

        assert error.path == "missing.field"
        assert error.available_paths == ["basic", "education"]

    def test_intent_error(self):
        """测试意图识别异常"""
        error = IntentError(
            message="无法识别意图",
            user_input="做什么"
        )

        assert error.user_input == "做什么"

    def test_error_handler(self):
        """测试错误处理器"""
        error = ToolExecutionError(
            tool_name="test_tool",
            error_message="测试错误"
        )

        handled = ErrorHandler.handle_error(error)
        assert handled["error_type"] == "ToolExecutionError"
        assert handled["message"] == "测试错误"
        assert "category" in handled

    def test_create_error_response(self):
        """测试创建错误响应"""
        error = AgentError("测试错误")
        response = ErrorHandler.create_error_response(error, include_traceback=False)

        assert response["success"] is False
        assert "error" in response
        # 不包含堆栈跟踪
        assert "traceback" not in response["error"].get("context", {})


# ==================== 上下文管理器测试 ====================

class TestContextManager:
    """上下文管理器测试"""

    def test_create_context_manager(self):
        """测试创建上下文管理器"""
        ctx = create_context_manager()
        assert isinstance(ctx, ContextManager)
        assert ctx.max_history == 20

    def test_add_message(self):
        """测试添加消息"""
        ctx = ContextManager()
        msg = ctx.add_message("user", "你好")

        assert isinstance(msg, Message)
        assert msg.role == "user"
        assert msg.content == "你好"
        assert len(ctx.window.messages) == 1

    def test_get_history(self):
        """测试获取历史"""
        ctx = ContextManager()
        ctx.add_message("user", "消息1")
        ctx.add_message("assistant", "回复1")
        ctx.add_message("user", "消息2")

        history = ctx.get_history()
        assert len(history) == 3

        history_limit = ctx.get_history(limit=2)
        assert len(history_limit) == 2

    def test_get_history_for_llm(self):
        """测试获取 LLM 格式历史"""
        ctx = ContextManager()
        ctx.add_message("user", "你好")
        ctx.add_message("assistant", "你好！")

        history = ctx.get_history(for_llm=True)
        assert len(history) == 2
        assert history[0] == {"role": "user", "content": "你好"}
        assert history[1] == {"role": "assistant", "content": "你好！"}

    def test_sliding_window(self):
        """测试滑动窗口"""
        ctx = ContextManager(max_history=3)

        ctx.add_message("user", "消息1")
        ctx.add_message("user", "消息2")
        ctx.add_message("user", "消息3")
        ctx.add_message("user", "消息4")  # 超出限制

        # 应该只保留最近 3 条
        assert len(ctx.window.messages) == 3
        assert ctx.window.messages[0].content == "消息2"

    def test_estimate_tokens(self):
        """测试 token 估算"""
        ctx = ContextManager()
        ctx.add_message("user", "这是一条中文消息")
        ctx.add_message("user", "This is an English message")

        tokens = ctx.estimate_tokens()
        assert tokens > 0

    def test_needs_summarization(self):
        """测试摘要阈值检测"""
        ctx = ContextManager(summary_threshold=3)

        # 未达到阈值
        assert not ctx.needs_summarization()

        ctx.add_message("user", "消息1")
        ctx.add_message("user", "消息2")

        # 仍未达到阈值
        assert not ctx.needs_summarization()

        ctx.add_message("user", "消息3")

        # 达到阈值
        assert ctx.needs_summarization()

    def test_generate_summary(self):
        """测试生成摘要"""
        ctx = ContextManager()
        ctx.add_message("user", "查看简历")
        ctx.add_message("assistant", "已为您读取简历")

        summary = ctx.generate_summary()
        assert "对话包含" in summary
        assert len(summary) > 0

    def test_clear(self):
        """测试清空上下文"""
        ctx = ContextManager()
        ctx.add_message("user", "消息1")
        ctx.add_message("user", "消息2")

        ctx.clear()
        assert len(ctx.window.messages) == 0
        assert ctx.window.total_chars == 0

    def test_get_context_for_llm(self):
        """测试获取 LLM 上下文"""
        ctx = ContextManager()
        ctx.add_message("user", "之前的消息")

        context = ctx.get_context_for_llm(
            current_message="当前消息",
            system_prompt="你是一个助手"
        )

        # 应该包含系统提示、历史和当前消息
        assert len(context) >= 2
        assert context[0]["role"] == "system"
        assert context[-1]["role"] == "user"

    def test_find_last_tool_call(self):
        """测试查找最后的工具调用"""
        ctx = ContextManager()
        ctx.add_message("user", "修改简历", metadata={"tool_call": {"name": "CVEditor"}})

        result = ctx.find_last_tool_call()
        assert result is not None
        assert result.metadata["tool_call"]["name"] == "CVEditor"

    def test_get_conversation_summary(self):
        """测试获取对话摘要"""
        ctx = ContextManager()
        ctx.add_message("user", "消息1")
        ctx.add_message("assistant", "回复1")

        summary = ctx.get_conversation_summary()
        assert "对话包含" in summary

    def test_to_dict(self):
        """测试转换为字典"""
        ctx = ContextManager(max_history=10, max_tokens=5000)
        ctx.add_message("user", "测试消息")

        d = ctx.to_dict()
        assert d["max_history"] == 10
        assert d["max_tokens"] == 5000
        assert d["message_count"] == 1


# ==================== 消息类测试 ====================

class TestMessage:
    """消息类测试"""

    def test_message_creation(self):
        """测试消息创建"""
        msg = Message(role="user", content="测试")

        assert msg.role == "user"
        assert msg.content == "测试"
        assert msg.metadata == {}

    def test_message_to_dict(self):
        """测试消息转字典"""
        msg = Message(role="user", content="测试", metadata={"key": "value"})

        d = msg.to_dict()
        assert d["role"] == "user"
        assert d["content"] == "测试"
        assert d["metadata"]["key"] == "value"

    def test_message_to_llm_format(self):
        """测试消息转 LLM 格式"""
        msg = Message(role="assistant", content="回复")

        d = msg.to_llm_format()
        assert d == {"role": "assistant", "content": "回复"}


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])
