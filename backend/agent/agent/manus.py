import asyncio
import json
import os
import re
import time
from typing import Any, Dict, List, Optional
from pathlib import Path

from pydantic import Field, model_validator, PrivateAttr

from backend.agent.agent.browser import BrowserContextHelper
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
from backend.agent.application.conversation.conversation_state import (
    is_add_experience_query,
    is_read_only_query,
)
from backend.agent.utils.experience_entry import (
    build_optimization_resume_patch,
    resolve_experience_target_index,
)
from backend.agent.schema import Message, Role, ToolCall
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

_RULE_BASED_NOISE_RE = re.compile(r"[（(]建议补充量化结果[^）)]*[）)]")


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
    _pending_immediate_stream: Optional[Dict[str, Any]] = PrivateAttr(default=None)  # 立即流式推送的消息
    _pending_resume_patches: List[Dict[str, Any]] = PrivateAttr(default_factory=list)

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
            analyze_kwargs: Dict[str, Any] = {}
            if kwargs.get("target_index") is not None:
                analyze_kwargs["target_index"] = kwargs["target_index"]
            return await agent.analyze(resume_data, **analyze_kwargs)

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

    async def _parallel_delegate_analyzers(
        self, analyzers: List[str], **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """并行委托给分析 Agent。"""
        if not analyzers:
            return []
        tasks = [self.delegate_to_agent(name, **kwargs) for name in analyzers]
        results = await asyncio.gather(*tasks)
        return results

    async def execute_tool(self, command: ToolCall) -> str:
        """只读查看轮次拦截误触发的简历编辑工具。"""
        name = ""
        if command and command.function:
            name = command.function.name or ""
        if getattr(self, "_current_turn_read_only", False) and name in (
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

    @staticmethod
    def _safe_int(value: Any, default: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _extract_resume_meta(self, resume_data: Dict[str, Any]) -> Dict[str, Any]:
        basics = (resume_data.get("basic") or resume_data.get("basics") or {}) if isinstance(resume_data, dict) else {}
        meta = (resume_data.get("_meta") or {}) if isinstance(resume_data, dict) else {}

        resume_id = (
            resume_data.get("resume_id")
            or resume_data.get("id")
            or meta.get("resume_id")
            or ""
        )
        name = (
            basics.get("name")
            or resume_data.get("title")
            or "当前简历"
        )
        updated_at = (
            resume_data.get("updatedAt")
            or resume_data.get("updated_at")
            or meta.get("updated_at")
            or ""
        )
        language = resume_data.get("language") or "中文"
        return {
            "id": str(resume_id or ""),
            "name": str(name or "当前简历"),
            "updated_at": str(updated_at or ""),
            "language": str(language or "中文"),
        }

    def _build_resume_diagnosis_payload(
        self,
        analysis_results: List[Dict[str, Any]],
        resume_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        module_scores: List[int] = []
        issue_rows: List[Dict[str, str]] = []

        for result in analysis_results:
            module_name = str(result.get("module_display_name") or result.get("module") or "模块")
            module_score = self._safe_int(result.get("score"), 70)
            module_scores.append(module_score)
            issues = result.get("issues") or []
            for issue in issues:
                if not isinstance(issue, dict):
                    continue
                severity = str(issue.get("severity") or "medium").lower()
                issue_rows.append(
                    {
                        "module": module_name,
                        "severity": severity,
                        "problem": str(issue.get("problem") or "存在可优化项"),
                        "suggestion": str(issue.get("suggestion") or "建议补充更具体的成果与细节"),
                    }
                )

        quality_score = round(sum(module_scores) / len(module_scores)) if module_scores else 76
        competitiveness_score = min(98, max(70, quality_score + 8))
        screening_probability = min(96, max(55, int(quality_score * 0.85 + competitiveness_score * 0.15)))

        if not issue_rows:
            issue_rows = [
                {
                    "module": "整体",
                    "severity": "medium",
                    "problem": "可继续增强岗位匹配表达",
                    "suggestion": "建议补充更贴近目标岗位的关键词与量化成果",
                }
            ]

        must_fix = [r for r in issue_rows if r["severity"] == "high"][:3]
        should_fix = [r for r in issue_rows if r["severity"] == "medium"][:3]
        optional_fix = [r for r in issue_rows if r["severity"] not in {"high", "medium"}][:3]

        if not must_fix:
            must_fix = should_fix[:1]
        if not should_fix and len(issue_rows) > 1:
            should_fix = issue_rows[1:3]
        if not optional_fix and len(issue_rows) > 2:
            optional_fix = issue_rows[2:4]

        top_actions: List[Dict[str, str]] = []
        for row in (must_fix + should_fix + optional_fix):
            title = f"优化{row['module']}模块表达"
            if any(item.get("title") == title for item in top_actions):
                continue
            top_actions.append(
                {
                    "title": title,
                    "detail": row["suggestion"],
                }
            )
            if len(top_actions) >= 3:
                break

        if len(top_actions) < 3:
            fallback_actions = [
                {"title": "补充岗位目标信息", "detail": "补充目标岗位或 JD 后，可进一步得到定制化匹配建议"},
                {"title": "强化量化成果", "detail": "优先把职责改写为可衡量成果，提升 HR 初筛可读性"},
                {"title": "收敛冗余描述", "detail": "去掉重复内容，保持重点经历在 6-8 条高价值要点"},
            ]
            for item in fallback_actions:
                if len(top_actions) >= 3:
                    break
                if any(existing.get("title") == item["title"] for existing in top_actions):
                    continue
                top_actions.append(item)

        resume_meta = self._extract_resume_meta(resume_data)
        summary_line = (
            f"这份简历基础不错，当前通用场景下初筛通过概率约 {screening_probability}% ，"
            f"内容质量 {quality_score}/100，竞争力 {competitiveness_score}/100。"
        )

        # 丰富 Thought 过程，对齐 upcv 体验
        thought_steps = [
            f"1. **简历解析**：已成功读取简历《{resume_meta['name']}》，识别到其主要语言为 {resume_meta['language']}。",
            f"2. **多维评估**：正在调用工作经历分析器和技能栈评估器进行交叉验证...",
            f"3. **核心发现**：内容质量打分为 {quality_score}。主要的优化点集中在 {', '.join([r['module'] for r in must_fix + should_fix][:2])} 等模块。",
            "4. **行动策略**：已根据诊断结果整理了 3 项高优先级的改进动作，准备输出结构化报告。"
        ]
        thought = "\n".join(thought_steps)

        lines: List[str] = [
            "好的，我已经基于当前简历完成一轮通用诊断。",
            "",
            f"先给你结论：{summary_line}",
            "",
            "如果你补充目标岗位或 JD，我可以继续给你做定向匹配度诊断；在此之前我先给出通用版本。",
            "",
            "## 诊断报告",
            "",
            "### 初筛通过概率",
            f"- 当前简历通用场景预计通过率：**{screening_probability}%**",
            "",
            "### 评分卡",
            f"- 内容质量：**{quality_score}/100**",
            f"- 竞争力：**{competitiveness_score}/100**",
            "- 岗位匹配度：**待补充目标岗位后评估**",
            "",
            "### 问题清单",
            "",
            "#### 必须修改（影响专业度）",
        ]

        for row in must_fix:
            lines.append(f"- **{row['problem']}**（{row['module']}）：{row['suggestion']}")
        if not must_fix:
            lines.append("- 当前未发现高优先级硬伤，可优先做中优先级优化。")

        lines.extend(["", "#### 建议修改（提升专业度）"])
        for row in should_fix:
            lines.append(f"- **{row['problem']}**（{row['module']}）：{row['suggestion']}")
        if not should_fix:
            lines.append("- 这一层暂未命中明显问题，可按目标岗位补充关键词。")

        lines.extend(["", "#### 可选优化（锦上添花）"])
        for row in optional_fix:
            lines.append(f"- **{row['problem']}**（{row['module']}）：{row['suggestion']}")
        if not optional_fix:
            lines.append("- 可选项暂无，建议直接推进岗位定向优化。")

        lines.extend(["", "### Top 3 行动建议"])
        for idx, item in enumerate(top_actions[:3], 1):
            lines.append(f"{idx}. **{item['title']}**：{item['detail']}")

        lines.extend(
            [
                "",
                "### 下一步",
                "请告诉我你想投的岗位方向（例如“后端开发工程师/Go 开发工程师”）或直接贴 JD，我会继续给出匹配度诊断与定向改写建议。",
                '%%SUGGESTIONS%%[{"text":"帮我直接修改这些问题","msg":"帮我把诊断出的问题直接修改好"},{"text":"针对目标岗位定制简历","msg":"","template":"我想针对目标岗位定制简历，目标岗位是{input}"},{"text":"查找匹配职位","msg":"帮我搜索匹配的后端职位"}]%%END%%',
            ]
        )

        return {
            "thought": thought,
            "response": "\n".join(lines).strip(),
            "structured": {
                "type": "resume_diagnosis",
                "status": "success",
                "tool": "resume-diagnosis",
                "resume": resume_meta,
                "summary": {
                    "screening_probability": screening_probability,
                    "quality_score": quality_score,
                    "competitiveness_score": competitiveness_score,
                    "matching_score": None,
                },
                "details": {
                    "overall_evaluation": summary_line,
                    "issues": {
                        "must_fix": [f"{r['problem']}（{r['module']}）：{r['suggestion']}" for r in must_fix],
                        "should_fix": [f"{r['problem']}（{r['module']}）：{r['suggestion']}" for r in should_fix],
                        "optional": [f"{r['problem']}（{r['module']}）：{r['suggestion']}" for r in optional_fix],
                    },
                    "top_actions": [f"{idx}. {item['title']}：{item['detail']}" for idx, item in enumerate(top_actions[:3], 1)],
                    "next_steps": ["请提供目标岗位或贴出 JD，我将为您进行定向匹配度分析。"],
                },
            },
            "resume_meta": resume_meta,
        }

    def _format_optimization_suggestions(self, result: Dict[str, Any], full: bool = False) -> str:
        """Format optimization suggestions from ResumeOptimizerAgent."""
        suggestions = result.get("optimization_suggestions") or []
        if not suggestions:
            return "未生成可用的优化建议，请提供更具体的优化方向。"

        title = "## 🛠️ 全面优化建议" if full else "## 🛠️ 优化建议"
        lines = [title, ""]
        for idx, suggestion in enumerate(suggestions, 1):
            lines.append(f"### 建议 {idx}: {suggestion.get('title', '优化建议')}")
            current = str(suggestion.get("current", "") or "").strip()
            optimized = str(suggestion.get("optimized", "") or "").strip()
            explanation = str(suggestion.get("explanation", "") or "").strip()
            if current:
                lines.append(f"**修改前**")
                lines.append(current)
                lines.append("")
            if optimized:
                lines.append(f"**修改后（参考）**")
                lines.append(optimized)
                lines.append("")
            if explanation and explanation != optimized:
                lines.append(f"**说明**：{explanation}")
                lines.append("")

        lines.append("如需应用上述改写，请回复「应用建议 1」或说明要改哪一段。")
        return "\n".join(lines).strip()

    def queue_resume_patch(self, patch: Dict[str, Any]) -> None:
        """暂存 resume_patch，由 AgentStream 在 step 结束后 emit。"""
        self._pending_resume_patches.append(patch)

    def drain_resume_patches(self) -> List[Dict[str, Any]]:
        """取出并清空待发送的 resume_patch 列表。"""
        patches = list(self._pending_resume_patches)
        self._pending_resume_patches = []
        return patches

    @staticmethod
    def _strip_llm_thinking_prefix(raw: str) -> str:
        """去掉 DashScope/DeepSeek 等模型附带的 thinking 前缀。"""
        text = (raw or "").strip()
        if not text:
            return ""
        think_end = ("</" + "redacted_thinking" + ">", "</" + "think" + ">")
        for marker in think_end:
            idx = text.rfind(marker)
            if idx >= 0:
                return text[idx + len(marker) :].strip()
        stripped = re.sub(
            r"^<(?:think|redacted_thinking)>[\s\S]*?</(?:think|redacted_thinking)>\s*",
            "",
            text,
            count=1,
            flags=re.I,
        )
        return stripped.strip() or text

    @staticmethod
    def _extract_json_object_with_key(text: str, key: str) -> Optional[str]:
        """按括号匹配提取包含指定 key 的 JSON 对象（避免 thinking 里的 { 干扰）。"""
        anchor = text.rfind(f'"{key}"')
        if anchor < 0:
            return None
        start = text.rfind("{", 0, anchor)
        if start < 0:
            return None

        depth = 0
        in_string = False
        escape = False
        for idx in range(start, len(text)):
            ch = text[idx]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : idx + 1]
        return None

    @staticmethod
    def _decode_json_string_literal(raw: str) -> str:
        try:
            return json.loads(f'"{raw}"')
        except json.JSONDecodeError:
            return (
                (raw or "")
                .replace("\\n", "\n")
                .replace("\\t", "\t")
                .replace('\\"', '"')
                .replace("\\/", "/")
            )

    @classmethod
    def _parse_optimize_llm_json(cls, raw: str) -> Optional[Dict[str, Any]]:
        text = cls._strip_llm_thinking_prefix(raw)
        if not text:
            return None

        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.I)
        if fence:
            text = fence.group(1).strip()

        candidates: List[str] = [text]
        blob = cls._extract_json_object_with_key(text, "optimized_html")
        if blob:
            candidates.insert(0, blob)
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            candidates.append(text[start : end + 1])

        for candidate in candidates:
            try:
                data = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and (
                data.get("optimized_html") or data.get("optimized") or data.get("details")
            ):
                return data

        html_match = re.search(
            r'"optimized_html"\s*:\s*"((?:\\.|[^"\\])*)"',
            text,
            flags=re.S,
        )
        if not html_match:
            return None

        optimized_html = cls._decode_json_string_literal(html_match.group(1)).strip()
        if not optimized_html:
            return None

        explanation = ""
        exp_match = re.search(
            r'"explanation"\s*:\s*"((?:\\.|[^"\\])*)"',
            text,
            flags=re.S,
        )
        if exp_match:
            explanation = cls._decode_json_string_literal(exp_match.group(1)).strip()

        return {"optimized_html": optimized_html, "explanation": explanation}

    async def _llm_optimize_section_patch(
        self,
        user_input: str,
        resume_data: Dict[str, Any],
        target_index: int,
    ) -> Optional[Dict[str, Any]]:
        """用 Manus 主 LLM + Hybrid 简历 context 生成优化 diff（恢复改前高质量路径）。"""
        experiences = resume_data.get("experience") or []
        if target_index < 0 or target_index >= len(experiences):
            return None

        target = experiences[target_index]
        company = re.sub(r"\*+", "", str(target.get("company") or "该段经历")).strip()
        position = str(target.get("position") or "").strip()
        apply_path = f"experience[{target_index}].details"

        raw_details = target.get("details") or target.get("description") or ""
        current_plain = _RULE_BASED_NOISE_RE.sub(
            "", html_to_context_text(str(raw_details))
        ).strip()
        if not current_plain:
            current_plain = "（空）"

        base_system, _ = await self._generate_dynamic_prompts(
            user_input, Intent.OPTIMIZE_SECTION
        )
        system_prompt = f"{base_system}\n\n{OPTIMIZE_SECTION_LLM_ADDENDUM}"
        user_prompt = (
            f"请优化 path={apply_path} 对应的实习/工作经历。\n"
            f"公司：{company}\n"
            f"岗位：{position or '（未填写）'}\n"
            f"用户原话：{user_input.strip() or '优化表述，突出贡献与量化成果'}\n\n"
            f"当前 details（纯文本，请在此基础上深度改写）：\n{current_plain[:2800]}"
        )
        retry_suffix = (
            "\n\n【重要】不要输出思考过程。"
            "只输出一行 JSON，第一字符必须是 {，包含 optimized_html 与 explanation。"
        )

        parsed: Optional[Dict[str, Any]] = None
        raw = ""
        for attempt in range(2):
            prompt = user_prompt if attempt == 0 else f"{user_prompt}{retry_suffix}"
            try:
                raw = await self.llm.ask(
                    messages=[{"role": "user", "content": prompt}],
                    system_msgs=[{"role": "system", "content": system_prompt}],
                    stream=False,
                    temperature=0.55,
                )
            except Exception as exc:
                logger.warning(f"[Manus] LLM optimize section failed: {exc}")
                return None

            parsed = self._parse_optimize_llm_json(raw or "")
            if parsed:
                break
            logger.warning(
                "[Manus] LLM optimize section returned non-JSON response "
                f"(attempt={attempt + 1}, chars={len(raw or '')})"
            )

        if not parsed:
            logger.debug(
                "[Manus] LLM optimize raw tail: %s",
                (raw or "")[-400:],
            )
            return None

        optimized_html = str(
            parsed.get("optimized_html")
            or parsed.get("optimized")
            or parsed.get("details")
            or ""
        ).strip()
        if not optimized_html:
            logger.warning("[Manus] LLM optimize section missing optimized_html")
            return None

        optimized_html = str(
            normalize_editor_value(optimized_html, apply_path)
        ).strip()
        explanation = str(parsed.get("explanation") or "").strip()
        if not explanation:
            explanation = f"基于完整简历 context，按四要素重写 {company} 的经历。"

        logger.info(
            f"[Manus] LLM optimize section ok: company={company}, "
            f"index={target_index}, chars={len(optimized_html)}"
        )
        return {
            "optimization_suggestions": [
                {
                    "title": f"优化 {company} 的实习经历",
                    "current": current_plain[:900],
                    "optimized": optimized_html,
                    "explanation": explanation,
                    "apply_path": apply_path,
                }
            ]
        }

    def _queue_optimization_patches(self, suggestions: List[Dict[str, Any]]) -> int:
        """将优化建议转为 resume_patch，返回成功入队数量。"""
        count = 0
        for suggestion in suggestions:
            optimized = str(suggestion.get("optimized") or "").strip()
            apply_path = str(suggestion.get("apply_path") or "").strip()
            if not optimized or not apply_path or apply_path == "experience":
                continue
            self.queue_resume_patch(build_optimization_resume_patch(suggestion))
            count += 1
        return count

    def _optimization_assistant_reply(
        self,
        suggestions: Dict[str, Any],
        *,
        patch_count: int,
        default_label: str = "实习经历",
    ) -> str:
        """优化结果有 diff 卡片时用短回复，否则回退 markdown 长文。"""
        if patch_count <= 0:
            label = re.sub(r"\*+", "", default_label).strip() or "该段经历"
            if label not in ("实习经历", "简历"):
                return f"暂时未能为「{label}」生成优化对比，请稍后重试。"
            return "未生成可用的优化建议，请稍后重试或指定要优化的经历。"

        items = suggestions.get("optimization_suggestions") or []
        label = default_label
        if items:
            title = str(items[0].get("title") or "").strip()
            title_match = re.match(r"优化\s*(.+?)(?:的)?实习经历\s*$", title)
            if title_match:
                label = re.sub(r"\*+", "", title_match.group(1)).strip() or default_label
            elif title.startswith("优化 "):
                label = re.sub(r"\*+", "", title[3:]).strip() or default_label

        label = re.sub(r"\*+", "", label).strip() or default_label

        if patch_count == 1:
            return f"已为「{label}」生成优化对比，请在下方卡片确认是否应用。"
        return f"已生成 {patch_count} 处优化对比，请在下方卡片逐条确认是否应用。"

    @staticmethod
    def _build_optimize_target_clarification_message(
        experiences: List[Dict[str, Any]],
    ) -> str:
        """未指定优化目标且有多段经历时，列出可选项并附带快捷按钮。"""
        items: List[Dict[str, str]] = []
        for idx, exp in enumerate(experiences):
            if not isinstance(exp, dict):
                continue
            company = re.sub(
                r"\*+",
                "",
                str(exp.get("company") or exp.get("title") or f"第{idx + 1}段"),
            ).strip() or f"第{idx + 1}段"
            position = str(exp.get("position") or exp.get("role") or "").strip()
            display = f"{company} · {position}" if position else company
            items.append(
                {
                    "text": display,
                    "msg": f"优化{company}的实习经历",
                }
            )

        suggestions_json = json.dumps(items, ensure_ascii=False)
        return (
            "好的！在优化之前，请问您想优化哪一段实习/工作经历？\n\n"
            f"%%SUGGESTIONS%%{suggestions_json}%%END%%"
        )

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
            self._current_turn_read_only = False
        else:
            self._current_turn_read_only = is_read_only_query(user_input)

        if self._current_turn_read_only:
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
        """
        根据用户输入和对话状态动态生成提示词（Hybrid 模式）

        Hybrid：简历内容注入 system prompt context，读免费，写走 tool。

        返回: (system_prompt, next_step_prompt)
        """
        logger.info(f"🔍 获取到的用户输入: {user_input[:100] if user_input else '(空)'}")

        context_parts = []
        if self._conversation_state.context.resume_loaded:
            context_parts.append("✅ 简历已加载（完整内容见下方）")
        else:
            context_parts.append("⚠️ 简历未加载，建议先加载简历")

        if self._current_resume_path:
            context_parts.append(f"📄 当前简历文件: {self._current_resume_path}")

        context = "\n".join(context_parts) if context_parts else "初始状态"

        system_prompt = SYSTEM_PROMPT.replace(
            "{directory}", str(config.workspace_root)
        ).replace(
            "{context}", context
        )
        capability = CapabilityRegistry.get(self.capability)
        if capability.instructions_addendum:
            system_prompt = f"{system_prompt}\n\n{capability.instructions_addendum}"
        skills_addendum = self._build_skill_addendum(user_input or "")
        if skills_addendum:
            system_prompt = f"{system_prompt}\n\n{skills_addendum}"

        # Hybrid: 注入简历内容到 system prompt
        resume_text = self._format_resume_for_context()
        if resume_text:
            system_prompt = f"{system_prompt}\n\n{resume_text}"
            logger.info("📋 简历内容已注入 system prompt（Hybrid 模式）")

        if is_read_only_query(user_input or ""):
            system_prompt = (
                f"{system_prompt}\n\n"
                "## 本轮约束（只读查看）\n"
                "用户正在读取/查看简历内容。**禁止**调用 cv_editor_agent、str_replace_editor"
                "及任何写文件/改代码工具；不要修改简历。"
                "必须直接根据上方「# CV/Resume Context」完整输出原文，禁止去查源码。\n"
                "每条经历的 Details 按多行要点列出（保留 - 开头的子项），不要合并成一大段。\n"
            )
        elif is_add_experience_query(user_input or ""):
            system_prompt = (
                f"{system_prompt}\n\n"
                "## 本轮约束（新增经历）\n"
                "用户要导入/新增一段实习或工作经历：**本轮不是只读**，必须调用 cv_editor_agent；"
                "禁止声称「只读模式」「无法修改」。\n"
                "action=add，path=experience，value 为**单个 JSON 对象**（勿把整个对象再 stringify 成字符串）。\n"
                "字段：company、position、date（不要用 period）、details（HTML ul.custom-list + strong）。\n"
                "details 每条成果单独一个 <li>，禁止把 1.2.3. 或分号分隔的多条成就写进同一个 <li>。\n"
                "禁止 STAR 模板，禁止 update experience[0]，必须 append 新条。\n"
            )

        next_step = await self._generate_next_step_prompt(intent)

        logger.info(f"💭 提示词已生成，当前状态: {context}")
        return system_prompt, next_step

    def _format_resume_for_context(self) -> str:
        """将当前简历格式化为可注入 system prompt 的文本。

        使用 ReadCVContext 复用已有的格式化逻辑（含索引标记和 path 提示），
        确保 LLM 看到的和 cv_editor_agent 操作的是同一份数据。
        """
        resume_data = ResumeDataStore.get_data(self.session_id)
        if not resume_data:
            return ""
        try:
            from backend.agent.tool.cv_reader_tool import ReadCVContext
            reader = ReadCVContext()
            reader.set_resume_data(resume_data)
            return reader._format_full_resume()
        except Exception as exc:
            logger.warning(f"格式化简历注入 context 失败: {exc}")
            return ""

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
        # 获取最后的用户输入；同一轮内锁定只读/可写模式
        user_input = self._get_last_user_input()
        self._sync_turn_read_only_flag(user_input)
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

            if recent_editor_tool_msg is not None and not getattr(
                self, "_current_turn_read_only", False
            ):
                logger.info("✅ cv_editor_agent 已执行，直接结束避免重复调用工具")
                # After cv_editor_agent runs, emit a short confirmation via answer
                # and stop — do NOT return True (which would let LLM pick tools again).
                confirmation = "✅ 修改已完成，请查看右侧简历预览确认效果。如需继续优化，请告诉我。"
                self.memory.add_message(Message.assistant_message(confirmation))
                from backend.agent.schema import AgentState
                self.state = AgentState.FINISHED
                return False

        # 确保 ConversationStateManager 有 LLM 实例
        self._ensure_conversation_state_llm()
        # 🧠 统一由 ConversationStateManager 决定意图（含 fast-rule）
        intent_result = await self._conversation_state.process_input(
            user_input=user_input,
            conversation_history=self.memory.messages[-5:],
            last_ai_message=self._get_last_ai_message()
        )

        intent = intent_result["intent"]
        # 🚨 兜底拦截逻辑：如果用户明确说要“诊断”，即使 LLM 意图识别没识别出 ANALYZE_RESUME，也强行进入
        if intent != Intent.ANALYZE_RESUME and "诊断" in (user_input or ""):
            logger.info("🧭 触发诊断关键词兜底拦截: intent UNKNOWN -> ANALYZE_RESUME")
            intent = Intent.ANALYZE_RESUME

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
                    self.memory.add_message(Message.assistant_message(hint_message))
                    manual_tool_call = ToolCall(
                        id=f"call_show_resume_{int(time.time() * 1000)}",
                        function={"name": "show_resume", "arguments": "{}"},
                    )
                    self.memory.add_message(
                        Message.from_tool_calls(
                            content="我将先打开简历选择面板。",
                            tool_calls=[manual_tool_call],
                        )
                    )
                    self.tool_calls = [manual_tool_call]
                    return True

                strategy = AgentDelegationStrategy.resolve(intent, section)
                analyzers = strategy.get("analyzers") if strategy else None

                if intent == Intent.ANALYZE_RESUME:
                    resume_data_snapshot = ResumeDataStore.get_data(self.session_id) or {}
                    resume_meta = self._extract_resume_meta(resume_data_snapshot)

                    # ── 两阶段确认：首次触发时先询问目标岗位 ──
                    user_text = (user_input or "").strip()
                    _diagnosis_keywords = ["先做通用", "通用诊断", "目标岗位", "JD", "jd", "职位描述", "定向"]
                    _has_diagnosis_context = any(kw in user_text for kw in _diagnosis_keywords)

                    if not _has_diagnosis_context:
                        # Phase 1: 展示简历已读取，询问诊断方向
                        detail_tool_call = ToolCall(
                            id=f"call_get_resume_detail_{int(time.time() * 1000)}",
                            function={"name": "get_resume_detail", "arguments": "{}"},
                        )
                        self._tool_structured_results[detail_tool_call.id] = {
                            "type": "resume_detail",
                            "status": "success",
                            "tool": "get_resume_detail",
                            "resume": resume_meta,
                        }
                        self.memory.add_message(
                            Message.from_tool_calls(
                                content=f"已读取简历《{resume_meta.get('name', '当前简历')}》，准备进行诊断...",
                                tool_calls=[detail_tool_call],
                            )
                        )
                        self.memory.add_message(
                            Message.tool_message(
                                content="获取简历详情执行成功",
                                name="get_resume_detail",
                                tool_call_id=detail_tool_call.id,
                            )
                        )

                        ask_message = (
                            f"已成功读取你的简历《{resume_meta.get('name', '当前简历')}》，在开始诊断前，我想了解一下你的目标：\n\n"
                            "%%SUGGESTIONS%%"
                            '[{"text":"告诉我目标岗位名称","msg":"","template":"我的目标岗位是{input}，请基于这个方向做诊断"},'
                            '{"text":"发送目标职位的 JD","msg":"我有一份目标职位的 JD，请根据 JD 做定向匹配诊断"},'
                            '{"text":"先做通用简历诊断","msg":"先做通用简历诊断吧，暂不指定岗位"}'
                            ']%%END%%'
                        )
                        self.memory.add_message(Message.assistant_message(ask_message))
                        self.tool_calls = [detail_tool_call]
                        from backend.agent.schema import AgentState
                        self.state = AgentState.FINISHED
                        logger.info("✅ ANALYZE_RESUME Phase 1: asked for target position")
                        return False

                    # Phase 2: 用户已选择诊断方向，执行完整诊断
                    logger.info(f"✅ ANALYZE_RESUME Phase 2: proceeding with diagnosis (context: {user_text[:50]})")

                    # 1. 并行委托分析器（获取结构化评分/问题）
                    analysis_results = await self._parallel_delegate_analyzers(analyzers or [])
                    diagnosis_payload = self._build_resume_diagnosis_payload(
                        analysis_results,
                        resume_data_snapshot,
                    )

                    # 2. 显式发出两步工具调用序列（用于前端 tool cards）
                    detail_tool_call = ToolCall(
                        id=f"call_get_resume_detail_{int(time.time() * 1000)}",
                        function={"name": "get_resume_detail", "arguments": "{}"},
                    )
                    diagnosis_tool_call = ToolCall(
                        id=f"call_resume_diagnosis_{int(time.time() * 1000) + 1}",
                        function={"name": "resume-diagnosis", "arguments": "{}"},
                    )
                    self._tool_structured_results[detail_tool_call.id] = {
                        "type": "resume_detail",
                        "status": "success",
                        "tool": "get_resume_detail",
                        "resume": diagnosis_payload["resume_meta"],
                    }
                    self._tool_structured_results[diagnosis_tool_call.id] = diagnosis_payload["structured"]
                    self.memory.add_message(
                        Message.from_tool_calls(
                            content="正在执行简历深度诊断...",
                            tool_calls=[detail_tool_call, diagnosis_tool_call],
                        )
                    )
                    self.memory.add_message(Message.tool_message(content="获取简历详情执行成功", name="get_resume_detail", tool_call_id=detail_tool_call.id))
                    self.memory.add_message(Message.tool_message(content="resume-diagnosis执行成功", name="resume-diagnosis", tool_call_id=diagnosis_tool_call.id))

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
                    target_index = resolve_experience_target_index(
                        user_input, resume_data_snapshot or {}
                    )
                    experiences = (resume_data_snapshot or {}).get("experience") or []

                    if not experiences:
                        content = (
                            "当前简历里还没有可优化的实习/工作经历。"
                            "您可以先导入一段，再让我帮您优化表述。"
                        )
                        self.memory.add_message(Message.assistant_message(content))
                        from backend.agent.schema import AgentState
                        self.state = AgentState.FINISHED
                        return False

                    if target_index is None:
                        if len(experiences) > 1:
                            content = self._build_optimize_target_clarification_message(
                                experiences
                            )
                            self.memory.add_message(Message.assistant_message(content))
                            from backend.agent.schema import AgentState
                            self.state = AgentState.FINISHED
                            logger.info(
                                "✅ OPTIMIZE_SECTION: asked user to pick experience target"
                            )
                            return False
                        target_index = 0

                    resolved_idx = target_index

                    suggestions: Optional[Dict[str, Any]] = None
                    if resolved_idx is not None and resolved_idx < len(experiences):
                        suggestions = await self._llm_optimize_section_patch(
                            user_input,
                            resume_data_snapshot or {},
                            resolved_idx,
                        )

                    suggestions_list = (suggestions or {}).get("optimization_suggestions") or []
                    patch_count = self._queue_optimization_patches(suggestions_list)
                    default_label = "实习经历"
                    if resolved_idx is not None and resolved_idx < len(experiences):
                        default_label = (
                            re.sub(
                                r"\*+",
                                "",
                                str(experiences[resolved_idx].get("company") or default_label),
                            ).strip()
                            or default_label
                        )
                    content = self._optimization_assistant_reply(
                        suggestions or {"optimization_suggestions": []},
                        patch_count=patch_count,
                        default_label=default_label,
                    )
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
                    suggestions_list = suggestions.get("optimization_suggestions") or []
                    patch_count = self._queue_optimization_patches(suggestions_list)
                    if patch_count > 0:
                        content = self._optimization_assistant_reply(
                            suggestions,
                            patch_count=patch_count,
                            default_label="简历",
                        )
                    else:
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

        # 🎯 GREETING：直接调用 LLM，不传工具（减少 payload，速度更快）
        if intent == Intent.GREETING:
            logger.info("👋 GREETING: fast path without tools")
            base_system_prompt, _ = await self._generate_dynamic_prompts(user_input, intent)
            system_content = f"{base_system_prompt}\n\n{GREETING_FAST_PATH_PROMPT}"
            try:
                raw = await self.llm.ask(
                    messages=[{"role": "user", "content": user_input}],
                    system_msgs=[{"role": "system", "content": system_content}],
                    stream=False,
                    temperature=0.4,
                )
                if raw and raw.strip():
                    self.memory.add_message(Message.assistant_message(raw.strip()))
                    from backend.agent.schema import AgentState
                    self.state = AgentState.FINISHED
                    return False
            except Exception as _greeting_err:
                logger.warning(f"👋 GREETING fast path failed, falling back: {_greeting_err}")
            # 回退到父类 think()（带工具）
            self.system_prompt = system_content
            self.next_step_prompt = ""
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
