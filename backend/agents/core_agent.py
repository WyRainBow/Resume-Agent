"""
核心智能体 (Core Agent) - 动态任务图版本

基于 LLM + 动态任务图实现，替代原有的规则引擎。
特性：
1. LLM 原生推理，无需关键词匹配
2. RAG 知识库增强
3. STAR 法则渐进式追问
4. 非线性任务规划
"""
import json
from typing import Dict, Any, Optional, List, AsyncGenerator, Callable
from dataclasses import dataclass
from enum import Enum

# 导入动态任务 Agent
from .dynamic_agent import LangChainResumeAgent, create_dynamic_agent

# 导入知识库
from .knowledge_base import get_knowledge_base, get_star_guidancer

# LLM 调用
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from llm import call_llm, call_llm_stream


# ==================== 配置 ====================

class AgentMode(str, Enum):
    """Agent 模式"""
    DYNAMIC = "dynamic"     # 动态任务图（推荐）
    LEGACY = "legacy"       # 保留规则引擎（兼容）


class AgentState(str, Enum):
    """Agent 状态"""
    IDLE = "idle"
    PROCESSING = "processing"
    EXECUTING_TOOL = "executing_tool"


@dataclass
class AgentResponse:
    """Agent 响应"""
    reply: str
    tool_call: Optional[Dict[str, Any]] = None
    tool_result: Optional[Dict[str, Any]] = None
    intent_result: Optional[Dict[str, Any]] = None
    resume_modified: bool = False
    error: Optional[str] = None
    followup_questions: List[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reply": self.reply,
            "tool_call": self.tool_call,
            "tool_result": self.tool_result,
            "intent_result": self.intent_result,
            "resume_modified": self.resume_modified,
            "error": self.error,
            "followup_questions": self.followup_questions or []
        }


class CoreAgent:
    """
    核心智能体 - 动态任务图版本

    架构：
    1. LLM 原生推理（替代规则引擎）
    2. RAG 知识库增强回复
    3. STAR 法则渐进式追问
    4. 动态多步任务规划

    处理流程：
    1. 接收用户消息
    2. RAG 检索相关上下文
    3. LLM 规划并执行工具调用
    4. STAR 法则生成追问
    """

    def __init__(
        self,
        resume_data: Optional[Dict[str, Any]] = None,
        mode: AgentMode = AgentMode.DYNAMIC,
        session_id: Optional[str] = None,
        llm_call_fn: Optional[Callable] = None,
        enable_rag: bool = True,
        enable_star: bool = True,
        milvus_uri: str = "http://localhost:19530"
    ):
        """
        初始化 Agent

        Args:
            resume_data: 简历数据字典
            mode: Agent 模式（DYNAMIC 推荐，LEGACY 兼容旧版）
            session_id: 会话 ID
            llm_call_fn: LLM 调用函数
            enable_rag: 启用 RAG 知识库
            enable_star: 启用 STAR 法则追问
            milvus_uri: Milvus 服务地址
        """
        self._resume_data = resume_data or {}
        self.mode = mode
        self.session_id = session_id
        self.enable_rag = enable_rag
        self.enable_star = enable_star
        self.milvus_uri = milvus_uri

        self.state = AgentState.IDLE
        self.chat_history: List[Dict[str, str]] = []

        # 初始化动态任务 Agent
        self._dynamic_agent: Optional[LangChainResumeAgent] = None
        self._init_dynamic_agent(llm_call_fn)

        # 保留规则引擎（兼容模式）
        if mode == AgentMode.LEGACY:
            from .task_planner import create_task_planner
            from .tools import create_cv_reader, create_cv_editor
            self.task_planner = create_task_planner()
            self._init_legacy_tools()

    def _init_dynamic_agent(self, llm_call_fn: Optional[Callable]):
        """初始化动态任务 Agent"""
        self._dynamic_agent = LangChainResumeAgent(
            resume_data=self._resume_data,
            session_id=self.session_id,
            llm_call_fn=llm_call_fn,
            enable_rag=self.enable_rag,
            enable_star=self.enable_star,
            milvus_uri=self.milvus_uri
        )

    def _init_legacy_tools(self):
        """初始化规则引擎工具（兼容模式）"""
        from .tools import create_cv_reader, create_cv_editor
        self.cv_reader = create_cv_reader(self._resume_data)
        self.cv_editor = create_cv_editor(self._resume_data)

    @property
    def resume_data(self) -> Dict[str, Any]:
        return self._resume_data

    @resume_data.setter
    def resume_data(self, data: Dict[str, Any]):
        self._resume_data = data
        if self._dynamic_agent:
            self._dynamic_agent.update_resume_data(data)
        if self.mode == AgentMode.LEGACY:
            self._init_legacy_tools()

    def process_message(self, user_message: str) -> AgentResponse:
        """
        处理用户消息（同步版本）

        Args:
            user_message: 用户输入

        Returns:
            AgentResponse 对象
        """
        self.state = AgentState.PROCESSING

        try:
            # 添加到历史
            self.chat_history.append({"role": "user", "content": user_message})

            if self.mode == AgentMode.DYNAMIC and self._dynamic_agent:
                # 使用动态任务 Agent
                result = self._dynamic_agent.process_message(user_message)

                # 同步简历数据
                if result.get("resume_modified"):
                    self._resume_data.clear()
                    self._resume_data.update(self._dynamic_agent.resume_data)

                # 构建响应
                response = AgentResponse(
                    reply=result.get("reply", ""),
                    tool_call=result.get("tool_calls", [{}])[0] if result.get("tool_calls") else None,
                    tool_result=result.get("tool_results", [{}])[0] if result.get("tool_results") else None,
                    resume_modified=result.get("resume_modified", False),
                    followup_questions=result.get("followup_questions", [])
                )

                # 添加到历史
                self.chat_history.append({"role": "assistant", "content": response.reply})

                return response

            else:
                # 兼容模式：使用规则引擎
                return self._process_with_legacy(user_message)

        except Exception as e:
            return AgentResponse(
                reply=f"抱歉，处理请求时出错：{e}",
                error=str(e)
            )
        finally:
            self.state = AgentState.IDLE

    def _process_with_legacy(self, user_message: str) -> AgentResponse:
        """
        使用规则引擎处理（兼容模式）
        """
        from .task_planner import TaskPlanner
        if not hasattr(self, 'task_planner'):
            self.task_planner = TaskPlanner()

        plan_result = self.task_planner.plan(user_message, self._resume_data)
        tool_call = plan_result.get("tool_call")
        reply = plan_result.get("reply", "")

        # 执行工具
        tool_result = None
        resume_modified = False

        if tool_call and tool_call.get("name"):
            tool_result = self._execute_tool_legacy(tool_call)
            if tool_result.get("success") and tool_call["name"] == "CVEditor":
                resume_modified = True

        self.chat_history.append({"role": "assistant", "content": reply})

        return AgentResponse(
            reply=reply,
            tool_call=tool_call,
            tool_result=tool_result,
            intent_result=plan_result.get("intent_result"),
            resume_modified=resume_modified
        )

    def _execute_tool_legacy(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        """执行工具（兼容模式）"""
        name = tool_call.get("name")
        params = tool_call.get("params", {})

        if name == "CVReader":
            return self.cv_reader._run(**params)
        elif name == "CVEditor":
            result = self.cv_editor._run(**params)
            if result.get("success"):
                self._resume_data.clear()
                self._resume_data.update(self.cv_editor.resume_data)
            return result
        else:
            return {"success": False, "message": f"未知工具: {name}"}

    async def process_message_stream(self, user_message: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        处理用户消息（流式版本）

        Yields:
            事件字典 {type, content}
        """
        self.state = AgentState.PROCESSING

        try:
            self.chat_history.append({"role": "user", "content": user_message})

            if self.mode == AgentMode.DYNAMIC and self._dynamic_agent:
                # 动态模式目前使用同步处理
                result = self._dynamic_agent.process_message(user_message)

                yield {"type": "reply", "content": result.get("reply", "")}

                if result.get("tool_calls"):
                    yield {"type": "tool_call", "content": result["tool_calls"][0]}

                if result.get("tool_results"):
                    yield {"type": "tool_result", "content": result["tool_results"][0]}

                if result.get("followup_questions"):
                    yield {"type": "followup", "content": result["followup_questions"]}

                if result.get("resume_modified"):
                    yield {"type": "resume_modified", "content": True}

            else:
                # 兼容模式
                response = self._process_with_legacy(user_message)
                yield {"type": "reply", "content": response.reply}

                if response.tool_call:
                    yield {"type": "tool_call", "content": response.tool_call}

                if response.tool_result:
                    yield {"type": "tool_result", "content": response.tool_result}

                if response.resume_modified:
                    yield {"type": "resume_modified", "content": True}

        except Exception as e:
            yield {"type": "error", "content": str(e)}

        finally:
            self.state = AgentState.IDLE
            yield {"type": "done", "content": None}

    def clear_history(self):
        """清空对话历史"""
        self.chat_history = []
        if self._dynamic_agent:
            self._dynamic_agent.clear_history()


# ==================== 便捷函数 ====================

def create_agent(
    resume_data: Optional[Dict[str, Any]] = None,
    mode: AgentMode = AgentMode.DYNAMIC,
    llm_call_fn: Optional[Callable] = None,
    enable_rag: bool = True,
    enable_star: bool = True,
    milvus_uri: str = "http://localhost:19530"
) -> CoreAgent:
    """
    创建 Agent 实例

    Args:
        resume_data: 简历数据
        mode: Agent 模式（DYNAMIC 推荐）
        llm_call_fn: LLM 调用函数
        enable_rag: 启用 RAG 知识库
        enable_star: 启用 STAR 法则追问
        milvus_uri: Milvus 服务地址

    Returns:
        CoreAgent 实例
    """
    return CoreAgent(
        resume_data=resume_data,
        mode=mode,
        llm_call_fn=llm_call_fn,
        enable_rag=enable_rag,
        enable_star=enable_star,
        milvus_uri=milvus_uri
    )


async def handle_message_stream(
    message: str,
    resume_data: Dict[str, Any],
    agent: Optional[CoreAgent] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    处理消息的便捷函数（流式）

    Args:
        message: 用户消息
        resume_data: 简历数据
        agent: 可选的 Agent 实例

    Yields:
        事件字典
    """
    if agent is None:
        agent = create_agent(resume_data=resume_data)
    else:
        agent.resume_data = resume_data

    async for event in agent.process_message_stream(message):
        yield event
