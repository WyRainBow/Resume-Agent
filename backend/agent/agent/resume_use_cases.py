"""简历用例服务（Wave 2a-S3）：诊断 / 优化 / 委托分析，从 Manus 纯搬运迁出。

包含：analyzer 委托与报告格式化、简历诊断 payload 构造、单段/单字段/整份
优化（含 LLM JSON 容错解析四函数）、优化建议文案拼装。不改任何行为——
外部依赖显式注入：llm / session_id / turn_state（patch 队列）/
base_prompt_provider（复用 PromptBuilder 产物）/ stream_callback_provider
（进度思考流回调，随流建立/清除动态取值）。
"""

import asyncio
import json
import re
from typing import Any, Awaitable, Callable, Dict, List, Optional

from backend.agent.agent.registry import AgentRegistry
from backend.agent.agent.turn_state import TurnExecutionState
from backend.agent.memory import Intent
from backend.agent.prompt.manus import OPTIMIZE_SECTION_LLM_ADDENDUM
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.utils.experience_entry import (
    OptimizeTarget,
    build_optimization_resume_patch,
    build_optimize_clarification_suggestions,
    list_optimize_targets,
)
from backend.agent.utils.resume_richtext import html_to_context_text, normalize_editor_value
from backend.core.logger import get_logger

logger = get_logger(__name__)

# 规则版优化文案里的噪音括注（随优化用例自 manus.py 迁入）
_RULE_BASED_NOISE_RE = re.compile(r"[（(]建议补充量化结果[^）)]*[）)]")


class ResumeUseCases:
    """简历诊断/优化/分析用例；方法体与原 Manus 实现逐行一致（纯搬运）。"""

    def __init__(
        self,
        llm_provider: Callable[[], Any],
        session_id: Optional[str],
        turn_state: TurnExecutionState,
        base_prompt_provider: Callable[..., Awaitable[tuple]],
        stream_callback_provider: Callable[[], Optional[Callable[[str], Awaitable[None]]]],
    ) -> None:
        # llm 用 provider:Manus.llm 在 initialize_helper 之后才由 base.initialize_agent
        # 赋值,构造期固化引用会拿到 None
        self._llm_provider = llm_provider
        self._session_id = session_id
        self._turn = turn_state
        self._base_prompt_provider = base_prompt_provider
        self._stream_callback_provider = stream_callback_provider

    @property
    def _llm(self) -> Any:
        return self._llm_provider()

    async def delegate_to_agent(self, agent_name: str, **kwargs) -> Any:
        """Delegate tasks to a registered sub-agent."""
        agent = AgentRegistry.create(agent_name, session_id=self._session_id)

        resume_data = kwargs.get("resume_data")
        if resume_data is None:
            resume_data = ResumeDataStore.get_data(self._session_id)

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
        target: OptimizeTarget,
    ) -> Optional[Dict[str, Any]]:
        """用 Manus 主 LLM + Hybrid 简历 context 生成优化 diff（恢复改前高质量路径）。"""
        entries = resume_data.get(target.array_path) or []
        if not isinstance(entries, list) or target.index < 0 or target.index >= len(entries):
            return None

        target_entry = entries[target.index]
        if not isinstance(target_entry, dict):
            return None

        company = re.sub(r"\*+", "", target.label).strip() or "该段经历"
        position = str(
            target_entry.get("position") or target_entry.get("role") or ""
        ).strip()
        apply_path = f"{target.array_path}[{target.index}].{target.value_field}"
        section_cn = {
            "opensource": "开源经历",
            "projects": "项目经历",
            "education": "教育经历",
            "awards": "荣誉奖项",
        }.get(target.section_kind, "实习/工作经历")

        raw_details = (
            target_entry.get(target.value_field)
            or target_entry.get("details")
            or target_entry.get("description")
            or ""
        )
        current_plain = _RULE_BASED_NOISE_RE.sub(
            "", html_to_context_text(str(raw_details))
        ).strip()
        if not current_plain:
            current_plain = "（空）"

        base_system, _ = await self._base_prompt_provider(
            user_input, Intent.OPTIMIZE_SECTION
        )
        system_prompt = f"{base_system}\n\n{OPTIMIZE_SECTION_LLM_ADDENDUM}"
        user_prompt = (
            f"请优化 path={apply_path} 对应的{section_cn}。\n"
            f"标题：{company}\n"
            f"岗位/角色：{position or '（未填写）'}\n"
            f"用户原话：{user_input.strip() or '优化表述，突出贡献与量化成果'}\n\n"
            f"当前内容（纯文本，请在此基础上深度改写）：\n{current_plain[:2800]}"
        )
        if target.section_kind in ("education", "awards"):
            user_prompt += (
                f"\n\n【注意】这是{section_cn}的描述，不是工作经历："
                "不要套「做了什么/技术手段/量化指标」四要素，"
                "改写为简洁有条理的亮点描述（如主修方向、核心成果、排名、奖项级别与含金量），"
                "保留原文全部真实信息，不编造。"
            )
        session_jd = ResumeDataStore.get_session_jd(self._session_id)
        if session_jd:
            user_prompt += (
                f"\n\n【目标岗位 JD（改写时对齐其要求、融入匹配的关键词）】\n{session_jd[:1500]}"
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
                raw = await self._llm.ask(
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
            f"[Manus] LLM optimize section ok: label={company}, "
            f"path={apply_path}, chars={len(optimized_html)}"
        )
        section_label = {
            "opensource": "开源经历",
            "projects": "项目经历",
            "education": "教育经历",
            "awards": "获奖描述",
        }.get(target.section_kind, "实习经历")
        return {
            "optimization_suggestions": [
                {
                    "title": f"优化 {company} 的{section_label}",
                    "current": current_plain[:900],
                    "optimized": optimized_html,
                    "explanation": explanation,
                    "apply_path": apply_path,
                }
            ]
        }

    async def _llm_optimize_field_patch(
        self,
        user_input: str,
        resume_data: Dict[str, Any],
        field: str,
        label: str,
    ) -> Optional[Dict[str, Any]]:
        """优化单个字符串字段（专业技能 skillContent / 自我评价 selfEvaluation）——非数组段落。"""
        raw = resume_data.get(field)
        if not isinstance(raw, str) or not raw.strip():
            return None
        current_plain = _RULE_BASED_NOISE_RE.sub(
            "", html_to_context_text(str(raw))
        ).strip()
        if not current_plain:
            return None

        base_system, _ = await self._base_prompt_provider(
            user_input, Intent.OPTIMIZE_SECTION
        )
        system_prompt = f"{base_system}\n\n{OPTIMIZE_SECTION_LLM_ADDENDUM}"
        user_prompt = (
            f"请优化 path={field} 对应的{label}。\n"
            f"用户原话：{user_input.strip() or '优化表述，使其更专业、有条理'}\n\n"
            f"当前内容（纯文本，请在此基础上改写）：\n{current_plain[:2800]}"
        )
        session_jd = ResumeDataStore.get_session_jd(self._session_id)
        if session_jd:
            user_prompt += (
                f"\n\n【目标岗位 JD（改写时对齐其要求、融入匹配的关键词）】\n{session_jd[:1500]}"
            )
        retry_suffix = (
            "\n\n【重要】不要输出思考过程。"
            "只输出一行 JSON，第一字符必须是 {，包含 optimized_html 与 explanation。"
        )

        parsed: Optional[Dict[str, Any]] = None
        for attempt in range(2):
            prompt = user_prompt if attempt == 0 else f"{user_prompt}{retry_suffix}"
            try:
                raw_out = await self._llm.ask(
                    messages=[{"role": "user", "content": prompt}],
                    system_msgs=[{"role": "system", "content": system_prompt}],
                    stream=False,
                    temperature=0.55,
                )
            except Exception as exc:
                logger.warning(f"[Manus] LLM optimize field failed: {exc}")
                return None
            parsed = self._parse_optimize_llm_json(raw_out or "")
            if parsed:
                break

        if not parsed:
            return None
        optimized_html = str(
            parsed.get("optimized_html") or parsed.get("optimized") or ""
        ).strip()
        if not optimized_html:
            return None
        optimized_html = str(normalize_editor_value(optimized_html, field)).strip()
        explanation = str(parsed.get("explanation") or "").strip() or (
            f"按更专业、有条理的表达重写{label}。"
        )
        return {
            "optimization_suggestions": [
                {
                    "title": f"优化{label}",
                    "current": current_plain[:900],
                    "optimized": optimized_html,
                    "explanation": explanation,
                    "apply_path": field,
                }
            ]
        }

    async def _emit_stream_thought(self, text: str) -> None:
        """通过实时流式回调把一段文本作为「思考」推给前端（进思考区、不污染最终回复）。
        用于长任务的进度反馈（如整份优化的「已完成 N/M」）；无回调时静默跳过。"""
        cb = self._stream_callback_provider()
        if not cb:
            return
        try:
            await cb(text)
        except Exception as exc:  # 进度反馈失败不影响主流程
            logger.debug(f"[Manus] 进度流式回调失败（忽略）: {exc}")

    async def _optimize_whole_resume(
        self, user_input: str, resume_data: Dict[str, Any]
    ) -> tuple[str, int]:
        """一键优化整份简历：对所有实习/工作、项目、开源 + 专业技能 + 自我评价并行生成优化对比。
        开跑先报总段数，每段完成实时推「✓ 已优化 X（N/M）」进度（思考区），最终回复列出优化了哪几段。
        返回 (回复文案, 补丁数)。"""
        import asyncio

        async def _run(
            label: str, coro
        ) -> tuple[str, Optional[Dict[str, Any]]]:
            try:
                return label, await coro
            except Exception as exc:
                logger.warning(f"[Manus] 整份优化子任务失败 label={label}: {exc}")
                return label, None

        tasks = [
            _run(
                t.label or "该段经历",
                self._llm_optimize_section_patch(user_input, resume_data, t),
            )
            for t in list_optimize_targets(resume_data)
        ]
        for field, label in (("skillContent", "专业技能"), ("selfEvaluation", "自我评价")):
            val = resume_data.get(field)
            if isinstance(val, str) and val.strip():
                tasks.append(
                    _run(
                        label,
                        self._llm_optimize_field_patch(user_input, resume_data, field, label),
                    )
                )
        if not tasks:
            return (
                "当前简历里还没有可优化的内容，先导入简历或补一段经历，我再帮你整体优化。",
                0,
            )

        total_sections = len(tasks)
        # 开跑先给总段数，把「30s 黑箱」变成有边界的进度（前端思考区显示，替换「思考中…」）
        await self._emit_stream_thought(
            f"思考：正在逐段优化你的简历（共 {total_sections} 段）、完成一段更新一条…\n"
        )

        total = 0
        processed = 0
        done_labels: List[str] = []
        # as_completed：每段一完成就入队 patch + 实时推进度（增量追加，天然渐进可见）
        for fut in asyncio.as_completed(tasks):
            label, res = await fut
            processed += 1
            clean_label = re.sub(r"\*+", "", label).strip() or "该段"
            if not res:
                await self._emit_stream_thought(
                    f"·「{clean_label}」本段无可优化内容（{processed}/{total_sections}）\n"
                )
                continue
            items = res.get("optimization_suggestions") or []
            queued = self._queue_optimization_patches(items)
            if queued > 0:
                total += queued
                done_labels.append(clean_label)
                await self._emit_stream_thought(
                    f"✓ 已优化「{clean_label}」（{processed}/{total_sections}）\n"
                )
            else:
                await self._emit_stream_thought(
                    f"·「{clean_label}」本段无可优化内容（{processed}/{total_sections}）\n"
                )

        if total <= 0:
            return ("这次没能生成可用的优化对比，请稍后再试。", 0)
        listed = "、".join(done_labels[:6]) + ("等" if len(done_labels) > 6 else "")
        return (
            f"已优化：{listed}，共 {total} 处对比。"
            "可以逐条确认，也可以点下方「全部应用」一键写入。",
            total,
        )

    def _queue_optimization_patches(self, suggestions: List[Dict[str, Any]]) -> int:
        """将优化建议转为 resume_patch，返回成功入队数量。"""
        count = 0
        for suggestion in suggestions:
            optimized = str(suggestion.get("optimized") or "").strip()
            apply_path = str(suggestion.get("apply_path") or "").strip()
            if not optimized or not apply_path or apply_path == "experience":
                continue
            self._turn.queue_patch(build_optimization_resume_patch(suggestion))
            count += 1
        return count

    @staticmethod
    def _optimize_next_step_suggestions_block(
        refine_label: str = "", refine_section_cn: str = ""
    ) -> str:
        """优化完一段后的「下一步」建议（前端点击即自动发送）。
        传入具体优化目标（条目名 + 段类型）时，附「针对这一段」的一键微调维度
        （更简洁 / 更突出成果 / 换更有力的动词）——点了发一句以「优化」开头、带条目名的
        自然语言，稳定命中 OPTIMIZE_SECTION 并走 input-only 精确匹配路由回同一段再改一版
        （防上下文劫持），维度作为「用户原话」进 LLM prompt。"""
        next_items: List[Dict[str, str]] = []
        if refine_section_cn:
            tgt = (
                f"{refine_label}的{refine_section_cn}"
                if refine_label
                else refine_section_cn
            )
            next_items += [
                {"text": "更简洁", "msg": f"优化{tgt}，改得更简洁精炼一些"},
                {"text": "更突出成果", "msg": f"优化{tgt}，更突出量化数据和成果"},
                {"text": "换更有力的动词", "msg": f"优化{tgt}，多用有力的动作动词"},
            ]
        next_items.append({"text": "✨ 优化整份简历", "msg": "优化我的整份简历"})
        return f"\n\n%%SUGGESTIONS%%{json.dumps(next_items, ensure_ascii=False)}%%END%%"

    def _optimization_assistant_reply(
        self,
        suggestions: Dict[str, Any],
        *,
        patch_count: int,
        default_label: str = "实习经历",
        with_next: bool = False,
        refine_label: str = "",
        refine_section_cn: str = "",
    ) -> str:
        """优化结果有 diff 卡片时用短回复，否则回退 markdown 长文。
        refine_label / refine_section_cn 传入具体优化目标时，收尾追问「满意吗」并附一键微调。"""
        if patch_count <= 0:
            label = re.sub(r"\*+", "", default_label).strip() or "该段经历"
            if label not in ("实习经历", "简历"):
                return f"暂时未能为「{label}」生成优化对比，请稍后重试。"
            return "未生成可用的优化建议，请稍后重试或指定要优化的经历。"

        items = suggestions.get("optimization_suggestions") or []
        if refine_label:
            label = re.sub(r"\*+", "", refine_label).strip() or default_label
        else:
            label = default_label
            if items:
                title = str(items[0].get("title") or "").strip()
                title_match = re.match(
                    r"优化\s*(.+?)(?:的)?(?:实习经历|开源经历)\s*$",
                    title,
                )
                if title_match:
                    label = re.sub(r"\*+", "", title_match.group(1)).strip() or default_label
                elif title.startswith("优化 "):
                    label = re.sub(r"\*+", "", title[3:]).strip() or default_label
            label = re.sub(r"\*+", "", label).strip() or default_label

        if patch_count == 1:
            reply = f"已为「{label}」生成优化对比，看看满意吗——可以直接点卡片应用"
            if with_next and refine_section_cn:
                reply += "，或让我换个方向再改一版："
            else:
                reply += "。"
        else:
            reply = f"已生成 {patch_count} 处优化对比，请在下方卡片逐条确认是否应用。"
        if with_next:
            reply += self._optimize_next_step_suggestions_block(
                refine_label, refine_section_cn
            )
        return reply

    @staticmethod
    def _build_optimize_target_clarification_message(
        resume_data: Dict[str, Any],
        *,
        intro: Optional[str] = None,
        section_kind: Optional[str] = None,
        include_all: bool = True,
    ) -> str:
        """未指定优化目标且有多段时，列出可选项并附带快捷按钮。
        section_kind 传入时只列该类；include_all 时顶部加「全部一起优化」。"""
        items = build_optimize_clarification_suggestions(
            resume_data, section_kind, include_all=include_all
        )
        suggestions_json = json.dumps(items, ensure_ascii=False)
        lead = intro or "好的！在优化之前，请问您想优化哪一段？"
        return f"{lead}\n\n%%SUGGESTIONS%%{suggestions_json}%%END%%"
