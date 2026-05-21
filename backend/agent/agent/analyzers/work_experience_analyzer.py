import re
from typing import Dict, List, Optional

from backend.agent.agent.module.base_module_analyzer import BaseModuleAnalyzer
from backend.agent.agent.registry import AgentRegistry
from backend.agent.utils.resume_richtext import html_to_context_text

_METRICS_RE = re.compile(
    r"\d+[%％]?|\d+\s*(倍|x|X|个|ms|QPS|TPS|万|k|K|M|条|次|秒|分钟|小时|天|月|年)"
)
_ACTION_VERBS = (
    "负责",
    "主导",
    "参与",
    "设计",
    "实现",
    "优化",
    "搭建",
    "开发",
    "推动",
    "落地",
    "完成",
    "提升",
    "降低",
    "重构",
)

_RULE_BASED_NOISE_RE = re.compile(
    r"[（(]建议补充量化结果[^）)]*[）)]"
)


@AgentRegistry.register("work_experience_analyzer")
class WorkExperienceAnalyzerAgent(BaseModuleAnalyzer):
    """工作经历专项分析 Agent（分析走规则；optimize 仅作 LLM 失败时的兜底）"""

    name: str = "WorkExperienceAnalyzerAgent"
    module_name: str = "work_experience"
    module_display_name: str = "工作经历"

    @staticmethod
    def _plain_details(entry: Dict) -> str:
        raw = entry.get("details") or entry.get("description") or ""
        if not raw:
            return ""
        text = html_to_context_text(str(raw))
        text = _RULE_BASED_NOISE_RE.sub("", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    @staticmethod
    def _split_detail_lines(text: str) -> List[str]:
        lines: List[str] = []
        for line in re.split(r"[\n；;]+", text or ""):
            cleaned = re.sub(r"^[\d\-•·.]+\s*", "", line.strip())
            if cleaned:
                lines.append(cleaned)
        return lines

    def _analyze_single_experience(
        self,
        idx: int,
        exp: Dict,
        *,
        force_suggestions: bool = False,
    ) -> List[Dict]:
        company = exp.get("company") or "未知公司"
        position = exp.get("position") or "未知岗位"
        details = self._plain_details(exp)
        issues: List[Dict] = []

        if not details:
            issues.append(
                self._create_issue(
                    f"work-missing-detail-{idx}",
                    f"{company} 的经历缺少细节描述",
                    "medium",
                    "补充职责、行动和成果，尽量量化指标",
                    company=company,
                    position=position,
                    current="（空）",
                )
            )
            return issues

        excerpt = details[:900] + ("..." if len(details) > 900 else "")
        preview = self._build_optimized_preview(exp)

        if not _METRICS_RE.search(details):
            issues.append(
                self._create_issue(
                    f"work-missing-metrics-{idx}",
                    f"{company} 的经历可补充量化成果",
                    "medium",
                    "在关键行动后补充可衡量指标，如性能提升比例、吞吐/QPS、延迟、处理量级等",
                    company=company,
                    position=position,
                    current=excerpt,
                    optimized=preview,
                )
            )

        lines = self._split_detail_lines(details)
        if len(details) > 260 and len(lines) <= 1:
            issues.append(
                self._create_issue(
                    f"work-structure-{idx}",
                    f"{company} 的经历描述偏长，建议拆分为 2-4 条要点",
                    "low",
                    "按「背景/任务 → 行动 → 结果」拆分 bullet，便于 HR 快速扫读",
                    company=company,
                    position=position,
                    current=excerpt,
                    optimized=preview,
                )
            )

        if lines and not any(any(v in line for v in _ACTION_VERBS) for line in lines):
            issues.append(
                self._create_issue(
                    f"work-weak-verbs-{idx}",
                    f"{company} 的经历建议以动词开头突出个人贡献",
                    "low",
                    "每条要点用「负责/主导/设计/实现/优化」等动词起句，并写清个人产出",
                    company=company,
                    position=position,
                    current=excerpt,
                    optimized=preview,
                )
            )

        if force_suggestions and not issues:
            issues.append(
                self._create_issue(
                    f"work-enhance-{idx}",
                    f"可进一步润色 {company} 的实习经历",
                    "medium",
                    "强化业务背景、个人动作与量化结果，使描述更贴近目标岗位",
                    company=company,
                    position=position,
                    current=excerpt,
                    optimized=preview,
                )
            )

        return issues

    def _build_optimized_preview(self, exp: Dict) -> str:
        company = exp.get("company") or "该段经历"
        position = exp.get("position") or ""
        lines = self._split_detail_lines(self._plain_details(exp))
        header = f"{company} | {position}".strip(" |")

        if not lines:
            return (
                f"{header}\n"
                "- 使用 STAR 法则补充：背景/任务 → 关键行动 → 量化结果（如提升 30% 效率）"
            )

        enhanced: List[str] = []
        for line in lines[:6]:
            bullet = line.rstrip("。；; ")
            bullet = _RULE_BASED_NOISE_RE.sub("", bullet).strip()
            if not bullet:
                continue
            if not any(v in bullet[:12] for v in _ACTION_VERBS):
                bullet = f"负责{bullet}" if not bullet.startswith("负责") else bullet
            enhanced.append(f"- {bullet}")

        return f"{header}\n" + "\n".join(enhanced)

    async def analyze(
        self,
        resume_data: Dict,
        target_index: Optional[int] = None,
        **kwargs: object,
    ) -> Dict:
        experiences: List[Dict] = resume_data.get("experience", []) or []
        total_items = len(experiences)
        if total_items == 0:
            return self._empty_analysis()

        if target_index is not None:
            target_index = min(max(target_index, 0), total_items - 1)
            indices = [target_index]
        else:
            indices = list(range(min(total_items, 3)))

        highlights: List[str] = []
        issues: List[Dict] = []
        for idx in indices:
            exp = experiences[idx]
            company = exp.get("company") or "未知公司"
            position = exp.get("position") or "未知岗位"
            highlights.append(f"{company} - {position}")
            issues.extend(
                self._analyze_single_experience(
                    idx,
                    exp,
                    force_suggestions=target_index is not None,
                )
            )

        score = min(92, 68 + len(indices) * 8 - min(len(issues), 4) * 4)
        priority_score = max(10, 100 - score)
        result = {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": score,
            "priority_score": priority_score,
            "analysis_type": "simple",
            "total_items": total_items,
            "analyzed_items": len(indices),
            "strengths": [],
            "weaknesses": [],
            "issues": issues,
            "highlights": highlights,
            "details": {
                "sampled_items": len(indices),
                "target_index": target_index,
            },
        }
        self._analysis_result = result
        return result

    async def optimize(self, resume_data: Dict, issue_id: Optional[str] = None) -> Dict:
        experiences: List[Dict] = resume_data.get("experience", []) or []
        if not experiences:
            return {
                "issue_id": "work-missing",
                "module": self.module_name,
                "current": "无工作经历",
                "optimized": "补充至少一段完整的工作经历（公司、岗位、时间、职责、成果）。",
                "explanation": "工作经历是简历的核心部分，应体现岗位胜任力。",
                "apply_path": "experience",
            }

        target_index = 0
        if issue_id:
            match = re.search(r"(\d+)\s*$", issue_id)
            if match:
                target_index = int(match.group(1))

        target_index = min(max(target_index, 0), len(experiences) - 1)
        target = experiences[target_index]
        current = self._plain_details(target) or "（空）"
        optimized = self._build_optimized_preview(target)
        company = target.get("company") or "该段经历"

        return {
            "issue_id": issue_id or f"work-enhance-{target_index}",
            "module": self.module_name,
            "current": current[:900],
            "optimized": optimized,
            "explanation": f"针对 {company} 的规则化参考（Manus LLM 不可用时的兜底）。",
            "apply_path": f"experience[{target_index}].details",
        }

    def _empty_analysis(self) -> Dict:
        return {
            "module": self.module_name,
            "module_display_name": self.module_display_name,
            "score": 0,
            "priority_score": 100,
            "analysis_type": "simple",
            "total_items": 0,
            "analyzed_items": 0,
            "strengths": [],
            "weaknesses": [],
            "issues": [
                {
                    "id": "work-missing",
                    "problem": "工作经历为空",
                    "severity": "high",
                    "suggestion": "补充至少一段工作经历",
                }
            ],
            "highlights": [],
            "details": {},
        }
