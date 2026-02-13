import asyncio
import json
from typing import Any, Dict, List, Optional
from pathlib import Path

from pydantic import Field, model_validator, PrivateAttr

from backend.agent.agent.browser import BrowserContextHelper
from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.config import config
from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.prompt.manus import NEXT_STEP_PROMPT, SYSTEM_PROMPT
from backend.agent.tool import CVAnalyzerAgentTool, CVEditorAgentTool, CVReaderAgentTool, EducationAnalyzerTool, ShowResumeTool, Terminate, ToolCollection, WebSearch
try:
    from backend.agent.tool import BrowserUseTool
except ImportError:
    BrowserUseTool = None
from backend.agent.tool.ask_human import AskHuman
from backend.agent.tool.mcp import MCPClients, MCPClientTool
from backend.agent.tool.python_execute import PythonExecute
from backend.agent.tool.str_replace_editor import StrReplaceEditor
from backend.agent.memory import (
    ChatHistoryManager,
    ConversationStateManager,
    ConversationState,
    Intent,
)
from backend.agent.schema import Message, Role
from backend.agent.agent.shared_state import AgentSharedState
from backend.agent.agent.capability import CapabilityRegistry, ResumeCapability
from backend.agent.agent.registry import AgentRegistry
from backend.agent.agent.delegation_strategy import AgentDelegationStrategy
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.agent.analyzers.work_experience_analyzer import WorkExperienceAnalyzerAgent  # noqa: F401
from backend.agent.agent.analyzers.education_analyzer import EducationAnalyzerAgent  # noqa: F401
from backend.agent.agent.analyzers.skills_analyzer import SkillsAnalyzerAgent  # noqa: F401
from backend.agent.agent.resume_optimizer import ResumeOptimizerAgent  # noqa: F401


class Manus(ToolCallAgent):
    """A versatile general-purpose agent with support for both local and MCP tools.

    集成 LangChain 风格的 Memory 系统提供智能对话管理：
    - ChatHistoryManager: 管理对话历史
    - ConversationStateManager: 意图识别和状态管理
    """

    name: str = "Manus"
    description: str = "A versatile agent that can solve various tasks using multiple tools including MCP-based tools"

    # 使用动态系统提示词
    system_prompt: str = ""
    next_step_prompt: str = ""
    session_id: Optional[str] = None
    capability: Optional[str] = None

    max_observe: int = 10000
    max_steps: int = 20

    # MCP clients for remote tool access
    mcp_clients: MCPClients = Field(default_factory=MCPClients)

    # Add general-purpose tools to the tool collection
    available_tools: ToolCollection = Field(default_factory=ToolCollection)

    special_tool_names: list[str] = Field(default_factory=lambda: [Terminate().name])
    browser_context_helper: Optional[BrowserContextHelper] = None

    # Track connected MCP servers
    connected_servers: Dict[str, str] = Field(
        default_factory=dict
    )  # server_id -> url/command
    _initialized: bool = False

    # Memory components - 使用 PrivateAttr 避免 pydantic 验证
    _conversation_state: ConversationStateManager = PrivateAttr(default=None)
    _chat_history: ChatHistoryManager = PrivateAttr(default=None)
    _last_intent: Intent = PrivateAttr(default=None)
    _last_intent_info: Dict[str, Any] = PrivateAttr(default_factory=dict)
    _current_resume_path: Optional[str] = PrivateAttr(default=None)
    _just_applied_optimization: bool = PrivateAttr(default=False)  # 标记是否刚应用了优化
    _shared_state: AgentSharedState = PrivateAttr(default=None)
    _skills_cache: Dict[str, str] = PrivateAttr(default_factory=dict)

    @model_validator(mode="after")
    def initialize_helper(self) -> "Manus":
        """Initialize basic components synchronously."""
        self.available_tools = self._build_tool_collection()
        self.browser_context_helper = BrowserContextHelper(self)
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
        return self

    def _build_tool_collection(self) -> ToolCollection:
        """Build tool collection based on capability settings."""
        base_tools = [
            PythonExecute(),
            StrReplaceEditor(),
            WebSearch(),
            AskHuman(),
            Terminate(),
        ]
        if BrowserUseTool is not None:
            base_tools.insert(1, BrowserUseTool())
        domain_tools = [
            CVReaderAgentTool(),
            ShowResumeTool(),
            CVAnalyzerAgentTool(),
            CVEditorAgentTool(),
            EducationAnalyzerTool(),
        ]

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

    def _ensure_conversation_state_llm(self):
        """确保 ConversationStateManager 有 LLM 实例"""
        if self._conversation_state and not self._conversation_state.llm and self.llm:
            self._conversation_state.llm = self.llm

    @classmethod
    async def create(cls, **kwargs) -> "Manus":
        """Factory method to create and properly initialize a Manus instance."""
        instance = cls(**kwargs)
        await instance.initialize_mcp_servers()
        instance._initialized = True
        return instance

    async def initialize_mcp_servers(self) -> None:
        """Initialize connections to configured MCP servers."""
        for server_id, server_config in config.mcp_config.servers.items():
            try:
                if server_config.type == "sse":
                    if server_config.url:
                        await self.connect_mcp_server(server_config.url, server_id)
                        logger.info(
                            f"Connected to MCP server {server_id} at {server_config.url}"
                        )
                elif server_config.type == "stdio":
                    if server_config.command:
                        await self.connect_mcp_server(
                            server_config.command,
                            server_id,
                            use_stdio=True,
                            stdio_args=server_config.args,
                        )
                        logger.info(
                            f"Connected to MCP server {server_id} using command {server_config.command}"
                        )
            except Exception as e:
                logger.error(f"Failed to connect to MCP server {server_id}: {e}")

    async def connect_mcp_server(
        self,
        server_url: str,
        server_id: str = "",
        use_stdio: bool = False,
        stdio_args: List[str] = None,
    ) -> None:
        """Connect to an MCP server and add its tools."""
        if use_stdio:
            await self.mcp_clients.connect_stdio(
                server_url, stdio_args or [], server_id
            )
            self.connected_servers[server_id or server_url] = server_url
        else:
            await self.mcp_clients.connect_sse(server_url, server_id)
            self.connected_servers[server_id or server_url] = server_url

        # Update available tools with only the new tools from this server
        new_tools = [
            tool for tool in self.mcp_clients.tools if tool.server_id == server_id
        ]
        self.available_tools.add_tools(*new_tools)
        self._inject_tool_context(new_tools)

    async def disconnect_mcp_server(self, server_id: str = "") -> None:
        """Disconnect from an MCP server and remove its tools."""
        await self.mcp_clients.disconnect(server_id)
        if server_id:
            self.connected_servers.pop(server_id, None)
        else:
            self.connected_servers.clear()

        # Rebuild available tools without the disconnected server's tools
        base_tools = [
            tool
            for tool in self.available_tools.tools
            if not isinstance(tool, MCPClientTool)
        ]
        self.available_tools = ToolCollection(*base_tools)
        self.available_tools.add_tools(*self.mcp_clients.tools)

    async def cleanup(self):
        """Clean up Manus agent resources."""
        if self.browser_context_helper:
            await self.browser_context_helper.cleanup_browser()
        # Disconnect from all MCP servers only if we were initialized
        if self._initialized:
            await self.disconnect_mcp_server()
            self._initialized = False

    async def delegate_to_agent(self, agent_name: str, **kwargs) -> Any:
        """Delegate tasks to a registered sub-agent."""
        agent = AgentRegistry.create(agent_name, session_id=self.session_id)

        resume_data = kwargs.get("resume_data")
        if resume_data is None:
            resume_data = ResumeDataStore.get_data(self.session_id)

        if hasattr(agent, "analyze"):
            return await agent.analyze(resume_data)

        analysis_results = kwargs.get("analysis_results")
        if hasattr(agent, "optimize") and analysis_results is not None:
            optimize_fn = agent.optimize
            if callable(optimize_fn):
                result = optimize_fn(analysis_results, resume_data=resume_data)
                if hasattr(result, "__await__"):
                    return await result
                return result

        if hasattr(agent, "chat") and kwargs.get("message"):
            return await agent.chat(kwargs["message"], resume_data=resume_data)

        raise ValueError(f"Unsupported delegation target: {agent_name}")

    async def _run_delegated_analysis(self, section: Optional[str]) -> List[Dict[str, Any]]:
        """Run delegated analysis for given section or all."""
        analyzers = self._resolve_analyzers_by_section(section)
        return await self._parallel_delegate_analyzers(analyzers)

    async def _parallel_delegate_analyzers(self, analyzers: List[str]) -> List[Dict[str, Any]]:
        """并行委托给分析 Agent。"""
        if not analyzers:
            return []
        tasks = [self.delegate_to_agent(name) for name in analyzers]
        results = await asyncio.gather(*tasks)
        return results

    def _resolve_analyzers_by_section(self, section: Optional[str]) -> List[str]:
        """Resolve analyzers list by section."""
        if not section:
            return [
                "work_experience_analyzer",
                "education_analyzer_agent",
                "skills_analyzer",
            ]

        normalized = section.lower()
        if "工作" in normalized:
            return ["work_experience_analyzer"]
        if "教育" in normalized:
            return ["education_analyzer_agent"]
        if "技能" in normalized or "技术" in normalized:
            return ["skills_analyzer"]
        return [
            "work_experience_analyzer",
            "education_analyzer_agent",
            "skills_analyzer",
        ]

    def _format_analysis_report(self, analysis_results: List[Dict[str, Any]]) -> str:
        """Format aggregated analysis results."""
        lines = ["## 📊 简历分析结果", ""]
        for result in analysis_results:
            module_name = result.get("module_display_name") or result.get("module", "模块")
            score = result.get("score", 0)
            issues = result.get("issues") or []
            lines.append(f"### {module_name}")
            lines.append(f"- 评分: {score}/100")
            if issues:
                lines.append("- 问题摘要:")
                for issue in issues[:3]:
                    severity = issue.get("severity", "medium")
                    problem = issue.get("problem", "")
                    suggestion = issue.get("suggestion", "")
                    lines.append(f"  - [{severity}] {problem}（建议: {suggestion}）")
            lines.append("")

        lines.append("如需针对某个模块生成优化建议，请告诉我模块名称。")
        return "\n".join(lines)

    def _format_optimization_suggestions(self, result: Dict[str, Any], full: bool = False) -> str:
        """Format optimization suggestions from ResumeOptimizerAgent."""
        suggestions = result.get("optimization_suggestions") or []
        if not suggestions:
            return "未生成可用的优化建议，请提供更具体的优化方向。"

        title = "## 🛠️ 全面优化建议" if full else "## 🛠️ 优化建议"
        lines = [title, ""]
        for idx, suggestion in enumerate(suggestions, 1):
            lines.append(f"### 建议 {idx}: {suggestion.get('title', '优化建议')}")
            current = suggestion.get("current", "")
            optimized = suggestion.get("optimized", "")
            explanation = suggestion.get("explanation", "")
            apply_path = suggestion.get("apply_path")
            if current:
                lines.append(f"- 当前: {current}")
            if optimized:
                lines.append(f"- 优化: {optimized}")
            if explanation:
                lines.append(f"- 说明: {explanation}")
            if apply_path:
                lines.append(f"- 路径: `{apply_path}`")
            lines.append("")

        lines.append("是否要应用这些优化？请告诉我需要应用的建议序号。")
        return "\n".join(lines)

    def _get_last_user_input(self) -> str:
        """获取最后一条真正的用户输入（过滤系统提示词）"""
        # 系统提示词的特征
        system_patterns = [
            "## ",  # Markdown 标题
            "**重要",  # 重要提示
            "工具选择",  # 工具选择规则
            "根据用户输入",  # 系统指令
            "意图识别",  # 系统指令
            "cv_reader_agent",  # 工具名
            "cv_analyzer_agent",
            "cv_editor_agent",
        ]

        for msg in reversed(self.memory.messages):
            if msg.role == "user" and msg.content:
                content = msg.content.strip()
                # 检查是否是系统提示词
                is_system = any(pattern in content for pattern in system_patterns)
                # 真正的用户输入通常较短
                if not is_system and len(content) < 500:
                    return content
        return ""

    async def _generate_dynamic_prompts(self, user_input: str, intent: "Intent" = None) -> tuple:
        """
        根据用户输入和对话状态动态生成提示词

        简化版：让 LLM 自主理解意图并决定工具调用

        返回: (system_prompt, next_step_prompt)
        """
        logger.info(f"🔍 获取到的用户输入: {user_input[:100] if user_input else '(空)'}")

        # 生成简单的上下文描述
        context_parts = []
        if self._conversation_state.context.resume_loaded:
            context_parts.append("✅ 简历已加载")
        else:
            context_parts.append("⚠️ 简历未加载，建议先加载简历")

        if self._current_resume_path:
            context_parts.append(f"📄 当前简历文件: {self._current_resume_path}")

        context = "\n".join(context_parts) if context_parts else "初始状态"

        # 生成系统提示词
        system_prompt = SYSTEM_PROMPT.format(
            directory=config.workspace_root,
            context=context
        )
        capability = CapabilityRegistry.get(self.capability)
        if capability.instructions_addendum:
            system_prompt = f"{system_prompt}\n\n{capability.instructions_addendum}"
        # 根据用户输入动态注入 skills 指导（backend/agent/skills）
        skills_addendum = self._build_skill_addendum(user_input or "")
        if skills_addendum:
            system_prompt = f"{system_prompt}\n\n{skills_addendum}"

        # 生成下一步提示词（传入 intent 用于判断是否需要决策逻辑）
        next_step = await self._generate_next_step_prompt(intent)

        logger.info(f"💭 提示词已生成，当前状态: {context}")
        return system_prompt, next_step

    def _build_skill_addendum(self, user_input: str) -> str:
        """
        根据用户输入匹配 backend/agent/skills 下的技能文档，并注入指导。

        当前支持：
        - office-files 总入口
        - office-files 子技能：pdf/docx/pptx/xlsx
        """
        text = (user_input or "").lower()
        if not text:
            return ""

        # 关键词触发：文档处理相关请求才加载 skills，避免污染普通对话
        office_keywords = [
            ".pdf", "pdf", "docx", ".docx", "ppt", ".pptx", "pptx",
            "xlsx", ".xlsx", "word", "excel", "powerpoint",
            "文档", "表格", "电子表格", "幻灯片", "演示文稿", "文件处理",
        ]
        if not any(k in text for k in office_keywords):
            return ""

        skills_root = Path(__file__).resolve().parents[2] / "skills" / "office-files"
        guidance_parts: list[str] = []

        # 1) 先加载 office-files 总路由技能
        root_guidance = self._read_skill_excerpt(skills_root / "SKILL.md", max_chars=1800)
        if root_guidance:
            guidance_parts.append(f"[Skill: office-files]\n{root_guidance}")

        # 2) 再根据输入匹配子技能
        sub_skill_map = {
            "pdf": [".pdf", "pdf", "合并pdf", "拆分pdf", "提取pdf", "表单pdf"],
            "docx": [".docx", "docx", "word", "文档"],
            "pptx": [".pptx", "pptx", "ppt", "powerpoint", "幻灯片", "演示文稿"],
            "xlsx": [".xlsx", "xlsx", "excel", "表格", "电子表格"],
        }

        for sub_skill, keys in sub_skill_map.items():
            if any(k in text for k in keys):
                sub_guidance = self._read_skill_excerpt(
                    skills_root / sub_skill / "SKILL.md",
                    max_chars=2200,
                )
                if sub_guidance:
                    guidance_parts.append(f"[Sub-Skill: {sub_skill}]\n{sub_guidance}")

        if not guidance_parts:
            return ""

        return (
            "## Skills Guidance (from backend/agent/skills)\n"
            "When handling office/document requests, follow the guidance below before choosing tools:\n\n"
            + "\n\n".join(guidance_parts)
        )

    def _read_skill_excerpt(self, file_path: Path, max_chars: int = 2000) -> str:
        """读取技能文档并做截断缓存，避免每轮重复 I/O。"""
        key = str(file_path)
        if key in self._skills_cache:
            return self._skills_cache[key]

        try:
            if not file_path.exists():
                return ""
            content = file_path.read_text(encoding="utf-8", errors="ignore").strip()
            excerpt = content[:max_chars]
            self._skills_cache[key] = excerpt
            return excerpt
        except Exception as e:
            logger.warning(f"[Skills] Failed to read skill file {file_path}: {e}")
            return ""

    async def _generate_next_step_prompt(self, intent: "Intent" = None) -> str:
        """生成下一步提示词

        核心设计：
        1. GREETING 意图：返回问候提示词，引导 LLM 生成友好回复
        2. UNKNOWN 意图：返回空字符串，让 LLM 自然回答
        3. 分析完成后：返回结果展示模板
        4. 其他情况：返回默认的 NEXT_STEP_PROMPT

        这样可以避免每次循环都添加重复的提示词。
        """
        # 🔑 GREETING 意图：引导 LLM 生成友好的问候回复
        if intent == Intent.GREETING:
            return """请用中文友好地回应用户的问候。你应该：
1. 热情、自然地打招呼
2. 简短介绍自己是一个 AI 助手，可以帮助用户处理各种任务
3. 询问用户需要什么帮助

注意：直接在 Response 中回复，不需要调用任何工具。"""

        # 🔑 UNKNOWN 意图：返回空字符串，让 LLM 自然回答
        if intent == Intent.UNKNOWN:
            return ""

        # 检查是否有分析工具刚执行完
        recent_analysis = False
        analysis_tool_name = None

        for msg in reversed(self.memory.messages[-3:]):
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc.function.name in ['education_analyzer', 'cv_analyzer_agent']:
                        recent_analysis = True
                        break
                if recent_analysis:
                    break

        if not recent_analysis:
            return NEXT_STEP_PROMPT

        # 检查分析结果是否已返回
        analysis_result_returned = False
        for msg in reversed(self.memory.messages[-5:]):
            if hasattr(msg, 'role') and msg.role == "tool":
                if hasattr(msg, 'name') and msg.name in ['education_analyzer', 'cv_analyzer_agent']:
                    analysis_result_returned = True
                    analysis_tool_name = msg.name
                    break
            elif hasattr(msg, 'content') and msg.content:
                if "教育经历分析" in msg.content or "优化建议示例" in msg.content:
                    analysis_result_returned = True
                    if "教育" in msg.content:
                        analysis_tool_name = "education_analyzer"
                    else:
                        analysis_tool_name = "cv_analyzer_agent"
                    break

        if not analysis_result_returned:
            return NEXT_STEP_PROMPT

        # 获取分析结果内容
        analysis_content = ""
        for msg in reversed(self.memory.messages[-10:]):
            if msg.role == "tool" and msg.name in ['education_analyzer', 'cv_analyzer_agent']:
                analysis_content = msg.content[:5000]
                break

        tool_display_name = "教育经历" if analysis_tool_name == "education_analyzer" else "简历"
        return f"""## 分析完成，请展示结果

分析工具 ({analysis_tool_name}) 已返回结果，请向用户展示：

{analysis_content[:2000]}

请用中文向用户展示分析结果摘要和优化建议，然后询问是否要应用优化。"""

    def should_auto_terminate(self, content: str, tool_calls: list) -> bool:
        """自定义自动终止逻辑

        Manus 的终止策略：
        1. 如果有工具调用，不终止
        2. 如果 LLM 返回了有意义的内容（问答场景），自动终止
        3. 如果内容是系统指令的重复，不终止（可能是错误状态）
        """
        if tool_calls:
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

    async def think(self) -> bool:
        """Process current state and decide next actions using LLM intent recognition.

        简化流程：
        1. 特殊意图（GREETING、LOAD_RESUME）直接处理
        2. 其他意图交给 LLM 自然处理，依赖自动终止机制
        """
        if not self._initialized:
            await self.initialize_mcp_servers()
            self._initialized = True

        # 确保 ConversationStateManager 有 LLM 实例
        self._ensure_conversation_state_llm()

        # 获取最后的用户输入
        user_input = self._get_last_user_input()

        # 🧠 使用 LLM 意图识别（可能包含增强后的查询）
        intent_result = await self._conversation_state.process_input(
            user_input=user_input,
            conversation_history=self.memory.messages[-5:],
            last_ai_message=self._get_last_ai_message()
        )

        intent = intent_result["intent"]
        tool = intent_result.get("tool")
        tool_args = intent_result.get("tool_args", {})
        enhanced_query = intent_result.get("enhanced_query", user_input)  # 获取增强后的查询
        intent_result_obj = intent_result.get("intent_result")  # 获取意图识别结果对象

        logger.info(f"🧠 意图识别: {intent.value}, 建议工具: {tool}")
        if enhanced_query != user_input:
            logger.info(f"📝 增强后的查询: {enhanced_query}")

        # 如果查询被增强（包含工具标记），更新最后一条用户消息
        if enhanced_query != user_input and self.memory.messages:
            # 找到最后一条用户消息并更新
            for i in range(len(self.memory.messages) - 1, -1, -1):
                msg = self.memory.messages[i]
                if msg.role == Role.USER:
                    # 更新消息内容为增强后的查询
                    msg.content = enhanced_query
                    logger.debug(f"已更新用户消息为增强查询: {enhanced_query}")
                    break

        if intent in [Intent.ANALYZE_RESUME, Intent.OPTIMIZE_SECTION, Intent.FULL_OPTIMIZE]:
            section = tool_args.get("section") if isinstance(tool_args, dict) else None
            try:
                strategy = AgentDelegationStrategy.resolve(intent, section)
                analyzers = strategy.get("analyzers") if strategy else None

                if intent == Intent.ANALYZE_RESUME:
                    analysis_results = await self._parallel_delegate_analyzers(analyzers or [])
                    content = self._format_analysis_report(analysis_results)
                    self.memory.add_message(Message.assistant_message(content))
                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    return False

                if intent == Intent.OPTIMIZE_SECTION:
                    analysis_results = await self._parallel_delegate_analyzers(analyzers or [])
                    suggestions = await self.delegate_to_agent(
                        strategy.get("optimizer", "resume_optimizer") if strategy else "resume_optimizer",
                        analysis_results=analysis_results,
                    )
                    content = self._format_optimization_suggestions(suggestions)
                    self.memory.add_message(Message.assistant_message(content))
                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    return False

                if intent == Intent.FULL_OPTIMIZE:
                    analysis_results = await self._parallel_delegate_analyzers(analyzers or [])
                    suggestions = await self.delegate_to_agent(
                        strategy.get("optimizer", "resume_optimizer") if strategy else "resume_optimizer",
                        analysis_results=analysis_results,
                    )
                    content = self._format_optimization_suggestions(suggestions, full=True)
                    self.memory.add_message(Message.assistant_message(content))
                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    return False
            except Exception as exc:
                logger.warning(f"委托子 Agent 失败，回退到 LLM 路径: {exc}")

        # 🔑 特殊处理：检查是否刚应用了优化
        if getattr(self, '_just_applied_optimization', False):
            self._just_applied_optimization = False
            recent_messages = self.memory.messages[-5:]
            has_editor_success = any(
                msg.role == "tool" and msg.name == "cv_editor_agent" and "Successfully updated" in (msg.content or "")
                for msg in recent_messages
            )

            if has_editor_success:
                logger.info("✅ 优化已应用完成，终止执行")
                self.memory.add_message(Message.assistant_message(
                    "✅ 优化已应用！如果需要继续优化其他项目，请告诉我。"
                ))
                from backend.agent.schema import AgentState
                self.state = AgentState.FINISHED
                return False

        # 🎯 GREETING 意图：让 LLM 处理（通过 prompt 中的 greeting_exception 规则）
        # 不再硬编码回复，让 LLM 根据 prompt 规则自己生成 Thought 和 Response
        if intent == Intent.GREETING:
            logger.info("👋 GREETING: 交给 LLM 处理（遵循 greeting_exception 规则）")
            # 继续往下走，让 LLM 处理

        # 🎯 LOAD_RESUME 意图：直接调用工具
        if tool and self._conversation_state.should_use_tool_directly(intent):
            if intent == Intent.LOAD_RESUME and self._conversation_state.context.resume_loaded:
                logger.info("✅ 简历已加载，跳过重复加载")
                self.memory.add_message(Message.assistant_message(
                    "简历已成功加载。您可以告诉我接下来需要做什么，比如「分析简历」或「优化某部分」。"
                ))
                from backend.agent.schema import AgentState
                self.state = AgentState.FINISHED
                return False
            return await self._handle_direct_tool_call(tool, tool_args, intent)

        # 🎯 其他意图：交给 LLM 自然处理
        # 动态生成提示词
        self.system_prompt, self.next_step_prompt = await self._generate_dynamic_prompts(user_input, intent)

        # 检查是否需要浏览器上下文
        recent_messages = self.memory.messages[-3:] if self.memory.messages else []
        browser_in_use = False
        if BrowserUseTool is not None:
            browser_in_use = any(
                tc.function.name == BrowserUseTool().name
                for msg in recent_messages
                if msg.tool_calls
                for tc in msg.tool_calls
            )

        if browser_in_use:
            browser_prompt = await self.browser_context_helper.format_next_step_prompt()
            if self.next_step_prompt:
                self.next_step_prompt = f"{self.next_step_prompt}\n\n{browser_prompt}"
            else:
                self.next_step_prompt = browser_prompt

        # 调用父类的 think 方法（会自动处理终止逻辑）
        return await super().think()

    async def _handle_direct_tool_call(
        self,
        tool: str,
        tool_args: dict,
        intent: "Intent"
    ) -> bool:
        """直接调用工具，跳过 LLM 决策"""
        from backend.agent.schema import ToolCall

        # 🚨 特殊处理：cv_reader_agent 需要文件路径
        # 如果 tool_args 为空但有 _current_resume_path，使用它
        if tool == "cv_reader_agent" and not tool_args.get("file_path"):
            if self._current_resume_path:
                tool_args["file_path"] = self._current_resume_path
                logger.info(f"📄 使用 _current_resume_path: {self._current_resume_path}")

        # 构建 ToolCall
        arguments = json.dumps(tool_args) if tool_args else "{}"
        manual_tool_call = ToolCall(
            id=f"call_{tool}",
            function={
                "name": tool,
                "arguments": arguments
            }
        )
        self.tool_calls = [manual_tool_call]

        # 生成说明文本
        descriptions = {
            "cv_reader_agent": "我将先加载您的简历数据",
            "cv_analyzer_agent": "我将分析您的简历",
            "cv_editor_agent": "我将编辑您的简历",
            "education_analyzer": "我将分析您的教育背景",
        }

        content = descriptions.get(tool, f"我将调用 {tool} 工具")
        if tool_args.get("section"):
            content += f"，重点优化：{tool_args['section']}"

        # 添加 assistant 消息
        self.memory.add_message(
            Message.from_tool_calls(
                content=content,
                tool_calls=[manual_tool_call]
            )
        )

        logger.info(f"🔧 直接调用工具: {tool}, 参数: {tool_args}")
        return True

    async def _handle_optimize_confirm(self) -> bool:
        """处理用户确认优化意图"""
        from backend.agent.schema import ToolCall
        import re

        # 从之前的分析结果中提取最推荐的优化
        edit_path = None
        edit_value = None
        suggestion_title = None

        for msg in reversed(self.memory.messages[-10:]):
            role_val = msg.role if isinstance(msg.role, str) else msg.role.value
            if role_val == "tool" and msg.name in ['education_analyzer', 'cv_analyzer_agent']:
                content = msg.content
                try:
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
                    json_str = json_match.group(1) if json_match else content

                    data = json.loads(json_str)
                    suggestions = data.get("optimization_suggestions") or data.get("optimizationSuggestions", [])

                    if suggestions and len(suggestions) > 0:
                        first_suggestion = suggestions[0]
                        edit_path = first_suggestion.get("apply_path")
                        edit_value = first_suggestion.get("optimized")
                        suggestion_title = first_suggestion.get("title", "优化建议")

                        if edit_path and edit_value:
                            manual_tool_call = ToolCall(
                                id="call_apply_optimization",
                                function={
                                    "name": "cv_editor_agent",
                                    "arguments": json.dumps({
                                        "path": edit_path,
                                        "action": "update",
                                        "value": edit_value
                                    })
                                }
                            )
                            self.tool_calls = [manual_tool_call]
                            self.memory.add_message(
                                Message.from_tool_calls(
                                    content=f"✅ 正在应用优化：{suggestion_title}\n路径：{edit_path}",
                                    tool_calls=[manual_tool_call]
                                )
                            )
                            logger.info(f"🔧 应用优化: {edit_path} = {edit_value}")
                            self._just_applied_optimization = True
                            return True
                except (json.JSONDecodeError, KeyError) as e:
                    logger.debug(f"解析优化建议失败: {e}")
                    continue

        # 无法解析 JSON，让 LLM 处理
        return False

    def _get_last_ai_message(self) -> Optional[str]:
        """获取最后一条 AI 消息内容"""
        for msg in reversed(self.memory.messages[-3:]):
            if msg.role == Role.ASSISTANT and msg.content:
                return msg.content[:500]
        return None

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
