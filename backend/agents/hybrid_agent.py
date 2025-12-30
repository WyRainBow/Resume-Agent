"""
HybridAgent - 混合模式 Agent

根据任务复杂度自动选择执行模式：
- 简单任务 → Function Calling（快速路径）
- 复杂任务 → ReAct（推理路径）

架构：
┌─────────────────────────────────────────┐
│           HybridAgent (统一入口)         │
│  ┌───────────────────────────────────┐  │
│  │  TaskClassifier                   │  │
│  │  根据任务特征选择执行模式：         │  │
│  │  - 简单任务 → Function Calling    │  │
│  │  - 复杂任务 → ReAct               │  │
│  └───────────────────────────────────┘  │
└─────────┬───────────────────────────────┘
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌─────────┐  ┌──────────┐
│  FC     │  │  ReAct   │
│  Agent  │  │  Agent   │
└─────────┘  └──────────┘
    │            │
    └──────┬─────┘
           ▼
    ┌──────────────┐
    │ ToolRegistry │
    │  (统一工具)  │
    └──────────────┘
"""

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Dict, Generator, List, Optional

from .task_classifier import TaskClassifier, ClassificationResult, ExecutionMode, TaskComplexity
from .capability import Capability, CapabilityRegistry, BASE_CAPABILITY
from .agent_state import AgentState
from .message_builder import MessageBuilder, MessageType, AgentMessage


@dataclass
class HybridAgentConfig:
    """混合 Agent 配置"""
    # 执行模式选择
    mode: ExecutionMode = ExecutionMode.AUTO

    # Function Calling 配置
    enable_function_calling: bool = True
    fc_temperature: float = 0.1

    # ReAct 配置
    enable_react: bool = True
    react_max_steps: int = 10
    react_temperature: float = 0.3

    # 自动选择阈值
    simple_task_max_length: int = 50
    complex_task_min_length: int = 150

    # 调试
    debug: bool = False
    log_mode_selection: bool = True


@dataclass
class ExecutionContext:
    """执行上下文"""
    session_id: str
    user_message: str
    classification: ClassificationResult
    start_time: float = field(default_factory=time.time)
    steps: List[Dict] = field(default_factory=list)
    tool_calls: List[Dict] = field(default_factory=list)

    @property
    def duration_ms(self) -> int:
        return int((time.time() - self.start_time) * 1000)


class HybridAgent:
    """
    混合模式 Agent

    根据任务复杂度自动选择 Function Calling 或 ReAct 模式。
    """

    def __init__(
        self,
        resume_data: Optional[Dict[str, Any]] = None,
        session_id: str = "",
        capability: Optional[Capability] = None,
        config: Optional[HybridAgentConfig] = None,
        llm_call_fn: Optional[Callable] = None,
    ):
        """
        初始化混合 Agent

        Args:
            resume_data: 简历数据
            session_id: 会话 ID
            capability: 能力包配置
            config: 混合 Agent 配置
            llm_call_fn: LLM 调用函数（签名为 call_llm(messages, tools) -> dict）
        """
        self.resume_data = resume_data or {}
        self.session_id = session_id
        self.capability = capability or BASE_CAPABILITY
        self.config = config or HybridAgentConfig()
        self.llm_call_fn = llm_call_fn

        # 状态管理
        self.state = AgentState(resume_data=resume_data, session_id=session_id)
        self.chat_history: List[Dict[str, str]] = []

        # 统计信息
        self.stats = {
            "total_requests": 0,
            "function_calling_count": 0,
            "react_count": 0,
            "mode_selections": [],
        }

    # ========== 核心处理方法 ==========

    def process_message(self, user_message: str) -> AgentMessage:
        """
        处理用户消息（非流式）

        Args:
            user_message: 用户输入

        Returns:
            Agent 消息
        """
        # 分类任务
        classification = self._classify_task(user_message)

        # 记录统计
        self.stats["total_requests"] += 1
        self.stats["mode_selections"].append({
            "mode": classification.mode.value,
            "complexity": classification.complexity.value,
            "confidence": classification.confidence,
            "reason": classification.reason,
        })

        # 添加到历史
        self.state.add_message("user", user_message)

        # 根据模式执行
        if classification.mode == ExecutionMode.REACT:
            self.stats["react_count"] += 1
            return self._process_with_react(user_message, classification)
        else:
            self.stats["function_calling_count"] += 1
            return self._process_with_function_calling(user_message, classification)

    def process_message_stream(self, user_message: str) -> Generator[Dict[str, Any], None, None]:
        """
        处理用户消息（流式）

        Args:
            user_message: 用户输入

        Yields:
            事件字典
        """
        # 分类任务
        classification = self._classify_task(user_message)

        # 记录统计
        self.stats["total_requests"] += 1
        self.stats["mode_selections"].append({
            "mode": classification.mode.value,
            "complexity": classification.complexity.value,
            "confidence": classification.confidence,
            "reason": classification.reason,
        })

        # 添加到历史
        self.state.add_message("user", user_message)

        # 发送分类信息
        if self.config.log_mode_selection:
            yield {
                "type": "mode_selected",
                "mode": classification.mode.value,
                "complexity": classification.complexity.value,
                "confidence": classification.confidence,
                "reason": classification.reason,
                "session_id": self.session_id,
            }

        # 根据模式执行
        if classification.mode == ExecutionMode.REACT:
            self.stats["react_count"] += 1
            yield from self._process_stream_with_react(user_message, classification)
        else:
            self.stats["function_calling_count"] += 1
            yield from self._process_stream_with_function_calling(user_message, classification)

    # ========== 分类方法 ==========

    def _classify_task(self, user_message: str) -> ClassificationResult:
        """分类任务"""
        # 检查配置中是否强制指定模式
        if self.config.mode == ExecutionMode.FUNCTION_CALLING:
            return ClassificationResult(
                mode=ExecutionMode.FUNCTION_CALLING,
                complexity=TaskComplexity.SIMPLE,
                confidence=1.0,
                reason="配置强制使用 Function Calling"
            )
        elif self.config.mode == ExecutionMode.REACT:
            return ClassificationResult(
                mode=ExecutionMode.REACT,
                complexity=TaskComplexity.COMPLEX,
                confidence=1.0,
                reason="配置强制使用 ReAct"
            )

        # 使用 TaskClassifier 自动分类
        return TaskClassifier.classify(user_message, self.resume_data)

    # ========== Function Calling 路径 ==========

    def _process_with_function_calling(
        self,
        user_message: str,
        classification: ClassificationResult
    ) -> AgentMessage:
        """使用 Function Calling 处理"""
        # 添加到历史
        self.chat_history.append({"role": "user", "content": user_message})

        # 构建消息
        messages = self._build_messages_for_llm(user_message)

        # 调用 LLM
        if self.llm_call_fn:
            response = self.llm_call_fn(
                messages=messages,
                tools=self._get_function_calling_tools(),
                temperature=self.config.fc_temperature
            )
        else:
            # 没有提供 LLM 函数，返回错误
            return MessageBuilder.error(
                message="LLM 未配置，无法处理请求",
                session_id=self.session_id
            )

        # 处理响应
        if response.get("tool_calls"):
            # 有工具调用，执行并返回
            return self._handle_tool_calls(response, messages)
        else:
            # 直接回复
            content = response.get("content", "处理完成")
            self.chat_history.append({"role": "assistant", "content": content})
            return MessageBuilder.text(content=content, session_id=self.session_id)

    def _process_stream_with_function_calling(
        self,
        user_message: str,
        classification: ClassificationResult
    ) -> Generator[Dict[str, Any], None, None]:
        """使用 Function Calling 流式处理"""
        # 添加到历史
        self.chat_history.append({"role": "user", "content": user_message})

        yield {
            "type": "thinking",
            "content": f"📥 接收: {user_message[:30]}...\n🔧 使用 Function Calling 模式",
            "session_id": self.session_id,
        }

        # 构建消息
        messages = self._build_messages_for_llm(user_message)

        # 调用 LLM（需要支持流式）
        if self.llm_call_fn and hasattr(self.llm_call_fn, 'stream'):
            # 流式调用
            accumulated_content = ""
            tool_calls = []

            for chunk in self.llm_call_fn.stream(
                messages=messages,
                tools=self._get_function_calling_tools(),
                temperature=self.config.fc_temperature
            ):
                delta = chunk.get("choices", [{}])[0].get("delta", {})

                if "content" in delta and delta["content"]:
                    accumulated_content += delta["content"]
                    yield {
                        "type": "content_chunk",
                        "content": accumulated_content,
                        "session_id": self.session_id,
                    }

                if "tool_calls" in delta:
                    # 处理工具调用...
                    pass

            # 处理最终结果
            if tool_calls:
                yield from self._handle_tool_calls_stream(tool_calls, messages, user_message)
            else:
                self.chat_history.append({"role": "assistant", "content": accumulated_content})
                yield {
                    "type": "content",
                    "content": accumulated_content,
                    "session_id": self.session_id,
                }

        elif self.llm_call_fn:
            # 非流式调用
            response = self.llm_call_fn(
                messages=messages,
                tools=self._get_function_calling_tools(),
                temperature=self.config.fc_temperature
            )

            if response.get("tool_calls"):
                yield from self._handle_tool_calls_stream([response["tool_calls"]], messages, user_message)
            else:
                content = response.get("content", "处理完成")
                self.chat_history.append({"role": "assistant", "content": content})
                yield {
                    "type": "content",
                    "content": content,
                    "session_id": self.session_id,
                }
        else:
            yield {
                "type": "error",
                "content": "LLM 未配置",
                "session_id": self.session_id,
            }

    # ========== ReAct 路径 ==========

    def _process_with_react(
        self,
        user_message: str,
        classification: ClassificationResult
    ) -> AgentMessage:
        """使用 ReAct 处理"""
        from .react_agent import ReActAgent, ReActPromptBuilder

        # 创建 ReAct Agent
        react_agent = ReActAgent(
            resume_data=self.resume_data,
            capability=self.capability,
            session_id=self.session_id,
            max_steps=self.config.react_max_steps,
        )
        react_agent.llm_call_fn = self._create_react_llm_wrapper()

        # 运行 ReAct（同步方式，收集所有输出）
        import asyncio

        final_content = ""
        try:
            # 在新事件循环中运行
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def collect():
                content = ""
                async for event in react_agent.run(user_message):
                    if event.get("type") in ["content", "final_answer"]:
                        content = event.get("content", content)
                return content

            final_content = loop.run_until_complete(collect())
            loop.close()

        except Exception as e:
            if self.config.debug:
                print(f"[HybridAgent] ReAct 错误: {e}")
            final_content = f"处理出错: {e}"

        # 添加到历史
        self.chat_history.append({"role": "assistant", "content": final_content})

        return MessageBuilder.text(content=final_content, session_id=self.session_id)

    def _process_stream_with_react(
        self,
        user_message: str,
        classification: ClassificationResult
    ) -> Generator[Dict[str, Any], None, None]:
        """使用 ReAct 流式处理"""
        from .react_agent import ReActAgent

        yield {
            "type": "thinking",
            "content": f"📥 接收: {user_message[:30]}...\n🧠 使用 ReAct 推理模式",
            "session_id": self.session_id,
        }

        # 创建 ReAct Agent
        react_agent = ReActAgent(
            resume_data=self.resume_data,
            capability=self.capability,
            session_id=self.session_id,
            max_steps=self.config.react_max_steps,
        )
        react_agent.llm_call_fn = self._create_react_llm_wrapper()

        # 运行 ReAct 并转发事件
        import asyncio

        try:
            # 在新事件循环中运行
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def forward_events():
                async for event in react_agent.run(user_message):
                    # 添加 session_id
                    event["session_id"] = self.session_id
                    # 转换为同步 yield
                    yield event

            # 收集所有事件
            events = []
            async def collect():
                async for event in react_agent.run(user_message):
                    events.append(event)

            loop.run_until_complete(collect())
            loop.close()

            # 生成事件
            for event in events:
                yield event

        except Exception as e:
            if self.config.debug:
                print(f"[HybridAgent] ReAct 流式错误: {e}")
            yield {
                "type": "error",
                "content": f"ReAct 处理出错: {e}",
                "session_id": self.session_id,
            }

    # ========== 工具方法 ==========

    def _build_messages_for_llm(self, user_message: str) -> List[Dict[str, str]]:
        """构建 LLM 消息"""
        # System Prompt
        system_prompt = self._build_system_prompt()

        messages = [{"role": "system", "content": system_prompt}]

        # 添加上下文（对话历史）
        context_messages = self.state.get_context_for_llm(
            current_message=user_message,
            resume_summary=self._get_resume_summary()
        )
        messages.extend(context_messages)

        return messages

    def _build_system_prompt(self) -> str:
        """构建 System Prompt"""
        base_prompt = """你是 RA AI，一个专业的简历助手。

你有以下工具可用：
- CVReader: 读取简历数据
- CVEditor: 编辑简历（update/add/delete）
- CVBatchEditor: 批量编辑

直接使用工具处理用户请求，不需要额外的思考步骤。
"""

        # 添加 Capability 指令
        if self.capability.system_prompt_addendum:
            base_prompt += f"\n\n{self.capability.system_prompt_addendum}"

        return base_prompt

    def _get_resume_summary(self) -> str:
        """获取简历摘要"""
        parts = []
        basic = self.resume_data.get("basic", {})
        if basic.get("name"):
            parts.append(f"姓名:{basic['name']}")

        for key, label in [
            ("education", "教育"),
            ("workExperience", "工作经历"),
            ("projects", "项目"),
        ]:
            items = self.resume_data.get(key, [])
            if items:
                parts.append(f"{label}:{len(items)}条")

        return ", ".join(parts) if parts else "空简历"

    def _get_function_calling_tools(self) -> List[Dict]:
        """获取 Function Calling 工具定义"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "CVReader",
                    "description": "读取简历数据",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "字段路径"}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "CVEditor",
                    "description": "编辑简历",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "action": {"type": "string", "enum": ["update", "add", "delete"]},
                            "value": {"description": "新值"}
                        },
                        "required": ["path", "action"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "CVBatchEditor",
                    "description": "批量编辑简历",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "operations": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "path": {"type": "string"},
                                        "action": {"type": "string", "enum": ["update", "add", "delete"]},
                                        "value": {}
                                    },
                                    "required": ["path", "action"]
                                }
                            }
                        },
                        "required": ["operations"]
                    }
                }
            }
        ]

    def _handle_tool_calls(self, response: Dict, messages: List[Dict]) -> AgentMessage:
        """处理工具调用（非流式）"""
        # 这里需要实现工具执行逻辑
        # 暂时返回成功消息
        return MessageBuilder.text(
            content="工具调用已处理（待实现）",
            session_id=self.session_id
        )

    def _handle_tool_calls_stream(
        self,
        tool_calls: List[Dict],
        messages: List[Dict],
        user_message: str
    ) -> Generator[Dict[str, Any], None, None]:
        """流式处理工具调用"""
        # 这里需要实现工具执行逻辑
        # 暂时返回成功消息
        yield {
            "type": "content",
            "content": "工具调用已处理（待实现）",
            "session_id": self.session_id,
        }

    def _create_react_llm_wrapper(self):
        """创建 ReAct LLM 包装器"""
        # 将同步的 llm_call_fn 包装成 ReAct 需要的格式
        def wrapper(prompt: str) -> str:
            messages = [{"role": "user", "content": prompt}]
            response = self.llm_call_fn(
                messages=messages,
                temperature=self.config.react_temperature
            )
            return response.get("content", "")

        return wrapper

    # ========== 统计方法 ==========

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            **self.stats,
            "function_calling_ratio": (
                self.stats["function_calling_count"] / self.stats["total_requests"]
                if self.stats["total_requests"] > 0 else 0
            ),
            "react_ratio": (
                self.stats["react_count"] / self.stats["total_requests"]
                if self.stats["total_requests"] > 0 else 0
            ),
        }

    def reset_stats(self) -> None:
        """重置统计"""
        self.stats = {
            "total_requests": 0,
            "function_calling_count": 0,
            "react_count": 0,
            "mode_selections": [],
        }


# 便捷函数
def create_hybrid_agent(
    resume_data: Optional[Dict[str, Any]] = None,
    session_id: str = "",
    capability: Optional[str] = None,
    mode: ExecutionMode = ExecutionMode.AUTO,
    llm_call_fn: Optional[Callable] = None,
) -> HybridAgent:
    """
    创建混合 Agent

    Args:
        resume_data: 简历数据
        session_id: 会话 ID
        capability: 能力包名称
        mode: 执行模式
        llm_call_fn: LLM 调用函数

    Returns:
        HybridAgent 实例
    """
    cap = CapabilityRegistry.get(capability) if capability else BASE_CAPABILITY
    config = HybridAgentConfig(mode=mode)

    return HybridAgent(
        resume_data=resume_data,
        session_id=session_id,
        capability=cap,
        config=config,
        llm_call_fn=llm_call_fn,
    )
