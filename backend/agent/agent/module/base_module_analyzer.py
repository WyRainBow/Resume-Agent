"""
模块分析器基类

所有模块分析器继承此基类，提供统一的接口和评分机制。
"""

import json
from abc import abstractmethod
from typing import Any, Dict, List, Optional

from pydantic import Field

from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.llm import LLM
from backend.agent.schema import AgentState, Message
from backend.agent.tool import ToolCollection, Terminate


class BaseModuleAnalyzer(ToolCallAgent):
    """模块分析器基类

    所有模块分析器应继承此类并实现：
    - module_name: 模块标识符
    - module_display_name: 模块显示名称
    - analyze(): 分析方法
    - optimize(): 优化方法

    设计理念：
    - 职责单一：每个分析器只负责一个模块
    - 自我评分：分析器自己计算 score 和 priority_score
    - 两阶段调用：analyze() 返回 JSON，optimize() 返回示例
    """

    # 子类必须定义
    module_name: str = Field(
        description="模块标识符，如 'education', 'work', 'internship'"
    )
    module_display_name: str = Field(
        description="模块显示名称，如 '教育经历', '工作经历'"
    )

    # LLM 配置
    llm: LLM = Field(default_factory=lambda: LLM(config_name="module_analyzer"))
    max_steps: int = 5  # 模块分析器通常不需要太多步骤

    # 可用工具（子类可以扩展）
    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(Terminate())
    )

    # 当前分析结果缓存
    _analysis_result: Optional[Dict] = None

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    @abstractmethod
    async def analyze(self, resume_data: Dict) -> Dict:
        """分析模块，返回结构化结果

        这是模块分析器的核心方法，负责分析简历中对应模块的内容。

        Args:
            resume_data: 简历数据字典

        Returns:
            {
                "module": "模块名",
                "module_display_name": "模块显示名",
                "score": 0-100,  # 模块质量评分
                "priority_score": 0-100,  # 优化优先级分数
                "analysis_type": "simple" | "deep",
                "total_items": int,  # 总项目数
                "analyzed_items": int,  # 分析的项目数
                "strengths": [
                    {
                        "item": "亮点项目",
                        "description": "详细描述",
                        "evidence": "证据"
                    }
                ],
                "weaknesses": [
                    {
                        "item": "弱点项目",
                        "description": "描述",
                        "impact": "影响",
                        "suggestion": "建议"
                    }
                ],
                "issues": [
                    {
                        "id": "issue-1",
                        "problem": "问题描述",
                        "severity": "high" | "medium" | "low",
                        "suggestion": "优化建议"
                    }
                ],
                "highlights": ["亮点1", "亮点2"],
                "details": {...}  # 模块特定的详细分析结果
            }
        """
        pass

    @abstractmethod
    async def optimize(self, resume_data: Dict, issue_id: Optional[str] = None) -> Dict:
        """生成优化建议和示例

        Args:
            resume_data: 简历数据字典
            issue_id: 要优化的问题 ID（可选，未指定则返回第一个问题的优化）

        Returns:
            {
                "issue_id": "issue-1",
                "module": "模块名",
                "current": "当前内容",
                "optimized": "优化后的内容",
                "explanation": "优化说明",
                "apply_path": "education[0].courses",  # 可选：应用路径
                "before_after": {
                    "before": "优化前",
                    "after": "优化后"
                }
            }
        """
        pass

    def _calculate_priority_score(
        self, score: int, issues: List[Dict], base_priority: int = 0
    ) -> int:
        """计算优先级分数

        优先级分数用于决定哪些模块最需要优化。
        计算公式：
        - 基础分 = (100 - score)  # 分数越低，优先级越高
        - 严重问题加成：high +30, medium +15, low +5
        - 基础优先级加成（模块间相对重要性）

        Args:
            score: 模块质量评分 (0-100)
            issues: 问题列表
            base_priority: 基础优先级加成（如教育经历对于应届生可能+20）

        Returns:
            优先级分数 (0-100)，分数越高越优先
        """
        priority = (100 - score) + base_priority

        # 根据问题严重程度加成
        for issue in issues:
            severity = issue.get("severity", "low")
            if severity == "high":
                priority += 30
            elif severity == "medium":
                priority += 15
            elif severity == "low":
                priority += 5

        # 限制在 0-100 范围内
        return max(0, min(priority, 100))

    def _create_issue(
        self,
        issue_id: str,
        problem: str,
        severity: str,
        suggestion: str,
        **extra_fields
    ) -> Dict:
        """创建标准格式的问题对象

        Args:
            issue_id: 问题唯一标识
            problem: 问题描述
            severity: 严重程度 (high/medium/low)
            suggestion: 优化建议
            **extra_fields: 额外字段（如 company, position 等）

        Returns:
            标准格式的问题字典
        """
        issue = {
            "id": issue_id,
            "problem": problem,
            "severity": severity,
            "suggestion": suggestion,
        }
        issue.update(extra_fields)
        return issue

    def _create_strength(
        self, item: str, description: str, evidence: str = ""
    ) -> Dict:
        """创建标准格式的亮点对象"""
        strength = {"item": item, "description": description}
        if evidence:
            strength["evidence"] = evidence
        return strength

    def _create_weakness(
        self, item: str, description: str, suggestion: str, impact: str = ""
    ) -> Dict:
        """创建标准格式的弱点对象"""
        weakness = {
            "item": item,
            "description": description,
            "suggestion": suggestion,
        }
        if impact:
            weakness["impact"] = impact
        return weakness

    async def chat(self, message: str, resume_data: Optional[Dict] = None) -> str:
        """与模块分析器对话

        Args:
            message: 用户消息
            resume_data: 简历数据

        Returns:
            AI 回复
        """
        if resume_data:
            self._resume_data = resume_data

        # 添加用户消息
        self.update_memory("user", message)

        # 运行 Agent
        result = await self.run()

        return result

    def format_analysis_as_markdown(self, analysis: Dict) -> str:
        """将分析结果格式化为 Markdown 报告

        子类可以重写此方法以提供自定义格式。
        """
        lines = []

        # 标题
        module_name = analysis.get("module_display_name", "模块")
        lines.append(f"## 📊 {module_name}分析")
        lines.append("")

        # 整体评分
        score = analysis.get("score", 0)
        score_emoji = "✅" if score >= 80 else "⚠️" if score >= 60 else "❌"
        lines.append(f"**综合评分**: {score}/100 {score_emoji}")
        lines.append("")

        # 亮点
        strengths = analysis.get("strengths", [])
        if strengths:
            lines.append("**优势**:")
            for s in strengths:
                lines.append(f"- {s.get('item')}: {s.get('description')}")
            lines.append("")

        # 问题
        issues = analysis.get("issues", [])
        if issues:
            high_issues = [i for i in issues if i.get("severity") == "high"]
            medium_issues = [i for i in issues if i.get("severity") == "medium"]
            low_issues = [i for i in issues if i.get("severity") == "low"]

            if high_issues:
                lines.append("**🔴 高优先级问题**:")
                for i in high_issues:
                    lines.append(f"- {i.get('problem')}")
                    lines.append(f"  建议: {i.get('suggestion')}")
                lines.append("")

            if medium_issues:
                lines.append("**🟡 中优先级问题**:")
                for i in medium_issues:
                    lines.append(f"- {i.get('problem')}")
                    lines.append(f"  建议: {i.get('suggestion')}")
                lines.append("")

            if low_issues:
                lines.append("**🟢 低优先级问题**:")
                for i in low_issues:
                    lines.append(f"- {i.get('problem')}")
                lines.append("")

        # 优化建议
        weaknesses = analysis.get("weaknesses", [])
        if weaknesses:
            lines.append("**💡 优化建议**:")
            for w in weaknesses:
                lines.append(f"- {w.get('item')}: {w.get('suggestion')}")
            lines.append("")

        return "\n".join(lines)

    def _llm_analyze(self, prompt: str, response_format: str = "json") -> Any:
        """使用 LLM 进行分析

        Args:
            prompt: 分析提示词
            response_format: 响应格式 ("json" 或 "text")

        Returns:
            LLM 分析结果
        """
        from backend.agent.llm import LLM

        llm = LLM(config_name=self.module_name)

        messages = [Message.system_message(prompt)]

        if response_format == "json":
            response = llm.ask_json(messages)
        else:
            response = llm.ask(messages)

        return response
