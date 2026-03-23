import asyncio
import json
import os
import re
from typing import Any, Dict, List, Optional
from pathlib import Path

from pydantic import Field, model_validator, PrivateAttr

from backend.agent.agent.browser import BrowserContextHelper
from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.config import config
from backend.core.logger import get_logger

logger = get_logger(__name__)
from backend.agent.prompt.manus import NEXT_STEP_PROMPT, SYSTEM_PROMPT, GREETING_FAST_PATH_PROMPT
from backend.agent.prompt.load_resume import build_load_resume_fast_path_prompt
from backend.agent.tool import CVAnalyzerAgentTool, CVEditorAgentTool, CVReaderAgentTool, GenerateResumeTool, ShowResumeTool, Terminate, ToolCollection, WebSearch
try:
    from backend.agent.tool import BrowserUseTool
except ImportError:
    BrowserUseTool = None
from backend.agent.tool.ask_human import AskHuman
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
from backend.agent.agent.analyzers.skills_analyzer import SkillsAnalyzerAgent  # noqa: F401
from backend.agent.agent.resume_optimizer import ResumeOptimizerAgent  # noqa: F401

LOAD_RESUME_LLM_HINT_ENABLED = (
    os.getenv("AGENT_FAST_LOAD_RESUME_LLM_HINT_ENABLED", "true").strip().lower()
    != "false"
)
EDIT_PRE_TOOL_DELAY_MS = int(
    os.getenv("AGENT_EDIT_PRE_TOOL_DELAY_MS", "450").strip() or "450"
)


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

    max_observe: int = 10000
    max_steps: int = 20

    # Add general-purpose tools to the tool collection
    available_tools: ToolCollection = Field(default_factory=ToolCollection)

    special_tool_names: list[str] = Field(default_factory=lambda: [Terminate().name])
    browser_context_helper: Optional[BrowserContextHelper] = None

    # Memory components - 使用 PrivateAttr 避免 pydantic 验证
    _conversation_state: ConversationStateManager = PrivateAttr(default=None)
    _chat_history: ChatHistoryManager = PrivateAttr(default=None)
    _last_intent: Intent = PrivateAttr(default=None)
    _last_intent_info: Dict[str, Any] = PrivateAttr(default_factory=dict)
    _current_resume_path: Optional[str] = PrivateAttr(default=None)
    _just_applied_optimization: bool = PrivateAttr(default=False)  # 标记是否刚应用了优化
    _finish_after_load_resume_tool: bool = PrivateAttr(default=False)
    _pending_edit_tool_call: Optional[Dict[str, Any]] = PrivateAttr(default=None)
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
            GenerateResumeTool(),
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

    async def cleanup(self):
        """Clean up Manus agent resources."""
        if self.browser_context_helper:
            await self.browser_context_helper.cleanup_browser()

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
                "skills_analyzer",
            ]

        normalized = section.lower()
        if "工作" in normalized:
            return ["work_experience_analyzer"]
        if "教育" in normalized:
            return []
        if "技能" in normalized or "技术" in normalized:
            return ["skills_analyzer"]
        return [
            "work_experience_analyzer",
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
            role_val = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
            if role_val == "user" and msg.content:
                content = msg.content.strip()
                # 检查是否是系统提示词
                is_system = any(pattern in content for pattern in system_patterns)
                # 真正的用户输入通常较短
                if not is_system and len(content) < 500:
                    return content
        return ""

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

    def _extract_recent_optimization_text(self) -> Optional[str]:
        """提取最近一轮可用于直接写回的优化正文。"""
        for msg in reversed(self.memory.messages[-14:]):
            role_val = msg.role if isinstance(msg.role, str) else msg.role.value
            if role_val != "assistant":
                continue
            body = self._extract_response_body(msg.content or "")
            if self._is_actionable_optimization_text(body):
                return body
        return None

    def _build_generic_star_optimization(self) -> Optional[tuple[str, str]]:
        """
        构造兜底 STAR 文本（当历史里没有可直接写回的优化正文时）。
        返回 (path, optimized_text)。
        """
        resume_data = ResumeDataStore.get_data(self.session_id) or {}
        if not isinstance(resume_data, dict):
            return None
        path = self._resolve_primary_experience_text_path()
        if not path:
            return None
        exp0 = (resume_data.get("experience") or [{}])[0]
        if not isinstance(exp0, dict):
            return None
        company = str(exp0.get("company") or "该公司").strip() or "该公司"
        title = str(exp0.get("position") or exp0.get("title") or "后端开发实习生").strip() or "后端开发实习生"
        base_text = ""
        field = path.split(".")[-1]
        if isinstance(exp0.get(field), str):
            base_text = exp0.get(field).strip()
        if not base_text:
            return None
        base_summary = self._to_plain_text(base_text)
        if len(base_summary) > 180:
            base_summary = f"{base_summary[:180]}..."

        optimized = (
            f"{company} | {title}\n"
            "Situation（情境）：在实习期间参与核心后端业务开发，面对稳定性与性能优化需求。\n"
            "Task（任务）：负责关键模块迭代与服务性能优化，保障核心链路稳定运行。\n"
            f"Action（行动）：基于现有工作内容“{base_summary}”进行结构化重写，补全职责边界、技术动作与实施路径，"
            "并按高并发场景优化接口与数据访问策略。\n"
            "Result（结果）：形成可量化、可复用的项目表达模板，显著提升经历表述清晰度与面试可讲述性。"
            "（如有具体指标可继续替换为真实数据）"
        )
        return path, optimized

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
        1. UNKNOWN 意图：返回空字符串，让 LLM 自然回答
        2. 分析完成后：返回结果展示模板
        3. 其他情况：返回默认的 NEXT_STEP_PROMPT

        注意：GREETING 意图在 think() 中直接处理，设置 system_prompt 后走 LLM
        """
        # 🔑 UNKNOWN 意图：返回空字符串，让 LLM 自然回答
        if intent == Intent.UNKNOWN:
            return ""

        # GREETING 在 think() 中专门处理，这里保持空避免提示词串扰
        if intent == Intent.GREETING:
            return ""

        # 检查是否有分析工具刚执行完
        recent_analysis = False
        analysis_tool_name = None

        for msg in reversed(self.memory.messages[-3:]):
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc.function.name == 'cv_analyzer_agent':
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
                if hasattr(msg, 'name') and msg.name == 'cv_analyzer_agent':
                    analysis_result_returned = True
                    analysis_tool_name = msg.name
                    break
            elif hasattr(msg, 'content') and msg.content:
                if "优化建议示例" in msg.content:
                    analysis_result_returned = True
                    analysis_tool_name = "cv_analyzer_agent"
                    break

        if not analysis_result_returned:
            return NEXT_STEP_PROMPT

        # 获取分析结果内容
        analysis_content = ""
        for msg in reversed(self.memory.messages[-10:]):
            if msg.role == "tool" and msg.name == 'cv_analyzer_agent':
                analysis_content = msg.content[:5000]
                break

        tool_display_name = "简历"
        return f"""## 分析完成，请展示结果

分析工具 ({analysis_tool_name}) 已返回结果，请向用户展示：

{analysis_content[:2000]}

请用中文向用户展示分析结果摘要和优化建议，然后询问是否要应用优化。"""

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

    async def think(self) -> bool:
        """Process current state and decide next actions using LLM intent recognition.

        简化流程：
        1. 特殊意图（GREETING、LOAD_RESUME）直接处理
        2. 其他意图交给 LLM 自然处理，依赖自动终止机制
        """
        # 获取最后的用户输入
        user_input = self._get_last_user_input()
        self._sync_resume_loaded_state()

        # 两阶段执行编辑：先给用户“正在修改”反馈，再在下一步实际调用编辑工具。
        if self._pending_edit_tool_call:
            pending = self._pending_edit_tool_call
            self._pending_edit_tool_call = None
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
                self._pending_edit_tool_call = {
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
        if self._finish_after_load_resume_tool:
            for msg in reversed(self.memory.messages[-8:]):
                role_val = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
                if role_val == "tool" and (msg.name or "") in {"show_resume", "cv_reader_agent"}:
                    from backend.agent.schema import AgentState

                    self._finish_after_load_resume_tool = False
                    self.state = AgentState.FINISHED
                    logger.info("✅ LOAD_RESUME direct tool completed, finishing current run")
                    return False

        # 防止直接编辑工具在同一轮执行后被重复触发，导致多次修改
        # 兼容 role 可能是 Role 枚举或字符串 "tool"
        if self.memory.messages:
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
                return False

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

            if recent_editor_tool_msg is not None:
                logger.info("✅ cv_editor_agent 已执行，设置 next_step_prompt 引导 AI 继续生成")
                # 🔧 修复：设置 next_step_prompt，引导 AI 继续生成流式的最终说明
                self.next_step_prompt = """请继续生成流式的最终确认信息，包括：

1. 简短说明工具执行成功
2. 概括修改的主要内容（用1-2句话）
3. 提醒用户查看右侧简历预览
4. 给出2-3个后续优化建议

请以自然的对话方式输出，保持流式打字机效果。"""
                # 返回 True，让循环继续
                return True

        # 确保 ConversationStateManager 有 LLM 实例
        self._ensure_conversation_state_llm()
        # 🧠 统一由 ConversationStateManager 决定意图（含 fast-rule）
        intent_result = await self._conversation_state.process_input(
            user_input=user_input,
            conversation_history=self.memory.messages[-5:],
            last_ai_message=self._get_last_ai_message()
        )

        intent = intent_result["intent"]
        tool = intent_result.get("tool")
        tool_args = intent_result.get("tool_args", {})
        intent_source = intent_result.get("intent_source", "unknown")
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

        # 优化确认快路径：用户明确要求“直接更新/应用优化”时，优先触发写回工具。
        # 该分支必须放在分析/优化委托之前，避免被再次进入优化问答流程。
        if self._looks_like_optimize_confirm(user_input):
            if await self._handle_optimize_confirm():
                logger.info("🧭 optimize confirmation mapped to cv_editor_agent")
                return True

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

        # 存储本轮意图上下文，供工具结构化结果标注来源
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

        # 🔑 特殊处理：检查是否刚应用了优化
        if getattr(self, '_just_applied_optimization', False):
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
                return False

        # 🎯 GREETING：使用 LLM 生成温暖自然的问候回复
        if intent == Intent.GREETING:
            logger.info("👋 GREETING: using combined system + greeting prompt")
            # 组合策略：
            # 1) 保留 SYSTEM_PROMPT（含 <greeting_exception> 全局风格基线）
            # 2) 叠加 GREETING_FAST_PATH_PROMPT（格式/长度/不用工具等强约束）
            base_system_prompt, _ = await self._generate_dynamic_prompts(user_input, intent)
            self.system_prompt = f"{base_system_prompt}\n\n{GREETING_FAST_PATH_PROMPT}"
            self.next_step_prompt = ""
            # 调用父类 think()，让 LLM 生成问候回复（会自动处理终止）
            return await super().think()

        # 🎯 LOAD_RESUME 意图：直接调用工具
        if tool and self._conversation_state.should_use_tool_directly(intent):
            return await self._handle_direct_tool_call(tool, tool_args, intent, user_input)

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
        intent: "Intent",
        user_input: Optional[str] = None,
        skip_pre_edit_notice: bool = False,
    ) -> bool:
        """直接调用工具，跳过 LLM 决策"""
        from backend.agent.schema import ToolCall

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

        # 生成说明文本
        descriptions = {
            "cv_reader_agent": "我将先加载您的简历数据",
            "show_resume": "我将先打开简历选择面板",
            "cv_analyzer_agent": "我将分析您的简历",
            "cv_editor_agent": "我将编辑您的简历",
        }

        content = descriptions.get(tool, f"我将调用 {tool} 工具")
        if tool_args.get("section"):
            content += f"，重点优化：{tool_args['section']}"
        if intent == Intent.LOAD_RESUME:
            content = await self._build_load_resume_hint_message(
                tool=tool,
                tool_args=tool_args,
                user_input=user_input or "",
            )
            self._finish_after_load_resume_tool = True

        # 添加 assistant 消息
        if intent == Intent.EDIT_CV and not skip_pre_edit_notice:
            self.memory.add_message(
                Message.assistant_message(
                    "Thought: 我识别到你要做简历字段修改，将直接执行编辑并返回前后对比。"
                )
            )
            self.memory.add_message(
                Message.assistant_message(
                    "Response: 收到，正在修改。完成后我会给你“修改前 / 修改后”的对比结果。"
                    "我现在开始执行简历修改。"
                )
            )
            self.memory.add_message(
                Message.from_tool_calls(
                    content="我现在开始执行简历修改。",
                    tool_calls=[manual_tool_call],
                )
            )
        elif intent == Intent.EDIT_CV and skip_pre_edit_notice:
            self.memory.add_message(
                Message.from_tool_calls(
                    content="我现在开始执行简历修改。",
                    tool_calls=[manual_tool_call],
                )
            )
        else:
            self.memory.add_message(
                Message.from_tool_calls(
                    content=content,
                    tool_calls=[manual_tool_call]
                )
            )

        self.tool_calls = [manual_tool_call]
        logger.info(f"🔧 直接调用工具: {tool}, 参数: {tool_args}")
        return True

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
                "Thought: 我识别到你要加载简历，先打开选择面板方便你切换或新建。\n"
                "Response: 请在下面选择\"创建一份简历\"或\"选择已有简历\"。"
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
        normalized = (text or "").strip().lower()
        if not normalized:
            return False
        patterns = (
            r"(可以|好的|同意|确认|行|开始|请)",
            r"(更新|应用|写回|保存|优化|改|修改|替换)",
        )
        return all(re.search(pattern, normalized) for pattern in patterns)

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

        # Fallback: 直接从最近 assistant 的 STAR 优化正文写回工作经历详情。
        star_text = self._extract_recent_optimization_text()
        if star_text:
            star_text = self._sanitize_optimization_text(star_text)
            if not self._is_reasonable_optimization_text(star_text):
                logger.info("⚠️ skip oversized/repeated optimization text, fallback to generic STAR")
                star_text = None
        edit_path = self._resolve_primary_experience_text_path() or "experience[0].details"

        if star_text and self._has_resume_data_in_store():
            manual_tool_call = ToolCall(
                id="call_apply_star_fallback",
                function={
                    "name": "cv_editor_agent",
                    "arguments": json.dumps(
                        {
                            "path": edit_path,
                            "action": "update",
                            "value": star_text,
                        }
                    ),
                },
            )
            self.tool_calls = [manual_tool_call]
            self.memory.add_message(
                Message.from_tool_calls(
                    content=f"✅ 正在应用优化：将 STAR 优化描述写回 `{edit_path}`",
                    tool_calls=[manual_tool_call],
                )
            )
            logger.info(f"🔧 Fallback apply optimization: {edit_path}")
            self._just_applied_optimization = True
            return True

        generic_star = self._build_generic_star_optimization()
        if generic_star and self._has_resume_data_in_store():
            generic_path, generic_text = generic_star
            manual_tool_call = ToolCall(
                id="call_apply_star_generic",
                function={
                    "name": "cv_editor_agent",
                    "arguments": json.dumps(
                        {
                            "path": generic_path,
                            "action": "update",
                            "value": generic_text,
                        }
                    ),
                },
            )
            self.tool_calls = [manual_tool_call]
            self.memory.add_message(
                Message.from_tool_calls(
                    content=f"✅ 正在应用优化：使用 STAR 模板写回 `{generic_path}`",
                    tool_calls=[manual_tool_call],
                )
            )
            logger.info(f"🔧 Generic STAR fallback apply: {generic_path}")
            self._just_applied_optimization = True
            return True

        # 无法解析 JSON，让 LLM 处理
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
