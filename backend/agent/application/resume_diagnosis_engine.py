"""LLM-backed resume diagnosis with a deterministic structural fallback."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Awaitable, Callable, Mapping

from backend.agent.application.resume_diagnosis import build_resume_diagnosis
from backend.agent.llm import LLM
from backend.agent.schema import ToolChoice
from backend.agent.utils.resume_context import redact_resume_for_llm
from backend.core.logger import get_logger

logger = get_logger(__name__)

@dataclass(frozen=True)
class DiagnosisProgress:
    content: str
    index: int
    total: int


DiagnosisProgressCallback = Callable[[DiagnosisProgress], Awaitable[None]]
DEFAULT_DIAGNOSIS_PROGRESS_INTERVAL_SECONDS = 1.6

_EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")

_SUBMIT_DIAGNOSIS_TOOL = {
    "type": "function",
    "function": {
        "name": "submit_resume_diagnosis",
        "description": "Submit an evidence-grounded qualitative resume diagnosis.",
        "parameters": {
            "type": "object",
            "properties": {
                "public_trace": {
                    "type": "array",
                    "minItems": 4,
                    "maxItems": 4,
                    "items": {"type": "string"},
                    "description": (
                        "Four concise user-visible progress narrations in this order: "
                        "structure completeness, achievement evidence, interview risk, job matching."
                    ),
                },
                "overall_evaluation": {"type": "string"},
                "strengths": {"type": "array", "items": {"type": "string"}},
                "must_fix": {"type": "array", "items": {"type": "string"}},
                "should_fix": {"type": "array", "items": {"type": "string"}},
                "optional": {"type": "array", "items": {"type": "string"}},
                "dimension_descriptions": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string"},
                        "interview": {"type": "string"},
                        "matching": {"type": "string"},
                    },
                    "required": ["content", "interview", "matching"],
                    "additionalProperties": False,
                },
            },
            "required": [
                "public_trace",
                "overall_evaluation",
                "strengths",
                "must_fix",
                "should_fix",
                "optional",
                "dimension_descriptions",
            ],
            "additionalProperties": False,
        },
    },
}

# 逐条修改建议的字段 schema（诊断轮与建议轮共用条目形状）。
# 2026-07-16 拆分：suggestions 从诊断轮剥离——它是诊断输出 token 的大头，
# 与打分/发现挤在同一次 LLM 调用里拖慢诊断；改为用户点「查看修改建议」时
# 由 suggest() 单独生成（见 ResumeGuidanceModule.suggest）。
_SUGGESTION_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "section": {"type": "string"},
        "severity": {
            "type": "string",
            "enum": ["critical", "warning", "suggestion"],
        },
        "original": {"type": "string"},
        "recommendation": {"type": "string"},
        "proposed": {"type": "string"},
        "evidence": {"type": "string"},
        "requires_facts": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": [
        "title",
        "section",
        "severity",
        "original",
        "recommendation",
        "evidence",
        "requires_facts",
    ],
    "additionalProperties": False,
}

_SUBMIT_SUGGESTIONS_TOOL = {
    "type": "function",
    "function": {
        "name": "submit_resume_suggestions",
        "description": "Submit 3-5 concrete, evidence-grounded resume improvement suggestions.",
        "parameters": {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 5,
                    "items": _SUGGESTION_ITEM_SCHEMA,
                },
            },
            "required": ["suggestions"],
            "additionalProperties": False,
        },
    },
}

_SUGGESTIONS_SYSTEM_PROMPT = """你是一名严谨、友善的资深招聘顾问。基于给出的诊断结论和简历正文，生成 3-5 条具体修改建议。

要求：
1. 建议必须引用简历原文或明确缺口作为依据，不能套话，不得要求再次分析。
2. 缺少院校、日期、邮箱、GPA、量化结果等事实时，requires_facts 写明需要用户补什么，proposed 留空；严禁用示例值冒充成品。
3. proposed 只有在不新增事实、能直接基于原文安全改写时才填写。
4. 不复述姓名、电话、邮箱等个人敏感信息，不虚构简历里没有的事实。
5. 优先覆盖诊断结论中 must_fix / should_fix 指出的问题，调用 submit_resume_suggestions 提交。"""

_SYSTEM_PROMPT = """你是一名严谨、友善的资深招聘顾问。请基于给出的简历正文和结构基线做真实诊断。

要求：
1. 结论必须有简历中的具体字段、事实或缺失项作为依据，不能套话。
2. 覆盖结构完整度、成果证据、面试风险、岗位匹配四个方向。
3. public_trace 是给用户看的加工后诊断轨迹，不是原始思维链：每条只写“核对了什么 + 看到了什么证据/缺口 + 当前判断”，不要写自我辩论、概率猜测或内部指令。
4. 不复述姓名、电话、邮箱等个人敏感信息，不虚构简历里没有的事实。
5. 本轮只做诊断，不生成逐条修改建议（用户点「查看修改建议」时另行生成）。
6. 分数由结构基线负责；你只提交有证据的定性结论，并调用 submit_resume_diagnosis。"""


@lru_cache(maxsize=1)
def _guidance_system_prompt() -> str:
    skills_root = Path(__file__).resolve().parents[1] / "skills"
    parts = [_SYSTEM_PROMPT]
    for skill_name in ("resume-diagnosis", "resume-suggest"):
        skill_path = skills_root / skill_name / "SKILL.md"
        content = skill_path.read_text(encoding="utf-8").strip()
        if not content:
            raise RuntimeError(f"resume guidance Skill is empty: {skill_path}")
        parts.append(f"[Skill: {skill_name}]\n{content}")
    return "\n\n".join(parts)


def _clean_text(value: Any, *, max_length: int = 300) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    text = _EMAIL_RE.sub("[邮箱已隐藏]", text)
    text = _PHONE_RE.sub("[电话已隐藏]", text)
    return text[:max_length].strip()


def _clean_list(value: Any, fallback: list[str]) -> list[str]:
    if not isinstance(value, list):
        return list(fallback)
    cleaned = [_clean_text(item) for item in value]
    cleaned = [item for item in cleaned if item]
    return cleaned[:3] or list(fallback)


def _fallback_trace(payload: Mapping[str, Any]) -> list[str]:
    details = payload.get("details") or {}
    issues = details.get("issues") or {}
    dimensions = details.get("dimensions") or {}
    must_fix = issues.get("must_fix") or []
    should_fix = issues.get("should_fix") or []
    strengths = details.get("strengths") or []

    structure_evidence = (must_fix or should_fix or ["主要模块已经具备可分析内容。"])[0]
    achievement_evidence = (strengths or should_fix or ["经历中的动作与结果证据仍需继续核对。"])[0]
    interview_evidence = (dimensions.get("interview") or {}).get(
        "description", "已核对经历是否足以支撑面试追问。"
    )
    matching_evidence = (dimensions.get("matching") or {}).get(
        "description", "已核对求职方向、技能与经历之间的对应关系。"
    )
    return [
        _clean_text(f"先核对结构完整度：{structure_evidence}"),
        _clean_text(f"再看成果证据：{achievement_evidence}"),
        _clean_text(f"接着检查面试风险：{interview_evidence}"),
        _clean_text(f"最后核对岗位匹配：{matching_evidence}"),
    ]


def _resume_context(resume_data: Mapping[str, Any]) -> str:
    return json.dumps(redact_resume_for_llm(resume_data), ensure_ascii=False, indent=2)


def _tool_arguments(response: Any) -> dict[str, Any]:
    calls = getattr(response, "tool_calls", None) or []
    if not calls:
        raise ValueError("diagnosis model did not call submit_resume_diagnosis")
    function = getattr(calls[0], "function", None)
    arguments = getattr(function, "arguments", None)
    if isinstance(arguments, str):
        arguments = json.loads(arguments)
    if not isinstance(arguments, dict):
        raise ValueError("diagnosis tool arguments are not an object")
    return arguments


def _resume_revision(resume_data: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        resume_data,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:20]


def _normalize_section(value: Any) -> str:
    raw = _clean_text(value, max_length=40)
    lowered = raw.lower()
    aliases = (
        (("教育", "院校", "gpa"), "education"),
        (("项目", "开源"), "projects"),
        (("工作", "实习", "职业", "经历", "成果"), "experience"),
        (("技能", "技术栈"), "skills"),
        (("基本", "求职", "目标岗位"), "basic"),
        (("整体", "全局"), "overall"),
    )
    for keywords, normalized in aliases:
        if any(keyword in lowered for keyword in keywords):
            return normalized
    ascii_section = re.sub(r"[^a-z0-9_-]", "", lowered)
    return ascii_section or "overall"


def _required_facts_for_issue(issue: str) -> list[str]:
    if "教育经历为空" in issue or "院校名称" in issue:
        return ["真实院校", "专业", "学历", "在读时间"]
    if "工作或实习经历为空" in issue:
        return ["真实工作或实习经历"]
    if "项目经历" in issue and ("为空" in issue or "偏弱" in issue):
        return ["真实项目经历"]
    if "目标岗位未明确" in issue:
        return ["目标岗位"]
    if "完整时间范围" in issue:
        return ["真实起止时间"]
    if "量化结果" in issue:
        return ["可核验的真实成果数据"]
    return []


def _baseline_suggestions(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    details = payload.get("details") or {}
    issues = details.get("issues") if isinstance(details, Mapping) else {}
    suggestions: list[dict[str, Any]] = []
    groups = (
        ("critical", (issues or {}).get("must_fix") or []),
        ("warning", (issues or {}).get("should_fix") or []),
        ("suggestion", (issues or {}).get("optional") or []),
    )
    for severity, items in groups:
        for raw_issue in items:
            issue = _clean_text(raw_issue, max_length=360)
            if not issue:
                continue
            requires_facts = _required_facts_for_issue(issue)
            section = _normalize_section(issue)
            recommendation = (
                f"补充{'、'.join(requires_facts)}，只填写可以核验的真实信息。"
                if requires_facts
                else f"围绕“{issue.rstrip('。')}”调整对应模块，保留原有事实并把动作、证据和岗位价值写清楚。"
            )
            suggestions.append(
                {
                    "title": issue.rstrip("。")[:48],
                    "section": section,
                    "severity": severity,
                    "original": issue,
                    "recommendation": recommendation,
                    "evidence": issue,
                    "requires_facts": requires_facts,
                }
            )
            if len(suggestions) >= 5:
                return suggestions

    # An unusually complete or sparse baseline can expose fewer than three issue
    # rows.  Complete the contract with dimension-grounded review advice instead
    # of accepting an undersized model payload or padding duplicate placeholders.
    dimensions = details.get("dimensions") if isinstance(details, Mapping) else {}
    supplements = (
        (
            "强化成果证据",
            "experience",
            "检查每段核心经历是否同时写清动作、技术手段和可验证结果。",
            ((dimensions or {}).get("content") or {}).get("description", ""),
        ),
        (
            "补足面试可追问细节",
            "experience",
            "为关键经历补充难点、个人决策和结果依据，保留所有真实信息。",
            ((dimensions or {}).get("interview") or {}).get("description", ""),
        ),
        (
            "聚焦目标岗位匹配",
            "basic",
            "把求职方向、技能与核心经历对齐到同一个目标岗位，不新增未核实事实。",
            ((dimensions or {}).get("matching") or {}).get("description", ""),
        ),
    )
    existing_titles = {item["title"] for item in suggestions}
    for title, section, recommendation, evidence in supplements:
        if len(suggestions) >= 3:
            break
        if title in existing_titles:
            continue
        suggestions.append(
            {
                "title": title,
                "section": section,
                "severity": "suggestion",
                "original": _clean_text(evidence) or "该维度需要继续加强证据表达。",
                "recommendation": recommendation,
                "evidence": _clean_text(evidence) or "结构基线提示该维度仍有提升空间。",
                "requires_facts": [],
            }
        )
        existing_titles.add(title)
    return suggestions[:5]


def _normalize_suggestions(
    raw: Any,
    *,
    fallback: list[dict[str, Any]],
    assessment_id: str,
    revision: str,
) -> list[dict[str, Any]]:
    source = raw if isinstance(raw, list) and raw else fallback
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(source[:5]):
        if not isinstance(item, Mapping):
            continue
        title = _clean_text(item.get("title"), max_length=80)
        recommendation = _clean_text(item.get("recommendation"), max_length=500)
        evidence = _clean_text(item.get("evidence"), max_length=360)
        if not title or not recommendation or not evidence:
            continue
        severity = str(item.get("severity") or "suggestion")
        if severity not in {"critical", "warning", "suggestion"}:
            severity = "suggestion"
        section = _normalize_section(item.get("section"))
        requires_raw = item.get("requires_facts")
        requires_facts = (
            [_clean_text(value, max_length=80) for value in requires_raw]
            if isinstance(requires_raw, list)
            else []
        )
        requires_facts = [value for value in requires_facts if value][:6]
        suggestion_key = f"{revision}|{section}|{title}|{index}"
        normalized_item: dict[str, Any] = {
            "suggestion_id": "suggestion_"
            + hashlib.sha256(suggestion_key.encode("utf-8")).hexdigest()[:16],
            "assessment_id": assessment_id,
            "section": section,
            "severity": severity,
            "title": title,
            "original": _clean_text(item.get("original"), max_length=500),
            "recommendation": recommendation,
            "evidence": evidence,
            "requires_facts": requires_facts,
            "status": "needs_fact" if requires_facts else "proposed",
            "resume_ref": {"revision": revision},
        }
        proposed = _clean_text(item.get("proposed"), max_length=800)
        if proposed and not requires_facts:
            normalized_item["proposed"] = proposed
        normalized.append(normalized_item)
    if len(normalized) >= 3:
        return normalized
    if source is not fallback:
        return _normalize_suggestions(
            fallback,
            fallback=[],
            assessment_id=assessment_id,
            revision=revision,
        )
    return []


class ResumeGuidanceModule:
    """Deep module for one evidence-grounded diagnosis and its read-only advice."""

    def __init__(
        self,
        llm: Any | None = None,
        *,
        progress_interval_seconds: float = DEFAULT_DIAGNOSIS_PROGRESS_INTERVAL_SECONDS,
    ):
        self.llm = llm or LLM()
        self.progress_interval_seconds = max(
            0.001, float(progress_interval_seconds)
        )

    async def _request_diagnosis(
        self,
        *,
        user_prompt: str,
        system_prompt: str,
        progress_messages: list[str],
        on_progress: DiagnosisProgressCallback | None,
    ) -> Any:
        async def ask_llm() -> Any:
            return await self.llm.ask_tool(
                messages=[{"role": "user", "content": user_prompt}],
                system_msgs=[{"role": "system", "content": system_prompt}],
                tools=[_SUBMIT_DIAGNOSIS_TOOL],
                tool_choice=ToolChoice.REQUIRED,
                temperature=0.2,
            )

        if on_progress is None:
            return await ask_llm()

        request_task = asyncio.create_task(ask_llm())
        response: Any | None = None
        total = len(progress_messages)
        try:
            for index, content in enumerate(progress_messages):
                try:
                    await on_progress(
                        DiagnosisProgress(
                            content=content,
                            index=index,
                            total=total,
                        )
                    )
                except Exception as exc:
                    logger.warning(
                        "Resume diagnosis progress delivery failed at stage {}: {}",
                        index + 1,
                        type(exc).__name__,
                    )

                if request_task.done():
                    response = await request_task
                    break
                if index >= total - 1:
                    continue
                try:
                    response = await asyncio.wait_for(
                        asyncio.shield(request_task),
                        timeout=self.progress_interval_seconds,
                    )
                    break
                except asyncio.TimeoutError:
                    continue

            if response is None:
                response = await request_task
            return response
        except BaseException:
            if not request_task.done():
                request_task.cancel()
            await asyncio.gather(request_task, return_exceptions=True)
            raise

    @staticmethod
    def resume_revision(resume_data: Mapping[str, Any]) -> str:
        """Stable revision used to reject stale cached assessments."""
        return _resume_revision(resume_data)

    @staticmethod
    def present(
        assessment: Mapping[str, Any], mode: str
    ) -> dict[str, Any]:
        """Present one stored assessment without rerunning analysis."""
        assessment_id = str(assessment.get("assessment_id") or "")
        resume_ref = dict(assessment.get("resume_ref") or {})
        if mode == "diagnosis":
            artifact_id = str(assessment.get("artifact_id") or f"diagnosis_{assessment_id}")
            payload: Any = assessment
            kind = "resume_diagnosis"
            skill = "resume-diagnosis"
        elif mode == "suggestions":
            artifact_id = f"suggestions_{assessment_id}"
            payload = {
                "assessment_id": assessment_id,
                "suggestions": list(
                    ((assessment.get("details") or {}).get("suggestions") or [])
                ),
            }
            kind = "resume_suggestions"
            skill = "resume-suggest"
        else:
            raise ValueError(f"Unsupported resume guidance presentation: {mode}")
        return {
            "schema_version": str(assessment.get("schema_version") or "2.0"),
            "artifact_id": artifact_id,
            "kind": kind,
            "resume_ref": resume_ref,
            "source": {"skill": skill, "assessment_id": assessment_id},
            "payload": payload,
        }

    async def suggest(
        self,
        resume_data: Mapping[str, Any],
        assessment: dict[str, Any],
    ) -> dict[str, Any]:
        """基于已有诊断结论单独生成逐条修改建议（2026-07-16 诊断/建议拆分）。

        诊断轮不再产出 suggestions（拖慢诊断）；用户点「查看修改建议」时才
        跑这一次轻量 LLM 调用——grounding 直接复用已存 assessment 的结论与
        问题清单，不重算诊断。生成结果回写 assessment["details"]["suggestions"]
        （调用方负责把更新后的 assessment 存回 shared_state，实现重复查看
        缓存命中），返回 kind="resume_suggestions" 的 envelope。
        LLM 失败时回退结构基线建议（与诊断轮既有 fallback 语义一致）。
        """
        assessment_id = str(assessment.get("assessment_id") or "")
        revision = str(
            (assessment.get("resume_ref") or {}).get("revision")
            or _resume_revision(resume_data)
        )
        resume_id = str((assessment.get("resume_ref") or {}).get("id") or "")
        details = assessment.get("details") or {}
        fallback_suggestions = _baseline_suggestions(assessment)

        grounding = {
            "overall_evaluation": details.get("overall_evaluation") or "",
            "issues": details.get("issues") or {},
            "dimensions": details.get("dimensions") or {},
        }
        user_prompt = (
            f"诊断结论：\n{json.dumps(grounding, ensure_ascii=False)}\n\n"
            f"已屏蔽联系方式的简历正文：\n{_resume_context(resume_data)}"
        )

        raw_suggestions: Any = None
        try:
            response = await self.llm.ask_tool(
                messages=[{"role": "user", "content": user_prompt}],
                system_msgs=[{"role": "system", "content": _SUGGESTIONS_SYSTEM_PROMPT}],
                tools=[_SUBMIT_SUGGESTIONS_TOOL],
                tool_choice=ToolChoice.REQUIRED,
                temperature=0.2,
            )
            raw_suggestions = _tool_arguments(response).get("suggestions")
        except Exception as exc:
            # External AI boundary：建议生成失败时回退结构基线建议，
            # 与诊断轮的 heuristic_fallback 语义一致。
            logger.warning(
                "LLM resume suggestions request failed; using structural fallback: {}",
                type(exc).__name__,
            )

        normalized = _normalize_suggestions(
            raw_suggestions,
            fallback=fallback_suggestions,
            assessment_id=assessment_id,
            revision=revision,
        )
        for suggestion in normalized:
            suggestion["resume_ref"] = {"id": resume_id, "revision": revision}
        assessment.setdefault("details", {})["suggestions"] = normalized
        return self.present(assessment, "suggestions")

    async def assess(
        self,
        resume_data: Mapping[str, Any],
        question: str,
        *,
        on_progress: DiagnosisProgressCallback | None = None,
    ) -> dict[str, Any]:
        baseline = build_resume_diagnosis(resume_data)
        revision = _resume_revision(resume_data)
        resume_id = str((baseline.get("resume") or {}).get("id") or "")
        assessment_seed = f"{revision}|{_clean_text(question, max_length=200)}"
        assessment_id = "assessment_" + hashlib.sha256(
            assessment_seed.encode("utf-8")
        ).hexdigest()[:16]

        def finish(payload: dict[str, Any]) -> dict[str, Any]:
            payload["schema_version"] = "2.0"
            payload["assessment_id"] = assessment_id
            payload["resume_ref"] = {"id": resume_id, "revision": revision}
            payload["artifact_id"] = f"diagnosis_{assessment_id}"
            payload["kind"] = "resume_diagnosis"
            payload["source"] = {
                "skill": "resume-diagnosis",
                "assessment_id": assessment_id,
            }
            # 2026-07-16 拆分：诊断轮不再生成 suggestions（输出 token 大头，
            # 拖慢诊断）。用户点「查看修改建议」时由 suggest() 单独生成并回写
            # details.suggestions（见 cv_suggestions_agent 工具）。
            payload["details"]["suggestions"] = []
            # Phase 3 write/down-drill actions stay closed in the first read-only
            # release.  The artifacts keep stable IDs so a later structured
            # action transport can be added without reviving message-string routing.
            payload["details"]["actions"] = []
            return payload

        fallback_trace = _fallback_trace(baseline)
        compact_baseline = {
            "scores": baseline["summary"],
            "issues": baseline["details"]["issues"],
            "strengths": baseline["details"]["strengths"],
            "dimensions": baseline["details"]["dimensions"],
        }
        user_prompt = (
            f"用户诊断目标：{_clean_text(question, max_length=200)}\n\n"
            f"结构基线：\n{json.dumps(compact_baseline, ensure_ascii=False)}\n\n"
            f"已屏蔽联系方式的简历正文：\n{_resume_context(resume_data)}"
        )

        system_prompt = _guidance_system_prompt()
        progress_messages = [
            *fallback_trace,
            (
                "四个维度的证据已经核对完，我正在把问题按优先级收束，"
                "整理诊断结论。"
            ),
        ]
        try:
            response = await self._request_diagnosis(
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                progress_messages=progress_messages,
                on_progress=on_progress,
            )
        except Exception as exc:
            # External AI boundary: the product explicitly keeps the structural
            # baseline available when the provider is down or times out.
            logger.warning(
                "LLM resume diagnosis request failed; using structural fallback: {}",
                type(exc).__name__,
            )
            baseline["details"]["public_trace"] = fallback_trace
            baseline["details"]["diagnosis_source"] = "heuristic_fallback"
            return finish(baseline)

        try:
            diagnosis = _tool_arguments(response)
        except (AttributeError, TypeError, ValueError) as exc:
            # Invalid provider payload is an external-boundary validation failure,
            # not a reason to hide bugs in the local merge logic below.
            logger.warning(
                "LLM resume diagnosis payload invalid; using structural fallback: {}",
                type(exc).__name__,
            )
            baseline["details"]["public_trace"] = fallback_trace
            baseline["details"]["diagnosis_source"] = "heuristic_fallback"
            return finish(baseline)

        raw_trace = diagnosis.get("public_trace", [])
        if not isinstance(raw_trace, list):
            raw_trace = []
        trace = [_clean_text(item) for item in raw_trace]
        trace = [item for item in trace if item]
        if len(trace) != 4:
            trace = fallback_trace
            trace_source = "heuristic_calibration"
        else:
            trace_source = "llm"

        details = baseline["details"]
        details["overall_evaluation"] = _clean_text(
            diagnosis.get("overall_evaluation"), max_length=500
        ) or details["overall_evaluation"]
        details["strengths"] = _clean_list(
            diagnosis.get("strengths"), details["strengths"]
        )
        details["issues"]["must_fix"] = _clean_list(
            diagnosis.get("must_fix"), details["issues"]["must_fix"]
        )
        details["issues"]["should_fix"] = _clean_list(
            diagnosis.get("should_fix"), details["issues"]["should_fix"]
        )
        details["issues"]["optional"] = _clean_list(
            diagnosis.get("optional"), details["issues"]["optional"]
        )
        raw_dimensions = diagnosis.get("dimension_descriptions") or {}
        dimension_copy = raw_dimensions if isinstance(raw_dimensions, Mapping) else {}
        for key in ("content", "interview", "matching"):
            description = _clean_text(dimension_copy.get(key))
            if description:
                details["dimensions"][key]["description"] = description
        details["public_trace"] = trace
        details["trace_source"] = trace_source
        details["diagnosis_source"] = "llm"
        return finish(baseline)

    async def diagnose(
        self,
        resume_data: Mapping[str, Any],
        question: str,
    ) -> dict[str, Any]:
        """Compatibility Interface for existing callers during the migration."""
        return await self.assess(resume_data, question)


ResumeDiagnosisEngine = ResumeGuidanceModule
