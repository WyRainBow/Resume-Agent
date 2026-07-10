import json
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
    SYSTEM_PROMPT,
)
from backend.agent.utils.resume_richtext import html_to_context_text, normalize_editor_value
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
from backend.agent.schema import Message, Role, ToolCall
from backend.agent.agent.shared_state import AgentSharedState
from backend.agent.agent.turn_state import TurnExecutionState
from backend.agent.agent.prompt_builder import PromptBuilder
from backend.agent.agent.intent_router import IntentRouter, RoutingContext
from backend.agent.agent.tool_invocation_builder import (
    ToolInvocation,
    ToolInvocationBuilder,
)
from backend.agent.agent.capability import CapabilityRegistry, ResumeCapability
from backend.agent.tool.resume_data_store import ResumeDataStore

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
        # Wave 2a-S4a:意图识别+让权守卫收口 IntentRouter。让权规则函数注入
        # (仍定义在本模块级,S4c 收口后平移)
        self._intent_router = IntentRouter(
            self._conversation_state,
            yield_reason_fn=_rule_intent_yield_reason,
            compound_request_fn=_looks_like_compound_request,
        )
        # Wave 2a-S4b:手工构造 ToolCall 的纯构造收口 ToolInvocationBuilder
        # (LLM-first 了断后仅剩 optimize-confirm 的 build_apply_optimization)
        self._tool_builder = ToolInvocationBuilder()
        return self

    def _apply_invocation(self, inv: ToolInvocation) -> bool:
        """统一落地 ToolInvocation 的副作用：写 memory、tool_calls 与优化确认 flag。"""
        for msg in inv.memory_messages:
            self.memory.add_message(msg)
        self.tool_calls = inv.tool_calls
        if inv.just_applied_optimization:
            self._just_applied_optimization = True
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
        """Process current state and decide next actions.

        LLM-first 唯一路径（2026-07-11 一次性了断）：
        1. GREETING 走专用轻通道（LLM 生成、不挂工具）
        2. optimize-confirm 确认写回走 cv_editor_agent 快路径
        3. 其余一律交给 LLM ReAct loop 自主选工具，依赖自动终止机制
        """
        # 获取最后的用户输入；同一轮内锁定只读/可写模式
        user_input = self._get_last_user_input()
        self._sync_turn_read_only_flag(user_input)
        self._sync_resume_loaded_state()

        # 防止直接编辑工具在同一轮执行后被重复触发，导致多次修改
        if self._check_edit_completion_finish():
            return False

        # 确保 ConversationStateManager 有 LLM 实例
        self._ensure_conversation_state_llm()
        # 🧠 意图识别 + 让权守卫统一收口 IntentRouter(Wave 2a-S4a);
        # decide() 契约:每轮恰好调用一次 process_input;LLM-first 唯一路径下
        # 业务意图一律让权,识别结果仅剩 GREETING 判定 + 日志参考
        route = await self._intent_router.decide(
            user_input,
            RoutingContext(
                recent_messages=self.memory.messages[-5:],
                last_ai_message=self._get_last_ai_message(),
            ),
        )
        intent = route.intent
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

        # 🎯 其他意图一律交给 LLM ReAct loop（看工具列表自主编排）
        # 动态生成提示词
        self.system_prompt, self.next_step_prompt = await self._generate_dynamic_prompts(user_input, intent)

        # 调用父类的 think 方法（会自动处理终止逻辑）
        return await super().think()

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
