"""
ReAct Agent - 基于 ReAct 循环的智能体

ReAct (Reasoning + Acting) 模式：
Thought（推理思考） → Response/Code（自然语言回复或工具调用） → Observation（工具执行结果） → 循环...

参考 sophia-pro 的 ReAct 架构，适配简历场景。

核心特性：
1. Thought - 推理思考阶段，分析用户意图
2. Response - 自然语言回复给用户
3. Code/Action - 工具调用代码
4. Observation - 工具执行结果
5. 循环直到完成任务
"""

import json
import re
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from .capability import Capability, CapabilityRegistry
from .agent_state import AgentState
from .message_builder import MessageBuilder, MessageType


class ReActStepType(str, Enum):
    """ReAct 步骤类型"""
    THOUGHT = "thought"
    RESPONSE = "response"
    CODE = "code"
    OBSERVATION = "observation"
    FINAL_ANSWER = "final_answer"


class ReActSpanStatus(str, Enum):
    """ReAct Span 状态"""
    START = "start"
    END = "end"


@dataclass
class ReActStep:
    """单个 ReAct 步骤"""
    step_type: ReActStepType
    content: str
    timestamp: float = field(default_factory=time.time)
    step_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.step_type.value,
            "content": self.content,
            "step_id": self.step_id,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


@dataclass
class ReActMemory:
    """ReAct 记忆存储"""
    steps: List[ReActStep] = field(default_factory=list)
    current_thought: str = ""
    current_response: str = ""
    current_code: str = ""
    observations: List[str] = field(default_factory=list)
    tool_results: List[Dict[str, Any]] = field(default_factory=list)

    def add_step(self, step: ReActStep) -> None:
        """添加步骤"""
        self.steps.append(step)

    def get_last_steps(self, n: int = 5) -> List[ReActStep]:
        """获取最近 N 步"""
        return self.steps[-n:]

    def get_context_for_llm(self) -> str:
        """获取用于 LLM 的上下文"""
        parts = []
        for step in self.steps[-10:]:  # 最近 10 步
            if step.step_type == ReActStepType.OBSERVATION:
                parts.append(f"Observation: {step.content}")
            elif step.step_type == ReActStepType.FINAL_ANSWER:
                parts.append(f"Final Answer: {step.content}")
        return "\n".join(parts) if parts else "No previous observations."


class ReActPromptBuilder:
    """ReAct Prompt 构建器"""

    BASE_SYSTEM_PROMPT = """你是 RA AI，一个专业的简历助手。

## ReAct 模式

你需要在思考（Thought）、回复（Response）、代码（Code）之间循环，直到完成用户的任务。

## 输出格式

严格按以下格式输出：

```
Thought: <你的思考过程，分析用户意图，决定下一步行动>
Response: "<自然语言回复给用户，可以是回答问题或说明下一步操作>"
Code:
```python
# 工具调用代码
result = CVReader(path="basic.name")
```
```

或者不需要工具调用时：

```
Thought: <你的思考过程>
Response: "<直接回答用户>"
Final Answer: "<最终答案>"
```

## 重要规则

1. **Thought** 必须在每一轮输出，说明你的思考过程
2. **Response** 是给用户看的自然语言回复
3. **Code** 是需要执行的 Python 代码，用于调用工具
4. **Final Answer** 表示任务完成，给出最终答案
5. 代码块必须用 ```python 包裹
6. 如果需要更多信息，使用 Response 向用户询问

## 可用工具

- CVReader(path): 读取简历数据，path 参数可选
- CVEditor(path, action, value): 编辑简历数据
  - path: JSON 路径，如 "basic.name", "workExperience"
  - action: "update"(修改), "add"(添加), "delete"(删除)
  - value: 新值（update/add 时需要）

## 简历结构

```json
{
  "basic": {"name", "title", "email", "phone", "location"},
  "education": [{"school", "major", "degree", "startDate", "endDate"}],
  "workExperience": [{"company", "position", "startDate", "endDate", "description"}],
  "projects": [{"name", "role", "description"}],
  "skillContent": "技能描述"
}
```
"""

    @staticmethod
    def build_prompt(
        user_message: str,
        memory: ReActMemory,
        capability: Capability,
        resume_summary: str = "",
        chat_history: List[Dict[str, str]] = None,
    ) -> str:
        """构建完整的 Prompt

        Args:
            user_message: 用户消息
            memory: ReAct 记忆
            capability: 能力包
            resume_summary: 简历摘要
            chat_history: 对话历史

        Returns:
            完整的 Prompt 字符串
        """
        parts = [ReActPromptBuilder.BASE_SYSTEM_PROMPT]

        # 添加 Capability 指令
        if capability.system_prompt_addendum:
            parts.append(f"\n## {capability.name.upper()} 指令\n\n{capability.system_prompt_addendum}")

        # 添加简历摘要
        if resume_summary:
            parts.append(f"\n## 当前简历\n\n{resume_summary}")

        # 添加对话历史
        if chat_history:
            history_text = []
            for msg in chat_history[-6:]:  # 最近 6 条
                role = msg.get("role", "user").upper()
                content = msg.get("content", "")[:300]
                history_text.append(f"{role}: {content}")
            parts.append(f"\n## 对话历史\n\n" + "\n".join(history_text))

        # 添加之前的观察（ReAct 上下文）
        observations = memory.get_context_for_llm()
        if observations:
            parts.append(f"\n## 之前的执行结果\n\n{observations}")

        # 添加当前用户消息
        parts.append(f"\n## 用户消息\n\n{user_message}")

        # 添加开始指令
        parts.append("\n\n请开始处理，按照 Thought → Response → Code 的格式输出。")

        return "\n".join(parts)


class ReActOutputParser:
    """ReAct 输出解析器"""

    # 用于匹配不同部分的正则表达式
    THOUGHT_PATTERN = re.compile(r'Thought:\s*(.*?)(?=Response:|Code:|Final Answer:|$)', re.DOTALL)
    RESPONSE_PATTERN = re.compile(r'Response:\s*["\']?(.*?)["\']?\s*(?=Thought:|Code:|Final Answer:|$)', re.DOTALL)
    CODE_PATTERN = re.compile(r'Code:\s*```python\s*([\s\S]*?)\s*```', re.DOTALL)
    FINAL_ANSWER_PATTERN = re.compile(r'Final Answer:\s*(.*?)(?=Thought:|Response:|Code:|$)', re.DOTALL)

    @staticmethod
    def parse(llm_output: str) -> Dict[str, Any]:
        """解析 LLM 输出

        Args:
            llm_output: LLM 原始输出

        Returns:
            解析结果字典，包含 thought, response, code, is_final 等
        """
        result = {
            "thought": "",
            "response": "",
            "code": "",
            "is_final": False,
            "final_answer": "",
            "raw": llm_output,
        }

        # 提取 Thought
        thought_match = ReActOutputParser.THOUGHT_PATTERN.search(llm_output)
        if thought_match:
            result["thought"] = thought_match.group(1).strip()

        # 提取 Response
        response_match = ReActOutputParser.RESPONSE_PATTERN.search(llm_output)
        if response_match:
            result["response"] = response_match.group(1).strip()

        # 提取 Code
        code_match = ReActOutputParser.CODE_PATTERN.search(llm_output)
        if code_match:
            result["code"] = code_match.group(1).strip()

        # 检查是否有 Final Answer
        final_match = ReActOutputParser.FINAL_ANSWER_PATTERN.search(llm_output)
        if final_match:
            result["is_final"] = True
            result["final_answer"] = final_match.group(1).strip()

        return result


class ReActAgent:
    """ReAct Agent - 基于 ReAct 循环的简历助手

    特性：
    - 使用 ReAct 模式进行推理和行动
    - 支持多轮对话
    - 支持动态 Capability 配置
    - 统一的流式消息输出
    """

    def __init__(
        self,
        resume_data: Optional[Dict[str, Any]] = None,
        capability: Optional[Capability] = None,
        llm_call_fn: Optional[Callable] = None,
        session_id: str = "",
        max_steps: int = 10,
    ):
        """初始化 ReAct Agent

        Args:
            resume_data: 简历数据
            capability: 能力包配置
            llm_call_fn: LLM 调用函数
            session_id: 会话 ID
            max_steps: 最大执行步数
        """
        self.resume_data = resume_data or {}
        self.capability = capability or BASE_CAPABILITY
        self.llm_call_fn = llm_call_fn
        self.session_id = session_id
        self.max_steps = max_steps

        # 初始化状态
        self.memory = ReActMemory()
        self.shared_state = AgentState()
        self.chat_history: List[Dict[str, str]] = []

        # 工具注册（延迟加载）
        self._tools: Dict[str, Callable] = {}

        # 流式输出回调
        self.stream_callback: Optional[Callable] = None

    def register_tool(self, name: str, func: Callable) -> None:
        """注册工具"""
        self._tools[name] = func

    def set_stream_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """设置流式输出回调"""
        self.stream_callback = callback

    def _send_message(self, message: Dict[str, Any]) -> None:
        """发送消息到流"""
        if self.stream_callback:
            self.stream_callback(message)

    def _get_resume_summary(self) -> str:
        """获取简历摘要"""
        if not self.resume_data:
            return "简历为空"

        parts = []
        basic = self.resume_data.get("basic", {})
        if basic.get("name"):
            parts.append(f"姓名: {basic['name']}")
        if basic.get("title"):
            parts.append(f"职位: {basic['title']}")

        for key, label in [
            ("education", "教育经历"),
            ("workExperience", "工作经历"),
            ("projects", "项目经历"),
        ]:
            items = self.resume_data.get(key, [])
            if items:
                parts.append(f"{label}: {len(items)}条")

        return ", ".join(parts) if parts else "简历为空"

    def _execute_code(self, code: str) -> Dict[str, Any]:
        """执行 Python 代码（工具调用）

        Args:
            code: Python 代码字符串

        Returns:
            执行结果字典
        """
        # 创建受限的执行环境
        exec_globals = {
            "CVReader": self._create_cv_reader_wrapper(),
            "CVEditor": self._create_cv_editor_wrapper(),
            "__builtins__": {
                "print": print,
                "len": len,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
                "list": list,
                "dict": dict,
                "tuple": tuple,
            },
        }

        try:
            # 执行代码，捕获最后一个表达式的值
            exec_result = {}
            exec(f"""
try:
    result = {code}
    exec_result['success'] = True
    exec_result['result'] = result
    exec_result['output'] = str(result) if result is not None else ''
except Exception as e:
    exec_result['success'] = False
    exec_result['error'] = str(e)
    exec_result['output'] = f'Error: {{e}}'
""", {**exec_globals, "exec_result": exec_result})

            return exec_result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": f"执行错误: {e}",
            }

    def _create_cv_reader_wrapper(self):
        """创建 CVReader 包装器"""
        from .tools import create_cv_reader

        reader = create_cv_reader(self.resume_data)

        def wrapper(path=None):
            try:
                result = reader._run(path=path) if path else reader._run()
                return result
            except Exception as e:
                return {"success": False, "message": str(e)}

        return wrapper

    def _create_cv_editor_wrapper(self):
        """创建 CVEditor 包装器"""
        from .tools import create_cv_editor

        editor = create_cv_editor(self.resume_data)

        def wrapper(path="", action="", value=None):
            try:
                result = editor._run(path=path, action=action, value=value)
                # 同步数据
                if result.get("success"):
                    self.resume_data.clear()
                    self.resume_data.update(editor.resume_data)
                return result
            except Exception as e:
                return {"success": False, "message": str(e)}

        return wrapper

    async def run(self, user_message: str) -> AsyncGenerator[Dict[str, Any], None]:
        """运行 ReAct 循环

        Args:
            user_message: 用户消息

        Yields:
            消息字典
        """
        # 添加到历史
        self.chat_history.append({"role": "user", "content": user_message})

        # 发送开始消息
        yield {
            "type": "procedure_start",
            "content": "开始处理请求",
            "session_id": self.session_id,
        }

        # 构建初始 Prompt
        prompt = ReActPromptBuilder.build_prompt(
            user_message=user_message,
            memory=self.memory,
            capability=self.capability,
            resume_summary=self._get_resume_summary(),
            chat_history=self.chat_history,
        )

        # ReAct 循环
        for step_num in range(1, self.max_steps + 1):
            # 创建步骤 span
            step_id = str(uuid.uuid4())[:8]
            thinking_id = str(uuid.uuid4())[:8]

            yield {
                "type": "step_start",
                "step_id": step_id,
                "step_number": step_num,
                "session_id": self.session_id,
            }

            try:
                # 调用 LLM
                if self.llm_call_fn:
                    llm_output = await self._call_llm_async(prompt)
                else:
                    # 默认同步调用
                    from llm import call_llm
                    llm_output = call_llm("deepseek", prompt)

                # 解析输出
                parsed = ReActOutputParser.parse(llm_output)

                # 发送 Thought
                if parsed["thought"]:
                    yield {
                        "type": "thinking_start",
                        "content": "",
                        "session_id": self.session_id,
                    }
                    yield {
                        "type": "thinking_content",
                        "content": parsed["thought"],
                        "session_id": self.session_id,
                    }
                    yield {
                        "type": "thinking_end",
                        "content": "",
                        "session_id": self.session_id,
                    }

                    # 记录 Thought
                    self.memory.add_step(ReActStep(
                        step_type=ReActStepType.THOUGHT,
                        content=parsed["thought"],
                    ))

                # 发送 Response
                if parsed["response"]:
                    yield {
                        "type": "content",
                        "content": parsed["response"],
                        "session_id": self.session_id,
                    }

                    # 记录 Response
                    self.memory.add_step(ReActStep(
                        step_type=ReActStepType.RESPONSE,
                        content=parsed["response"],
                    ))

                # 检查是否完成
                if parsed["is_final"]:
                    final_content = parsed["final_answer"] or parsed["response"]
                    yield {
                        "type": "final_answer",
                        "content": final_content,
                        "session_id": self.session_id,
                    }

                    # 添加到历史
                    self.chat_history.append({"role": "assistant", "content": final_content})

                    yield {
                        "type": "step_end",
                        "step_id": step_id,
                        "session_id": self.session_id,
                    }
                    break

                # 执行 Code
                if parsed["code"]:
                    yield {
                        "type": "tool_call",
                        "content": f"正在执行: {parsed['code'][:100]}...",
                        "code": parsed["code"],
                        "session_id": self.session_id,
                    }

                    # 记录 Code
                    self.memory.add_step(ReActStep(
                        step_type=ReActStepType.CODE,
                        content=parsed["code"],
                    ))

                    # 执行代码
                    exec_result = self._execute_code(parsed["code"])

                    # 发送执行结果
                    if exec_result.get("success"):
                        observation = exec_result.get("output", "执行成功")
                        yield {
                            "type": "tool_result",
                            "content": observation,
                            "success": True,
                            "session_id": self.session_id,
                        }
                    else:
                        observation = exec_result.get("error", "执行失败")
                        yield {
                            "type": "tool_result",
                            "content": observation,
                            "success": False,
                            "session_id": self.session_id,
                        }

                    # 记录 Observation
                    self.memory.add_step(ReActStep(
                        step_type=ReActStepType.OBSERVATION,
                        content=observation,
                    ))

                    # 更新 Prompt，添加观察结果
                    prompt = f"{prompt}\n\nObservation: {observation}\n\n请继续，根据观察结果决定下一步操作（使用 Final Answer 完成或继续执行其他操作）。"

                yield {
                    "type": "step_end",
                    "step_id": step_id,
                    "session_id": self.session_id,
                }

            except Exception as e:
                yield {
                    "type": "error",
                    "content": f"执行出错: {e}",
                    "session_id": self.session_id,
                }
                break

        yield {
            "type": "procedure_end",
            "content": "处理完成",
            "session_id": self.session_id,
        }

    async def _call_llm_async(self, prompt: str) -> str:
        """异步调用 LLM（包装同步调用）"""
        import asyncio
        from llm import call_llm

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: call_llm("deepseek", prompt))


# 便捷函数
def create_react_agent(
    resume_data: Optional[Dict[str, Any]] = None,
    capability_name: str = "base",
    session_id: str = "",
) -> ReActAgent:
    """创建 ReAct Agent 实例

    Args:
        resume_data: 简历数据
        capability_name: 能力包名称
        session_id: 会话 ID

    Returns:
        ReActAgent 实例
    """
    capability = CapabilityRegistry.get(capability_name)
    return ReActAgent(
        resume_data=resume_data,
        capability=capability,
        session_id=session_id,
    )
