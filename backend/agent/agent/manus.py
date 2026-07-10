import asyncio
import json
import os
import re
from typing import Any, Dict, List, Optional
from pathlib import Path

from pydantic import Field, model_validator, PrivateAttr

from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.config import config
from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.prompt.manus import (
    GREETING_FAST_PATH_PROMPT,
    NEXT_STEP_PROMPT,
    OPTIMIZE_SECTION_LLM_ADDENDUM,
    SYSTEM_PROMPT,
)
from backend.agent.utils.resume_richtext import html_to_context_text, normalize_editor_value
from backend.agent.prompt.load_resume import build_load_resume_fast_path_prompt
from backend.agent.tool import CVAnalyzerAgentTool, CVEditorAgentTool, CVReaderAgentTool, GenerateResumeTool, SendResumeEmailTool, ShowResumeTool, Terminate, ToolCollection
from backend.agent.tool.ask_human import AskHuman
from backend.agent.memory import (
    ChatHistoryManager,
    ConversationStateManager,
    ConversationState,
    Intent,
)
from backend.agent.application.conversation.conversation_state import (
    is_add_experience_query,
    is_read_only_query,
)
from backend.agent.utils.experience_entry import (
    OptimizeTarget,
    build_optimization_resume_patch,
    build_optimize_clarification_suggestions,
    build_optimize_plan_overview,
    detect_optimize_section_kind,
    detect_whole_optimize_mode,
    is_generic_optimize_section_query,
    list_optimize_targets,
    resolve_optimize_target,
    resolve_optimize_target_from_input,
)
from backend.agent.schema import Message, Role, ToolCall
from backend.agent.agent.shared_state import AgentSharedState
from backend.agent.agent.turn_state import TurnExecutionState
from backend.agent.agent.prompt_builder import PromptBuilder
from backend.agent.agent.intent_router import IntentRouter, RoutingContext
from backend.agent.agent.tool_invocation_builder import (
    DispatchOutcome,
    ToolInvocation,
    ToolInvocationBuilder,
)
from backend.agent.agent.resume_use_cases import ResumeUseCases
from backend.agent.agent.capability import CapabilityRegistry, ResumeCapability
from backend.agent.agent.registry import AgentRegistry
from backend.agent.agent.delegation_strategy import AgentDelegationStrategy
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.agent.analyzers.work_experience_analyzer import WorkExperienceAnalyzerAgent  # noqa: F401
from backend.agent.agent.analyzers.skills_analyzer import SkillsAnalyzerAgent  # noqa: F401
from backend.agent.agent.resume_optimizer import ResumeOptimizerAgent  # noqa: F401

LOAD_RESUME_LLM_HINT_ENABLED = (
    os.getenv("AGENT_FAST_LOAD_RESUME_LLM_HINT_ENABLED", "true").strip().lower()
    != "false"
)
EDIT_PRE_TOOL_DELAY_MS = int(
    os.getenv("AGENT_EDIT_PRE_TOOL_DELAY_MS", "450").strip() or "450"
)

# 让权守卫:消息同时含「发送动词 + 邮箱地址」时,规则意图一律弃权交还 LLM 工具循环。
# 规则层没有"发送"概念,历史上会把「把优化好的简历发给 xx@qq.com」里的"优化"抢注进
# OPTIMIZE/EDIT 分支(2026-07-10 审计 I8"组合请求被拆丢"的实锤案例)。
# 注意动词表刻意不含"改成/改为"——「把邮箱改成 new@qq.com」是合法的字段编辑,不让权。
_SEND_EMAIL_VERB_RE = re.compile(r"(发给|发送|发到|寄给|寄到|投递|投给|邮给|发邮件)")
_EMAIL_ADDR_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _has_send_email_intent(text: str) -> bool:
    t = text or ""
    return bool(_SEND_EMAIL_VERB_RE.search(t) and _EMAIL_ADDR_RE.search(t))


# 复合请求让权:规则意图只有单一出口,「优化第二段然后翻译成英文」这类组合请求
# 命中规则后后半句会被静默丢弃(审计 I8)。判定:按连接词切句,若 ≥2 段各含
# 动作动词则视为复合请求,规则弃权交 LLM 工具循环。
# 判定偏保守:只有连接词前后都出现动作动词才让权——"再优化一下"(连接词前
# 无动词的延续性单指令)不受影响。
_COMPOUND_CONJ_RE = re.compile(r"(然后|接着|顺便|并且|同时|之后再|完了再|[,，]\s*再|[,，]\s*帮我)")
_ACTION_VERB_RE = re.compile(
    r"(优化|润色|修改|改成|改为|改一下|翻译|分析|诊断|评分|生成|创建|新建|导出|下载|发送|发给|发到|寄给|投递|删除|删掉)"
)


def _looks_like_compound_request(text: str) -> bool:
    t = (text or "").strip()
    if not t or not _COMPOUND_CONJ_RE.search(t):
        return False
    segments = [seg for seg in _COMPOUND_CONJ_RE.split(t) if seg and not _COMPOUND_CONJ_RE.fullmatch(seg)]
    hits = sum(1 for seg in segments if _ACTION_VERB_RE.search(seg))
    return hits >= 2


def _rule_intent_yield_reason(text: str) -> Optional[str]:
    """规则意图的统一让权判定:返回让权原因,None 表示规则可以保留决定权。
    这是方案 §8.2「规则从拦截降级」的守卫集合,只做弃权、不做认领。"""
    if _has_send_email_intent(text):
        return "发送语义"
    if _looks_like_compound_request(text):
        return "复合请求"
    return None


def _llm_first_routing_enabled() -> bool:
    """LLM-first 路由(2026-07-10 用户拍板「所有意图都走 LLM」):开启时所有
    业务意图一律交给 ReAct loop,由 LLM 看工具列表自主编排;规则意图识别
    只降级为日志参考,不再拥有分派权。GREETING 保留专用轻通道(它本身就是
    LLM 生成,只是不挂工具、更快)。
    回滚开关:AGENT_LLM_FIRST_ROUTING=false 恢复规则分派;运行时读取,
    切换无需改代码。"""
    return os.getenv("AGENT_LLM_FIRST_ROUTING", "true").strip().lower() != "false"


class Manus(ToolCallAgent):
    """A versatile general-purpose agent with local tool orchestration.

    集成 LangChain 风格的 Memory 系统提供智能对话管理：
    - ChatHistoryManager: 管理对话历史
    - ConversationStateManager: 意图识别和状态管理
    """

    name: str = "Manus"
    description: str = "A versatile agent that can solve various tasks using multiple local tools"

    # 使用动态系统提示词
    system_prompt: str = ""
    next_step_prompt: str = ""
    session_id: Optional[str] = None
    capability: Optional[str] = None
    # 管理员会话标识:仅 admin 会话注册 send_resume_email 等管理员专属工具
    is_admin: bool = False
    # 当前会话所属用户 id,注入给需要按用户查库的工具(如邮箱凭证)
    user_id: Optional[int] = None

    max_observe: int = 10000
    max_steps: int = 20

    # Add general-purpose tools to the tool collection
    available_tools: ToolCollection = Field(default_factory=ToolCollection)

    special_tool_names: list[str] = Field(default_factory=lambda: [Terminate().name])

    # Memory components - 使用 PrivateAttr 避免 pydantic 验证
    _conversation_state: ConversationStateManager = PrivateAttr(default=None)
    _chat_history: ChatHistoryManager = PrivateAttr(default=None)
    _last_intent: Intent = PrivateAttr(default=None)
    _last_intent_info: Dict[str, Any] = PrivateAttr(default_factory=dict)
    _current_resume_path: Optional[str] = PrivateAttr(default=None)
    _just_applied_optimization: bool = PrivateAttr(default=False)  # 标记是否刚应用了优化
    _shared_state: AgentSharedState = PrivateAttr(default=None)
    _skills_cache: Dict[str, str] = PrivateAttr(default_factory=dict)
    _prompt_builder: PromptBuilder = PrivateAttr(default=None)
    _use_cases: ResumeUseCases = PrivateAttr(default=None)
    _intent_router: IntentRouter = PrivateAttr(default=None)
    _tool_builder: ToolInvocationBuilder = PrivateAttr(default=None)
    # Wave 2a-S1:原 5 个散落 flag 收拢进 TurnExecutionState。S4c-1 起内部直接读写
    # self._turn.*;仅保留 _pending_immediate_stream 委托(AgentStream 直读,
    # 保留到 2b-B1,见 spec D2)
    _turn: TurnExecutionState = PrivateAttr(default_factory=TurnExecutionState)

    @property
    def _pending_immediate_stream(self) -> Optional[Dict[str, Any]]:
        return self._turn.pending_immediate_stream

    @_pending_immediate_stream.setter
    def _pending_immediate_stream(self, value: Optional[Dict[str, Any]]) -> None:
        self._turn.pending_immediate_stream = value

    @model_validator(mode="after")
    def initialize_helper(self) -> "Manus":
        """Initialize basic components synchronously."""
        self.available_tools = self._build_tool_collection()
        self._init_shared_state()
        # 初始化对话状态管理器（LLM 会在 base.py 的 initialize_agent 中初始化）
        # 传递 tool_collection 以支持增强意图识别
        self._conversation_state = ConversationStateManager(
            llm=None,
            tool_collection=self.available_tools,
            use_enhanced_intent=True,
            session_id=self.session_id,
        )
        # 初始化聊天历史管理器
        self._chat_history = ChatHistoryManager(
            k=30,
            session_id=self.session_id,
        )  # 滑动窗口：保留最近30条消息
        # Wave 2a-S2:动态 prompt 构造迁 PromptBuilder,共享 skills 缓存
        self._prompt_builder = PromptBuilder(
            session_id=self.session_id,
            capability=self.capability,
            skills_cache=self._skills_cache,
        )
        # Wave 2a-S3:诊断/优化/委托分析迁 ResumeUseCases。llm 与流回调用
        # provider 延迟取值(llm 在此之后才初始化;流回调随流建立/清除)
        self._use_cases = ResumeUseCases(
            llm_provider=lambda: self.llm,
            session_id=self.session_id,
            turn_state=self._turn,
            base_prompt_provider=self._generate_dynamic_prompts,
            stream_callback_provider=lambda: getattr(
                self, "_stream_content_callback", None
            ),
        )
        # Wave 2a-S4a:意图识别+让权守卫收口 IntentRouter。让权规则函数注入
        # (仍定义在本模块级,S4c 收口后平移)
        self._intent_router = IntentRouter(
            self._conversation_state,
            llm_first_enabled_provider=_llm_first_routing_enabled,
            yield_reason_fn=_rule_intent_yield_reason,
            compound_request_fn=_looks_like_compound_request,
        )
        # Wave 2a-S4b:5 处手工构造 ToolCall 的纯构造收口 ToolInvocationBuilder
        self._tool_builder = ToolInvocationBuilder()
        return self

    def _apply_invocation(self, inv: ToolInvocation) -> Optional[bool]:
        """统一落地 ToolInvocation 的副作用：写 memory、结构化结果、tool_calls、
        flag，并按 outcome 决定返回值(CONTINUE→True / FINISH→False+FINISHED /
        EMIT_ONLY→None，后续段留在 think())。"""
        for msg in inv.memory_messages:
            self.memory.add_message(msg)
        self._tool_structured_results.update(inv.structured_results)
        self.tool_calls = inv.tool_calls
        if inv.finish_after_load_resume:
            self._turn.finish_after_load_resume_tool = True
        if inv.just_applied_optimization:
            self._just_applied_optimization = True
        if inv.outcome == DispatchOutcome.FINISH:
            from backend.agent.schema import AgentState
            self.state = AgentState.FINISHED
            return False
        if inv.outcome == DispatchOutcome.EMIT_ONLY:
            return None
        return True

    def _build_tool_collection(self) -> ToolCollection:
        """Build tool collection based on capability settings."""
        # 产品收敛:只做简历优化。文件/代码执行(PythonExecute/StrReplaceEditor)、
        # 浏览器(BrowserUseTool)、联网搜索(WebSearch)等通用工具全部移除——
        # 它们对网页简历产品的用户无用,还会诱导模型幻想成 CLI/浏览器 Agent
        # ("我先看看当前目录下有没有简历文件"),同时扩大安全面
        base_tools = [
            AskHuman(),
            Terminate(),
        ]
        domain_tools = [
            CVReaderAgentTool(),
            ShowResumeTool(),
            CVAnalyzerAgentTool(),
            CVEditorAgentTool(),
            GenerateResumeTool(),
        ]
        if self.is_admin:
            domain_tools.append(SendResumeEmailTool())

        capability: ResumeCapability = CapabilityRegistry.get(self.capability)
        if not capability.tool_whitelist:
            return ToolCollection(*base_tools, *domain_tools)

        whitelisted = []
        for tool in domain_tools:
            if tool.name in capability.tool_whitelist:
                whitelisted.append(tool)

        return ToolCollection(*base_tools, *whitelisted)

    def _init_shared_state(self) -> None:
        """Initialize session-scoped shared state and inject into tools."""
        session_id = self.session_id or "default"
        self._shared_state = AgentSharedState(session_id=session_id)
        ResumeDataStore.set_shared_state(session_id, self._shared_state)
        self._inject_tool_context(self.available_tools.tools)

    def _inject_tool_context(self, tools: List[Any]) -> None:
        """Attach session_id and shared_state to tools."""
        for tool in tools:
            if hasattr(tool, "session_id"):
                tool.session_id = self.session_id
            if hasattr(tool, "shared_state"):
                tool.shared_state = self._shared_state
            if hasattr(tool, "user_id"):
                tool.user_id = self.user_id

    def _ensure_conversation_state_llm(self):
        """确保 ConversationStateManager 有 LLM 实例"""
        if self._conversation_state and not self._conversation_state.llm and self.llm:
            self._conversation_state.llm = self.llm

    async def cleanup(self):
        """Clean up Manus agent resources.(浏览器工具下线后暂无需清理的资源)"""
        return None

    async def execute_tool(self, command: ToolCall) -> str:
        """只读查看轮次拦截误触发的简历编辑工具。"""
        name = ""
        if command and command.function:
            name = command.function.name or ""
        if self._turn.read_only and name in (
            "cv_editor_agent",
            "str_replace_editor",
        ):
            logger.info(f"📖 只读轮次拦截 {name} 调用")
            return (
                "错误：本轮为只读查看请求，禁止修改代码或简历。"
                "请直接根据 system prompt 中已注入的「# CV/Resume Context」完整回答，"
                "勿调用 cv_editor_agent、str_replace_editor 或任何文件编辑工具。"
            )
        return await super().execute_tool(command)

    def queue_resume_patch(self, patch: Dict[str, Any]) -> None:
        """暂存 resume_patch，由 AgentStream 在 step 结束后 emit。"""
        self._turn.queue_patch(patch)

    def drain_resume_patches(self) -> List[Dict[str, Any]]:
        """取出并清空待发送的 resume_patch 列表。"""
        return self._turn.drain_patches()

    @staticmethod
    def _is_injected_system_user_message(content: str) -> bool:
        """识别以 user 角色注入的系统指令（非真实用户输入）。"""
        text = (content or "").strip()
        if not text:
            return True
        # 仅匹配明确的系统注入格式，避免误伤长段实习/项目粘贴
        if text.startswith("## ") and "用户输入" in text[:200]:
            return True
        injected_markers = (
            "根据用户输入，请选择",
            "意图识别结果",
            "工具选择规则",
            "**重要：本轮",
        )
        return any(marker in text[:300] for marker in injected_markers)

    def _get_last_user_message_idx(self) -> int:
        """返回最后一条真实用户消息在 memory 中的下标，不存在则 -1。"""
        for idx in range(len(self.memory.messages) - 1, -1, -1):
            msg = self.memory.messages[idx]
            role_val = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
            if role_val != "user" or not msg.content:
                continue
            content = msg.content.strip()
            if not self._is_injected_system_user_message(content):
                return idx
        return -1

    def _get_last_user_input(self) -> str:
        """获取最后一条真正的用户输入（过滤系统提示词，保留长文本粘贴）。"""
        idx = self._get_last_user_message_idx()
        if idx < 0:
            return ""
        return (self.memory.messages[idx].content or "").strip()

    def _sync_turn_read_only_flag(self, user_input: str) -> None:
        """同一用户轮次内只计算一次只读标志，避免多步 think 反复重算。"""
        last_user_idx = self._get_last_user_message_idx()
        locked_idx = getattr(self, "_read_only_locked_user_idx", -2)
        if last_user_idx == locked_idx:
            return

        self._read_only_locked_user_idx = last_user_idx
        if is_add_experience_query(user_input):
            self._turn.read_only = False
        else:
            self._turn.read_only = is_read_only_query(user_input)

        if self._turn.read_only:
            logger.info("📖 只读查看轮次：禁止 cv_editor_agent")
        elif is_add_experience_query(user_input):
            logger.info("📎 新增经历轮次：允许 cv_editor_agent")

    @staticmethod
    def _extract_replace_request(user_input: str) -> Optional[tuple[str, str]]:
        text = (user_input or "").strip()
        if not text:
            return None
        # 示例:
        # - 把我的简历的腾讯改成字节跳动
        # - 把“腾讯”改为“字节跳动”
        match = re.search(
            r"把(?:我的)?(?:简历(?:里|中|上的?)?(?:的)?)?(.+?)\s*(?:改成|改为|变成)\s*[\"“”']?(.+?)[\"“”']?$",
            text,
            re.IGNORECASE,
        )
        if not match:
            return None
        old_value = (match.group(1) or "").strip().strip("\"'“”")
        new_value = (match.group(2) or "").strip().strip("\"'“”")
        if not old_value or not new_value:
            return None
        return old_value, new_value

    def _resolve_company_path_by_value(self, source_value: str) -> Optional[str]:
        resume_data = ResumeDataStore.get_data(self.session_id) or {}
        needle = (source_value or "").strip().lower()
        if not needle or not isinstance(resume_data, dict):
            return None

        def _find_path(entries: Any, prefix: str) -> Optional[str]:
            if not isinstance(entries, list):
                return None
            for idx, item in enumerate(entries):
                if not isinstance(item, dict):
                    continue
                company = str(item.get("company") or "").strip()
                if not company:
                    continue
                company_l = company.lower()
                if company_l == needle or needle in company_l:
                    return f"{prefix}[{idx}].company"
            return None

        path = _find_path(resume_data.get("experience"), "experience")
        if path:
            return path
        return _find_path(resume_data.get("internships"), "internships")

    def _resolve_primary_experience_text_path(self) -> Optional[str]:
        """为优化写回选择一个稳定的目标字段路径。"""
        resume_data = ResumeDataStore.get_data(self.session_id) or {}
        if not isinstance(resume_data, dict):
            return None
        experience = resume_data.get("experience")
        if not isinstance(experience, list) or not experience:
            return None
        first = experience[0]
        if not isinstance(first, dict):
            return None
        for field in ("details", "description", "summary", "content"):
            if isinstance(first.get(field), str):
                return f"experience[0].{field}"
        return None

    @staticmethod
    def _to_plain_text(text: str) -> str:
        """Convert rich text/markdown/html to compact plain text."""
        content = str(text or "")
        # Strip html tags
        content = re.sub(r"<[^>]+>", " ", content)
        # Strip markdown fences / emphasis
        content = content.replace("```", " ")
        content = content.replace("**", "")
        content = content.replace("__", "")
        content = content.replace("`", "")
        content = re.sub(r"\s+", " ", content).strip()
        return content

    @staticmethod
    def _dedupe_lines(text: str) -> str:
        """Drop duplicate lines while preserving order."""
        lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
        seen = set()
        out: List[str] = []
        for line in lines:
            key = re.sub(r"\s+", " ", line)
            if key in seen:
                continue
            seen.add(key)
            out.append(line)
        return "\n".join(out).strip()

    def _sanitize_optimization_text(self, text: str) -> str:
        """Sanitize optimization text before writing back to resume."""
        body = self._extract_response_body(text)
        body = re.sub(r"```(?:text|markdown|md)?", "", body, flags=re.IGNORECASE)
        body = body.replace("```", "")
        body = self._dedupe_lines(body)
        return body.strip()

    @staticmethod
    def _is_reasonable_optimization_text(text: str) -> bool:
        """Guardrail against writing repeated/oversized optimization blobs."""
        body = (text or "").strip()
        if len(body) < 80:
            return False
        if len(body) > 2600:
            return False
        # Avoid multi-round duplicated STAR blocks.
        normalized = re.sub(r"\s+", " ", body)
        for marker in (
            "Situation（情境）",
            "Task（任务）",
            "Action（行动）",
            "Result（结果）",
            "Situation (情境)",
            "Task (任务)",
            "Action (行动)",
            "Result (结果)",
        ):
            if normalized.count(marker) > 2:
                return False
        return True

    @staticmethod
    def _extract_response_body(content: str) -> str:
        """从 Thought/Response 混合文本中提取可写回正文。"""
        text = (content or "").strip()
        if not text:
            return ""
        match = re.search(r"Response[:：]\s*([\s\S]+)$", text, re.IGNORECASE)
        if match:
            text = (match.group(1) or "").strip()
        text = re.sub(r"^\s*Thought[:：][^\n]*\n?", "", text, flags=re.IGNORECASE)
        return text.strip()

    @staticmethod
    def _is_actionable_optimization_text(text: str) -> bool:
        """判定优化文本是否可直接写回（而不是反问用户补充信息）。"""
        body = (text or "").strip()
        if len(body) < 80:
            return False
        reject_markers = (
            "请提供",
            "请告诉我",
            "我需要了解",
            "请您分享",
            "为了给您提供",
            "您在腾讯参与的是什么项目",
            "让我先",
            "修改前：",
            "修改后：",
            "```",
        )
        if any(marker in body for marker in reject_markers):
            return False
        if body.count("？") + body.count("?") >= 2:
            return False
        return any(
            keyword in body
            for keyword in ("STAR", "Situation", "Action", "Result", "情境", "行动", "结果")
        )

    async def _generate_dynamic_prompts(self, user_input: str, intent: "Intent" = None) -> tuple:
        """动态 prompt 构造已迁 PromptBuilder(Wave 2a-S2),此处保留薄委托。"""
        return await self._prompt_builder.generate(
            user_input,
            intent,
            resume_loaded=self._conversation_state.context.resume_loaded,
            current_resume_path=self._current_resume_path,
            recent_messages=self.memory.messages,
        )

    def should_auto_terminate(self, content: str, tool_calls: list) -> bool:
        """自定义自动终止逻辑

        Manus 的终止策略：
        1. 如果有工具调用，不终止
        2. 如果有 next_step_prompt，不终止（需要继续生成）
        3. 如果 LLM 返回了有意义的内容（问答场景），自动终止
        4. 如果内容是系统指令的重复，不终止（可能是错误状态）
        """
        if tool_calls:
            return False

        # 🔧 修复：如果有 next_step_prompt，说明需要继续生成，不终止
        if self.next_step_prompt and self.next_step_prompt.strip():
            logger.info(f"🔄 有 next_step_prompt，继续生成流式内容（不终止）")
            # 清空 next_step_prompt，避免无限循环
            self.next_step_prompt = ""
            return False

        if not content or not content.strip():
            return False

        # 检查是否是有意义的回答（不是系统指令的重复）
        system_phrases = [
            "好的，我明白了",
            "我会直接回答",
            "如果需要使用工具",
        ]

        # 如果回答太短且包含系统短语，可能是错误状态
        for phrase in system_phrases:
            if phrase in content and len(content) < 100:
                logger.debug(f"⚠️ 检测到可能的系统短语重复，跳过自动终止")
                return False

        # 有实质性内容，自动终止
        return True

    def _check_load_resume_finish(self) -> bool:
        """LOAD_RESUME 快路径收敛：工具结果落库后本轮直接收尾。返回是否已终止。"""
        if not self._turn.finish_after_load_resume_tool:
            return False
        for msg in reversed(self.memory.messages[-8:]):
            role_val = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
            if role_val == "tool" and (msg.name or "") in {"show_resume", "cv_reader_agent"}:
                from backend.agent.schema import AgentState

                self._turn.finish_after_load_resume_tool = False
                self.state = AgentState.FINISHED
                logger.info("✅ LOAD_RESUME direct tool completed, finishing current run")
                return True
        return False

    def _check_edit_completion_finish(self) -> bool:
        """防止直接编辑工具在同一轮执行后被重复触发。返回是否已终止。"""
        # 兼容 role 可能是 Role 枚举或字符串 "tool"
        if not self.memory.messages:
            return False
        latest_assistant = self.memory.messages[-1]
        latest_assistant_role = (
            latest_assistant.role.value
            if hasattr(latest_assistant.role, "value")
            else str(latest_assistant.role)
        )
        if (
            latest_assistant_role == "assistant"
            and "已完成这次简历字段修改" in (latest_assistant.content or "")
        ):
            from backend.agent.schema import AgentState

            self.state = AgentState.FINISHED
            return True

        # 仅在“本轮用户输入之后”确实出现了 cv_editor_agent 工具结果时才收敛，
        # 避免下一轮新用户输入误复用上一轮旧编辑结果。
        last_user_idx = -1
        for idx in range(len(self.memory.messages) - 1, -1, -1):
            role_val = (
                self.memory.messages[idx].role.value
                if hasattr(self.memory.messages[idx].role, "value")
                else str(self.memory.messages[idx].role)
            )
            if role_val == "user":
                last_user_idx = idx
                break

        recent_editor_tool_msg = None
        for idx in range(len(self.memory.messages) - 1, -1, -1):
            msg = self.memory.messages[idx]
            role_val = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
            if (
                role_val == "tool"
                and (msg.name or "") == "cv_editor_agent"
                and idx > last_user_idx
            ):
                recent_editor_tool_msg = msg
                break

        if recent_editor_tool_msg is not None and not self._turn.read_only:
            logger.info("✅ cv_editor_agent 已执行，直接结束避免重复调用工具")
            # After cv_editor_agent runs, emit a short confirmation via answer
            # and stop — do NOT return True (which would let LLM pick tools again).
            confirmation = "✅ 修改已完成，请查看右侧简历预览确认效果。如需继续优化，请告诉我。"
            self.memory.add_message(Message.assistant_message(confirmation))
            from backend.agent.schema import AgentState
            self.state = AgentState.FINISHED
            return True
        return False

    def _apply_enhanced_query(self, enhanced_query: str, user_input: str) -> None:
        """查询被增强（含工具标记）时，更新最后一条用户消息为增强查询。"""
        if enhanced_query != user_input and self.memory.messages:
            # 找到最后一条用户消息并更新
            for i in range(len(self.memory.messages) - 1, -1, -1):
                msg = self.memory.messages[i]
                if msg.role == Role.USER:
                    # 更新消息内容为增强后的查询
                    msg.content = enhanced_query
                    logger.debug(f"已更新用户消息为增强查询: {enhanced_query}")
                    break

    def _store_intent_info(self, intent: Intent, intent_source: str) -> None:
        """存储本轮意图上下文，供工具结构化结果标注来源。"""
        self._last_intent_info = {
            "intent": intent.value if hasattr(intent, "value") else str(intent),
            "intent_source": intent_source,
            "trigger": (
                "load_resume_intent"
                if intent == Intent.LOAD_RESUME
                else "simple_edit_intent"
                if intent == Intent.EDIT_CV
                else "general_intent"
            ),
        }

    def _check_just_applied_finish(self) -> bool:
        """刚应用优化后，若最近出现 cv_editor_agent 成功结果则终止本轮。返回是否已终止。"""
        if not getattr(self, '_just_applied_optimization', False):
            return False
        self._just_applied_optimization = False
        recent_messages = self.memory.messages[-5:]
        has_editor_success = any(
            (
                (msg.role if isinstance(msg.role, str) else msg.role.value) == "tool"
                and msg.name == "cv_editor_agent"
                and "Successfully updated" in (msg.content or "")
            )
            for msg in recent_messages
        )

        if has_editor_success:
            logger.info("✅ 优化已应用完成，终止执行")
            self.memory.add_message(Message.assistant_message(
                "✅ 优化已应用！如果需要继续优化其他项目，请告诉我。"
            ))
            from backend.agent.schema import AgentState
            self.state = AgentState.FINISHED
            return True
        return False

    async def think(self) -> bool:
        """Process current state and decide next actions using LLM intent recognition.

        简化流程：
        1. 特殊意图（GREETING、LOAD_RESUME）直接处理
        2. 其他意图交给 LLM 自然处理，依赖自动终止机制
        """
        # 获取最后的用户输入；同一轮内锁定只读/可写模式
        user_input = self._get_last_user_input()
        self._sync_turn_read_only_flag(user_input)
        self._sync_resume_loaded_state()

        # 两阶段执行编辑：先给用户“正在修改”反馈，再在下一步实际调用编辑工具。
        if self._turn.pending_edit_tool_call:
            pending = self._turn.pending_edit_tool_call
            self._turn.pending_edit_tool_call = None
            if EDIT_PRE_TOOL_DELAY_MS > 0:
                await asyncio.sleep(EDIT_PRE_TOOL_DELAY_MS / 1000.0)
            return await self._handle_direct_tool_call(
                tool=pending["tool"],
                tool_args=pending["tool_args"],
                intent=pending["intent"],
                user_input=user_input,
                skip_pre_edit_notice=True,
            )

        # EDIT_CV（按值替换）使用规则解析 + 路径解析，直接调用工具。
        # 为避免“硬编码秒回”观感，先输出可见 Thought/Response，再下一步执行工具。
        replace_req = self._extract_replace_request(user_input)
        # LLM-first 路由下前置快路径整体退役;规则模式下让权守卫仍覆盖复合/发送语义
        if replace_req and (_llm_first_routing_enabled() or _rule_intent_yield_reason(user_input)):
            logger.info("🧭 staged-edit 快路径让权,交给 LLM 工具循环")
            replace_req = None
        if replace_req and (
            self._conversation_state.context.resume_loaded or self._has_resume_data_in_store()
        ):
            source_value, target_value = replace_req
            mapped_path = self._resolve_company_path_by_value(source_value)
            if mapped_path and mapped_path.endswith(".company"):
                logger.info(
                    "🧭 replace request mapped for direct edit: %s -> %s (path=%s)",
                    source_value,
                    target_value,
                    mapped_path,
                )
                intent = Intent.EDIT_CV
                tool = "cv_editor_agent"
                tool_args = {
                    "path": mapped_path,
                    "action": "update",
                    "value": target_value,
                }
                self._last_intent_info = {
                    "intent": intent.value if hasattr(intent, "value") else str(intent),
                    "intent_source": "fast_rule_value_replace",
                    "trigger": "simple_edit_intent",
                }
                self.memory.add_message(
                    Message.assistant_message(
                        "Thought: 我识别到你要做简历字段修改，将进行字段定位并调用工具执行更新。"
                        "Response: 收到，正在修改。完成后我会给你“修改前 / 修改后”的对比结果。"
                    )
                )
                self._turn.pending_edit_tool_call = {
                    "tool": tool,
                    "tool_args": tool_args,
                    "intent": intent,
                }
                logger.info(
                    "🧭 staged edit prepared, tool call moved to next step: %s",
                    tool_args,
                )
                return True

        # LOAD_RESUME 快路径是一次性工具调用；
        # 工具结果落库后在下一步收敛，避免重复触发同一工具直到 max_steps。
        if self._check_load_resume_finish():
            return False

        # 防止直接编辑工具在同一轮执行后被重复触发，导致多次修改
        if self._check_edit_completion_finish():
            return False

        # 确保 ConversationStateManager 有 LLM 实例
        self._ensure_conversation_state_llm()
        # 🧠 意图识别 + 让权守卫统一收口 IntentRouter(Wave 2a-S4a);
        # decide() 契约:每轮恰好调用一次 process_input,判定逻辑与原实现逐行一致
        route = await self._intent_router.decide(
            user_input,
            RoutingContext(
                recent_messages=self.memory.messages[-5:],
                last_ai_message=self._get_last_ai_message(),
                resume_available=(
                    self._conversation_state.context.resume_loaded
                    or self._has_resume_data_in_store()
                ),
            ),
        )
        intent = route.intent
        tool = route.tool
        tool_args = route.tool_args
        intent_source = route.intent_source
        enhanced_query = route.enhanced_query
        if route.compound_hint:
            # 保险提示:复合请求让权后,防止 LLM 做完第一个子任务就提前收工
            self.memory.add_message(Message.system_message(
                "用户这条请求包含多个子任务(如「优化…然后…」)。请逐个完成全部子任务,"
                "每个子任务分别调用对应工具,全部完成后再结束,不要只做第一个就停止。"
            ))

        # 如果查询被增强（包含工具标记），更新最后一条用户消息
        self._apply_enhanced_query(enhanced_query, user_input)

        # 优化确认快路径：仅当用户明确确认「应用/写回」上一轮优化建议时触发。
        # 新增经历、只读查看不得进入此分支。
        if (
            not is_read_only_query(user_input)
            and not is_add_experience_query(user_input)
            and self._looks_like_optimize_confirm(user_input)
        ):
            if await self._handle_optimize_confirm():
                logger.info("🧭 optimize confirmation mapped to cv_editor_agent")
                return True

        if (
            intent in [Intent.ANALYZE_RESUME, Intent.OPTIMIZE_SECTION, Intent.FULL_OPTIMIZE]
            and not is_add_experience_query(user_input)
        ):
            section = tool_args.get("section") if isinstance(tool_args, dict) else None
            try:
                resume_data_snapshot = ResumeDataStore.get_data(self.session_id)
                if intent == Intent.ANALYZE_RESUME and not resume_data_snapshot:
                    hint_message = await self._build_load_resume_hint_message(
                        tool="show_resume",
                        tool_args={},
                        user_input=user_input or "",
                    )
                    return self._apply_invocation(
                        self._tool_builder.build_show_resume_hint(hint_message)
                    )

                strategy = AgentDelegationStrategy.resolve(intent, section)
                analyzers = strategy.get("analyzers") if strategy else None

                if intent == Intent.ANALYZE_RESUME:
                    resume_data_snapshot = ResumeDataStore.get_data(self.session_id) or {}
                    resume_meta = self._use_cases._extract_resume_meta(resume_data_snapshot)

                    # ── 两阶段确认：首次触发时先询问目标岗位 ──
                    user_text = (user_input or "").strip()
                    _diagnosis_keywords = ["先做通用", "通用诊断", "目标岗位", "JD", "jd", "职位描述", "定向"]
                    _has_diagnosis_context = any(kw in user_text for kw in _diagnosis_keywords)

                    if not _has_diagnosis_context:
                        # Phase 1: 展示简历已读取，询问诊断方向
                        ask_message = (
                            f"已成功读取你的简历《{resume_meta.get('name', '当前简历')}》，在开始诊断前，我想了解一下你的目标：\n\n"
                            "%%SUGGESTIONS%%"
                            '[{"text":"告诉我目标岗位名称","msg":"","template":"我的目标岗位是{input}，请基于这个方向做诊断"},'
                            '{"text":"发送目标职位的 JD","msg":"我有一份目标职位的 JD，请根据 JD 做定向匹配诊断"},'
                            '{"text":"先做通用简历诊断","msg":"先做通用简历诊断吧，暂不指定岗位"}'
                            ']%%END%%'
                        )
                        result = self._apply_invocation(
                            self._tool_builder.build_diagnosis_phase1(resume_meta, ask_message)
                        )
                        logger.info("✅ ANALYZE_RESUME Phase 1: asked for target position")
                        return result

                    # Phase 2: 用户已选择诊断方向，执行完整诊断
                    logger.info(f"✅ ANALYZE_RESUME Phase 2: proceeding with diagnosis (context: {user_text[:50]})")

                    # 1. 并行委托分析器（获取结构化评分/问题）
                    analysis_results = await self._use_cases._parallel_delegate_analyzers(analyzers or [])
                    diagnosis_payload = self._use_cases._build_resume_diagnosis_payload(
                        analysis_results,
                        resume_data_snapshot,
                    )

                    # 2. 显式发出两步工具调用序列（用于前端 tool cards）
                    #    EMIT_ONLY:只落工具事件,下面 qwq 流式段留在 think() 继续执行
                    self._apply_invocation(
                        self._tool_builder.build_diagnosis_phase2(diagnosis_payload)
                    )

                    # 3. 用 qwq-plus 流式生成诊断报告（thinking token → thought，content → answer）
                    import asyncio as _asyncio
                    thinking_q: _asyncio.Queue = _asyncio.Queue()
                    content_q: _asyncio.Queue = _asyncio.Queue()

                    diagnosis_prompt = diagnosis_payload["response"]  # 结构化报告文本（作为参考）
                    qwq_system = (
                        f"你是一位资深 HR，正在从招聘者视角对简历《{resume_meta['name']}》进行诊断分析。\n\n"
                        "## 思考阶段要求\n"
                        "请像 HR 逐行审阅简历一样，按以下检查清单逐项扫描，在思考过程中标注每项是否通过：\n"
                        "1. 基本信息：姓名、联系方式、简历标题是否完整规范\n"
                        "2. 教育经历：学校、专业、时间、GPA/排名是否完整\n"
                        "3. 工作/实习经历：段数是否合理（2-4段），描述是否有量化成果，是否用 STAR 法则\n"
                        "4. 技能标签：是否有技能分类，是否有熟练度标注\n"
                        "5. 项目经历：是否有背景、角色、成果的完整描述\n"
                        "6. 整体排版：是否有空模块、重复内容、格式不一致\n\n"
                        "## 输出阶段要求\n"
                        "输出一份结构化的简历诊断报告，包含：\n"
                        "- 初筛通过概率\n- 三维评分卡（内容质量/竞争力/岗位匹配度）\n"
                        "- 问题清单（必须修改/建议修改/可选优化）\n- Top 3 行动建议\n- 下一步引导\n"
                        "输出语言：中文。直接输出报告，不要说'好的'或重复用户的话。"
                    )
                    qwq_user = (
                        f"以下是已完成的结构化分析结果，请基于此以流畅的中文输出诊断报告：\n\n{diagnosis_prompt}"
                    )

                    async def _on_thinking(piece: str) -> None:
                        await thinking_q.put(piece)

                    async def _on_content(piece: str) -> None:
                        await content_q.put(piece)

                    _sentinel = object()

                    async def _run_qwq() -> None:
                        try:
                            await self.llm.ask_with_thinking_stream(
                                messages=[{"role": "user", "content": qwq_user}],
                                system_msgs=[{"role": "system", "content": qwq_system}],
                                model="qwq-plus",
                                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                                api_key=os.environ.get("DASHSCOPE_API_KEY", self.llm.api_key),
                                max_tokens=8192,
                                on_thinking_delta=_on_thinking,
                                on_content_delta=_on_content,
                            )
                        except Exception as _qwq_err:
                            logger.warning(f"qwq-plus streaming failed: {_qwq_err}, using static report")
                        finally:
                            await thinking_q.put(_sentinel)
                            await content_q.put(_sentinel)

                    qwq_task = asyncio.create_task(_run_qwq())

                    # 把 queue 引用存到 pending，让 execute loop 消费
                    self._pending_immediate_stream = {
                        "type": "thinking_stream",
                        "thinking_q": thinking_q,
                        "content_q": content_q,
                        "sentinel": _sentinel,
                        "fallback_thought": diagnosis_payload["thought"],
                        "fallback_response": diagnosis_payload["response"],
                        "qwq_task": qwq_task,
                    }

                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    logger.info("✅ ANALYZE_RESUME: qwq-plus streaming started")
                    return False

                if intent == Intent.OPTIMIZE_SECTION:
                    resume_snapshot = resume_data_snapshot or {}
                    from backend.agent.schema import AgentState

                    # 会话级 JD 记忆：消息里带目标岗位 JD 就记下来，本会话后续优化都自动对齐
                    if "【目标岗位 JD】" in (user_input or ""):
                        jd_text = user_input.split("【目标岗位 JD】", 1)[1].strip()
                        if jd_text:
                            ResumeDataStore.set_session_jd(self.session_id, jd_text)
                            logger.info("📌 已记录会话 JD（%d 字）", len(jd_text))

                    def _finish_optimize(msg: str) -> bool:
                        self.memory.add_message(Message.assistant_message(msg))
                        self.state = AgentState.FINISHED
                        return False

                    # 1. 整份优化按明确程度分两档（过程透明）：
                    #    explicit（整份/全部/一起优化）→ 直接执行；
                    #    soft（优化简历/我的简历）→ 先回「优化计划」清单让用户选。
                    whole_mode = detect_whole_optimize_mode(user_input)
                    if whole_mode == "explicit":
                        whole_reply, _ = await self._use_cases._optimize_whole_resume(
                            user_input, resume_snapshot
                        )
                        logger.info("🎯 OPTIMIZE_SECTION: whole-resume optimize (explicit)")
                        return _finish_optimize(whole_reply)
                    if whole_mode == "soft":
                        plan_summary, plan_items, plan_total = build_optimize_plan_overview(
                            resume_snapshot
                        )
                        if plan_total <= 0:
                            return _finish_optimize(
                                "当前简历里还没有可优化的内容，先导入简历或补一段经历，"
                                "我再帮你优化。"
                            )
                        logger.info("🎯 OPTIMIZE_SECTION: whole-optimize plan (soft)")
                        return _finish_optimize(
                            f"我看了你的简历，可优化的部分有：{plan_summary}（共 {plan_total} 处）。"
                            "想全部一起优化、还是先从某一部分开始？\n\n"
                            f"%%SUGGESTIONS%%{json.dumps(plan_items, ensure_ascii=False)}%%END%%"
                        )

                    recent_assistant = [
                        (m.content or "")
                        for m in self.memory.messages
                        if hasattr(m, "role") and (
                            m.role if isinstance(m.role, str) else m.role.value
                        ) == "assistant"
                    ][-5:]

                    # 2. 精确命中某段（公司/项目名）。
                    # 用户点名了 section 类型（如「优化荣誉奖项」）时只做输入内精确匹配，
                    # 不做上下文推断——避免被上一轮讨论的其它段落劫持。
                    section_kind = detect_optimize_section_kind(user_input)
                    if section_kind is None:
                        optimize_target = resolve_optimize_target(
                            user_input, recent_assistant, resume_snapshot
                        )
                    else:
                        optimize_target = resolve_optimize_target_from_input(
                            user_input, resume_snapshot
                        )
                    if optimize_target is not None:
                        section_kind = None

                    # 3. 技能 / 自我评价：单字段优化（Bug 2）
                    if optimize_target is None and section_kind in ("skills", "selfEvaluation"):
                        field, field_label = (
                            ("skillContent", "专业技能")
                            if section_kind == "skills"
                            else ("selfEvaluation", "自我评价")
                        )
                        field_val = resume_snapshot.get(field)
                        if not (isinstance(field_val, str) and field_val.strip()):
                            return _finish_optimize(
                                f"当前简历里还没有{field_label}内容，先补一段，我再帮你优化～"
                            )
                        field_sugg = await self._use_cases._llm_optimize_field_patch(
                            user_input, resume_snapshot, field, field_label
                        )
                        items = (field_sugg or {}).get("optimization_suggestions") or []
                        patch_count = self._use_cases._queue_optimization_patches(items)
                        logger.info("🎯 OPTIMIZE_SECTION: field optimize field=%s", field)
                        return _finish_optimize(
                            self._use_cases._optimization_assistant_reply(
                                field_sugg or {"optimization_suggestions": []},
                                patch_count=patch_count,
                                default_label=field_label,
                                with_next=True,
                            )
                        )

                    # 4. section 类型收窄（实习/项目/开源/教育/奖项）——Bug 1：优化实习就只列实习
                    if optimize_target is None and section_kind in (
                        "experience",
                        "projects",
                        "opensource",
                        "education",
                        "awards",
                    ):
                        kind_targets = list_optimize_targets(resume_snapshot, section_kind)
                        section_cn = {
                            "experience": "实习/工作经历",
                            "projects": "项目经历",
                            "opensource": "开源经历",
                            "education": "教育经历",
                            "awards": "荣誉奖项",
                        }[section_kind]
                        if not kind_targets:
                            if section_kind in ("education", "awards"):
                                return _finish_optimize(
                                    f"当前简历的{section_cn}还没有填写描述内容，"
                                    "先在编辑器里补一段描述，我再帮你润色～"
                                )
                            return _finish_optimize(
                                f"当前简历里还没有可优化的{section_cn}。先导入或补一段，我再帮你优化～"
                            )
                        if len(kind_targets) == 1:
                            optimize_target = kind_targets[0]
                        else:
                            logger.info(
                                "🎯 OPTIMIZE_SECTION: scoped clarification kind=%s", section_kind
                            )
                            return _finish_optimize(
                                self._use_cases._build_optimize_target_clarification_message(
                                    resume_snapshot,
                                    intro=f"你有 {len(kind_targets)} 段{section_cn}，想先优化哪一段？",
                                    section_kind=section_kind,
                                )
                            )

                    # 5. 泛化（优化经历/优化）或未匹配 → 全部 targets 判断
                    all_targets = list_optimize_targets(resume_snapshot)
                    if optimize_target is None:
                        if not all_targets:
                            return _finish_optimize(
                                "当前简历里还没有可优化的实习/工作、项目或开源经历。"
                                "您可以先导入一段，再让我帮您优化表述。"
                            )
                        if len(all_targets) > 1:
                            if is_generic_optimize_section_query(user_input):
                                intro = "好的！想先优化哪一段？也可以直接优化整份："
                            else:
                                from backend.agent.utils.experience_entry import (
                                    _clean_experience_query_fragment,
                                    _normalize_optimize_query_text,
                                )

                                core = _clean_experience_query_fragment(
                                    _normalize_optimize_query_text(user_input or "")
                                )
                                label = re.sub(r"\*+", "", core).strip() or "该段"
                                intro = f"没精准找到「{label}」，你可以从下面选，或直接优化整份："
                            logger.info("✅ OPTIMIZE_SECTION: clarification (all)")
                            return _finish_optimize(
                                self._use_cases._build_optimize_target_clarification_message(
                                    resume_snapshot, intro=intro
                                )
                            )
                        optimize_target = all_targets[0]

                    # 6. 优化选定的单段 + 引导下一步
                    logger.info(
                        "🎯 OPTIMIZE_SECTION: target=%s[%s].%s kind=%s",
                        optimize_target.array_path,
                        optimize_target.index,
                        optimize_target.value_field,
                        optimize_target.section_kind,
                    )
                    suggestions = await self._use_cases._llm_optimize_section_patch(
                        user_input, resume_snapshot, optimize_target
                    )
                    suggestions_list = (suggestions or {}).get("optimization_suggestions") or []
                    patch_count = self._use_cases._queue_optimization_patches(suggestions_list)
                    refine_section_cn = {
                        "experience": "实习经历",
                        "projects": "项目经历",
                        "opensource": "开源经历",
                        "education": "教育经历",
                        "awards": "荣誉奖项",
                    }.get(optimize_target.section_kind, "实习经历")
                    return _finish_optimize(
                        self._use_cases._optimization_assistant_reply(
                            suggestions or {"optimization_suggestions": []},
                            patch_count=patch_count,
                            default_label=optimize_target.label or "该段经历",
                            with_next=True,
                            refine_label=optimize_target.label or "",
                            refine_section_cn=refine_section_cn,
                        )
                    )

                if intent == Intent.FULL_OPTIMIZE:
                    # 「全面/整体/全局优化」走整份优化：覆盖所有实习/工作、项目、开源 + 技能 + 自我评价，
                    # 逐段生成优化对比卡（比只做工作经历的旧 resume_optimizer 更全）。
                    resume_snapshot = resume_data_snapshot or {}
                    whole_reply, _ = await self._use_cases._optimize_whole_resume(
                        user_input, resume_snapshot
                    )
                    self.memory.add_message(Message.assistant_message(whole_reply))
                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    logger.info("🎯 FULL_OPTIMIZE: whole-resume optimize")
                    return False
            except Exception as exc:
                logger.warning(f"委托子 Agent 失败，回退到 LLM 路径: {exc}")

        # 存储本轮意图上下文，供工具结构化结果标注来源
        self._store_intent_info(intent, intent_source)

        # 🔑 特殊处理：检查是否刚应用了优化
        if self._check_just_applied_finish():
            return False

        # 🎯 GREETING：直接调用 LLM，不传工具（减少 payload，速度更快）
        if intent == Intent.GREETING:
            logger.info("👋 GREETING: fast path without tools")
            base_system_prompt, _ = await self._generate_dynamic_prompts(user_input, intent)
            system_content = f"{base_system_prompt}\n\n{GREETING_FAST_PATH_PROMPT}"
            greeting_fallback = (
                "Thought: 用户打招呼，热情回应并介绍三种上手方式。\n"
                "Response: 你好 👋 我是 coco。想做简历？说说你的经历我帮你生成，或导入现成简历，也能选一份已有的接着改。"
            )
            try:
                raw = await self.llm.ask(
                    messages=[{"role": "user", "content": user_input}],
                    system_msgs=[{"role": "system", "content": system_content}],
                    stream=False,
                    temperature=0.8,  # 问候要有变化,拉高多样性
                )
                if raw and raw.strip():
                    self.memory.add_message(Message.assistant_message(raw.strip()))
                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    return False
            except Exception as _greeting_err:
                logger.warning(f"👋 GREETING fast path failed, falling back: {_greeting_err}")
            self.memory.add_message(Message.assistant_message(greeting_fallback))
            from backend.agent.schema import AgentState
            self.state = AgentState.FINISHED
            return False

        # 🎯 LOAD_RESUME 意图：直接调用工具
        if tool and self._conversation_state.should_use_tool_directly(intent):
            return await self._handle_direct_tool_call(tool, tool_args, intent, user_input)

        # 🎯 其他意图：交给 LLM 自然处理
        # 动态生成提示词
        self.system_prompt, self.next_step_prompt = await self._generate_dynamic_prompts(user_input, intent)

        # 调用父类的 think 方法（会自动处理终止逻辑）
        return await super().think()

    async def _handle_direct_tool_call(
        self,
        tool: str,
        tool_args: dict,
        intent: "Intent",
        user_input: Optional[str] = None,
        skip_pre_edit_notice: bool = False,
    ) -> bool:
        """直接调用工具，跳过 LLM 决策"""
        # EDIT_CV 需要先有已加载简历；否则先切到加载入口避免空改失败。
        if intent == Intent.EDIT_CV and not (
            self._conversation_state.context.resume_loaded or self._has_resume_data_in_store()
        ):
            logger.info("🧭 EDIT_CV requested without loaded resume, fallback to show_resume")
            tool = "show_resume"
            tool_args = {}
            intent = Intent.LOAD_RESUME

        # 🚨 特殊处理：cv_reader_agent 需要文件路径
        # 如果 tool_args 为空但有 _current_resume_path，使用它
        # (补全须先于下面的 LOAD_RESUME hint LLM 调用——hint 读取 tool_args["file_path"]，
        #  故留在 Manus 而非 builder)
        if tool == "cv_reader_agent" and not tool_args.get("file_path"):
            if self._current_resume_path:
                tool_args["file_path"] = self._current_resume_path
                logger.info(f"📄 使用 _current_resume_path: {self._current_resume_path}")

        # LOAD_RESUME hint 的 LLM 调用是决策，留在 Manus；hint 算好后传入 builder
        load_resume_hint = None
        if intent == Intent.LOAD_RESUME:
            load_resume_hint = await self._build_load_resume_hint_message(
                tool=tool,
                tool_args=tool_args,
                user_input=user_input or "",
            )

        result = self._apply_invocation(
            self._tool_builder.build_direct_tool_call(
                tool,
                tool_args,
                intent,
                load_resume_hint=load_resume_hint,
                skip_pre_edit_notice=skip_pre_edit_notice,
            )
        )
        logger.info(f"🔧 直接调用工具: {tool}, 参数: {tool_args}")
        return result

    async def _build_load_resume_hint_message(
        self,
        tool: str,
        tool_args: Dict[str, Any],
        user_input: str,
    ) -> str:
        """Build short Thought/Response for LOAD_RESUME with optional LLM style guidance."""
        fallback = (
            "Thought: 我识别到你要加载简历，先执行对应工具流程。\n"
            "Response: 正在处理，请稍等。"
        )
        if tool == "cv_reader_agent":
            fallback = (
                "Thought: 我识别到你要加载指定简历文件，将尝试按路径读取。\n"
                "Response: 我正在为你加载该简历文件，稍后会把结果展示到当前会话。"
            )
        elif tool == "show_resume":
            fallback = (
                "Thought: 我识别到你想开始处理简历，介绍几种上手方式。\n"
                "Response: 三种方式随你：说说你的经历我帮你生成、导入现成简历，或说「选择已有简历」从列表加载。"
            )

        if not LOAD_RESUME_LLM_HINT_ENABLED or not getattr(self, "llm", None):
            return fallback

        file_path = ""
        if isinstance(tool_args, dict):
            file_path = str(tool_args.get("file_path") or "").strip()

        prompt = build_load_resume_fast_path_prompt(tool_name=tool, file_path=file_path)
        llm_input = user_input.strip() or "加载我的简历"

        try:
            raw = await self.llm.ask(
                messages=[{"role": "user", "content": llm_input}],
                system_msgs=[{"role": "system", "content": prompt}],
                stream=False,
                temperature=0.2,
            )
            parsed = self._normalize_thought_response(raw)
            return parsed or fallback
        except Exception as exc:
            logger.warning(f"LOAD_RESUME LLM hint generation failed, fallback to template: {exc}")
            return fallback

    @staticmethod
    def _normalize_thought_response(text: str) -> str:
        """Normalize model output into strict two-line Thought/Response format."""
        if not text:
            return ""

        thought = ""
        response = ""
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.lower().startswith("thought:"):
                thought = line.split(":", 1)[1].strip()
            elif line.lower().startswith("response:"):
                response = line.split(":", 1)[1].strip()

        if not thought or not response:
            # Fallback parser for loosely formatted output.
            cleaned = text.replace("\r", "").strip()
            m = re.search(r"Thought[:：]\s*(.+?)\n+Response[:：]\s*(.+)$", cleaned, re.IGNORECASE | re.DOTALL)
            if m:
                thought = (m.group(1) or "").strip()
                response = (m.group(2) or "").strip()

        if not thought or not response:
            return ""
        return f"Thought: {thought}\nResponse: {response}"

    @staticmethod
    def _looks_like_optimize_confirm(text: str) -> bool:
        """仅匹配用户明确确认应用上一轮优化建议的短句，避免正文里的「优化」「应用」误触发。"""
        normalized = (text or "").strip().lower()
        if not normalized or len(normalized) > 80:
            return False
        if is_add_experience_query(normalized) or is_read_only_query(normalized):
            return False
        explicit = (
            r"^(可以|好的|同意|确认|请).{0,12}(应用|写回|更新|保存)",
            r"^(应用|写回|确认应用).{0,12}(优化|修改|建议|吧|了)?$",
            r"^就按.{0,8}(优化|建议|方案)",
            r"^直接(应用|写回|更新)",
        )
        if any(re.search(p, normalized) for p in explicit):
            return True
        # 极短确认：≤12 字且同时含确认词 + 写回词（排除单字「行」）
        if len(normalized) <= 12:
            has_confirm = bool(re.search(r"(可以|好的|同意|确认|请|就按)", normalized))
            has_apply = bool(re.search(r"(应用优化|写回|更新到|保存)", normalized))
            return has_confirm and has_apply
        return False

    async def _handle_optimize_confirm(self) -> bool:
        """处理用户确认优化意图"""
        import re

        # 从之前的分析结果中提取最推荐的优化
        edit_path = None
        edit_value = None
        suggestion_title = None

        for msg in reversed(self.memory.messages[-10:]):
            role_val = msg.role if isinstance(msg.role, str) else msg.role.value
            if role_val == "tool" and msg.name == 'cv_analyzer_agent':
                content = msg.content
                try:
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
                    json_str = json_match.group(1) if json_match else content

                    data = json.loads(json_str)
                    suggestions = data.get("optimization_suggestions") or data.get("optimizationSuggestions", [])

                    if suggestions and len(suggestions) > 0:
                        first_suggestion = suggestions[0]
                        edit_path = first_suggestion.get("apply_path")
                        edit_value = self._sanitize_optimization_text(
                            str(first_suggestion.get("optimized") or "")
                        )
                        suggestion_title = first_suggestion.get("title", "优化建议")

                        if (
                            edit_path
                            and edit_value
                            and self._is_actionable_optimization_text(str(edit_value))
                            and self._is_reasonable_optimization_text(str(edit_value))
                        ):
                            result = self._apply_invocation(
                                self._tool_builder.build_apply_optimization(
                                    edit_path, edit_value, suggestion_title
                                )
                            )
                            logger.info(f"🔧 应用优化: {edit_path} = {edit_value}")
                            return result
                except (json.JSONDecodeError, KeyError) as e:
                    logger.debug(f"解析优化建议失败: {e}")
                    continue

        # 无结构化优化建议时交给 LLM，禁止 STAR/通用模板兜底写回
        logger.info("⚠️ optimize confirm: no actionable suggestion from analyzer, defer to LLM")
        return False

    def _get_last_ai_message(self) -> Optional[str]:
        """获取最后一条 AI 消息内容"""
        for msg in reversed(self.memory.messages[-3:]):
            if msg.role == Role.ASSISTANT and msg.content:
                return msg.content[:500]
        return None

    def _has_resume_data_in_store(self) -> bool:
        """检查当前会话是否已有可用简历数据。"""
        resume_data = ResumeDataStore.get_data(self.session_id)
        return isinstance(resume_data, dict) and len(resume_data) > 0

    def _sync_resume_loaded_state(self) -> None:
        """
        根据 ResumeDataStore 同步 resume_loaded。

        某些轮次前端已传入 resume_data，但状态机仍为 resume_loaded=False，
        会误触发“请先加载简历”。这里以数据存在性作为兜底真值源。
        """
        if self._conversation_state.context.resume_loaded:
            return
        if not self._has_resume_data_in_store():
            return
        self._conversation_state.update_resume_loaded(True)
        logger.info("📋 resume_loaded state synced from ResumeDataStore")

    async def act(self) -> str:
        """Execute tool calls and update conversation state."""
        result = await super().act()

        # 更新对话状态管理器
        if self.tool_calls:
            for tool_call in self.tool_calls:
                tool_name = tool_call.function.name
                self._conversation_state.update_after_tool(tool_name, result)

                # 特殊处理：加载简历后更新状态
                if "load_resume" in tool_name.lower() or "cv_reader" in tool_name.lower():
                    # 检测简历是否成功加载（更宽松的条件）
                    if result and ("CV/Resume Context" in result or "Basic Information" in result or "Education" in result or "成功" in result):
                        self._conversation_state.update_resume_loaded(True)
                        logger.info("📋 简历已成功加载，状态已更新")

        # 同步消息到 ChatHistory
        if self._chat_history:
            # 添加最近的 assistant 消息
            for msg in reversed(self.memory.messages[-5:]):
                if msg.role == Role.ASSISTANT and msg.content:
                    # 检查是否已经添加过（避免重复）
                    history_messages = self._chat_history.get_messages()
                    if not history_messages or history_messages[-1].content != msg.content:
                        self._chat_history.add_message(msg)
                    break

        # 检查是否应该等待用户输入
        if self._chat_history:
            # 检查工具返回的结果
            tool_result = result if result else None

            # 检查最后的 AI 消息（用于调试）
            last_ai_msg = None
            for msg in reversed(self.memory.messages[-3:]):
                if msg.role == Role.ASSISTANT and msg.content:
                    last_ai_msg = msg.content
                    break

        return result
