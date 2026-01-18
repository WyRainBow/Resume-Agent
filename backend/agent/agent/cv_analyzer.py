"""
CVAnalyzer Agent - 简历分析协调者

**职责**：协调各模块分析器，聚合分析结果，引导用户优化
**不做具体分析** - 所有分析逻辑由模块分析器负责
"""

from typing import Dict, List, Optional
from pydantic import Field

from backend.agent.agent.toolcall import ToolCallAgent
from backend.agent.prompt.cv_analyzer import (
    NEXT_STEP_PROMPT,
    SYSTEM_PROMPT,
)
from backend.agent.tool import ToolCollection, Terminate
from backend.agent.tool.cv_reader_tool import ReadCVContext
from backend.agent.tool.education_analyzer_tool import EducationAnalyzerTool
from backend.agent.tool.resume_data_store import ResumeDataStore


# 将 PromptTemplate 对象转换为字符串（因为 ToolCallAgent 需要字符串）
SYSTEM_PROMPT_STR = SYSTEM_PROMPT.format()
NEXT_STEP_PROMPT_STR = NEXT_STEP_PROMPT.format()


class CVAnalyzer(ToolCallAgent):
    """简历分析协调者

    **核心职责**：
    - 调用模块分析工具获取各模块的专业分析结果
    - 按 priority_score 排序，决定优化顺序
    - 聚合结果，输出结构化报告
    - 为用户提供明确的下一步指引

    **不做具体分析** - 所有分析逻辑由模块分析器负责
    """

    name: str = "CVAnalyzer"
    description: str = "Coordinator for resume module analysis - calls module analyzers and aggregates results"

    system_prompt: str = SYSTEM_PROMPT_STR
    next_step_prompt: str = NEXT_STEP_PROMPT_STR

    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            ReadCVContext(),
            EducationAnalyzerTool(),
            Terminate(),
        )
    )

    special_tool_names: list[str] = Field(default_factory=lambda: [Terminate().name])

    max_steps: int = 10

    # 当前加载的简历数据（私有属性，不作为 Field）
    _resume_data: Optional[Dict] = None
    _cv_tool: Optional[ReadCVContext] = None

    # 已注册的模块分析器（类变量，不作为 Field）
    module_analyzers: List[str] = ["education_analyzer"]

    class Config:
        arbitrary_types_allowed = True

    def load_resume(self, resume_data: Dict) -> str:
        """加载简历数据到 Agent

        Args:
            resume_data: 简历数据字典，格式参考 ResumeData

        Returns:
            简历摘要文本
        """
        self._resume_data = resume_data

        # 设置共享的简历数据存储（供模块分析工具使用）
        ResumeDataStore.set_data(resume_data)

        # 获取 ReadCVContext 工具并设置简历数据
        for tool in self.available_tools.tools:
            if isinstance(tool, ReadCVContext):
                tool.set_resume_data(resume_data)
                self._cv_tool = tool
                break

        # 将简历基本信息添加到上下文
        basic = resume_data.get("basic", {})
        context = f"""Current Resume Loaded:

Name: {basic.get('name', 'N/A')}
Target Position: {basic.get('title', 'N/A')}

可用模块分析器:
- education_analyzer: 分析教育背景

工作流程:
1. 用户说"分析简历" → 调用各模块 analyze() → 聚合结果 → 按 priority_score 排序 → 推荐下一步
2. 用户说"优化XX" → 调用对应模块 optimize() → 返回优化建议和示例
"""
        from backend.agent.schema import Message
        self.memory.add_message(Message.system_message(context))
        return context

    async def chat(self, message: str, resume_data: Optional[Dict] = None) -> str:
        """与简历对话

        Args:
            message: 用户消息
            resume_data: 简历数据（如果未加载过）

        Returns:
            AI 回复
        """
        if resume_data:
            self.load_resume(resume_data)
        elif not self._resume_data:
            return "No resume data loaded. Please load a resume first."

        # 添加用户消息
        self.update_memory("user", message)

        # 运行 Agent
        result = await self.run()

        return result

    def aggregate_module_results(self, results: List[Dict]) -> Dict:
        """聚合各模块分析结果

        Args:
            results: 各模块返回的分析结果列表

        Returns:
            聚合后的报告
        """
        if not results:
            return {
                "overall_score": 0,
                "modules": [],
                "top_priority": None
            }

        # 按 priority_score 降序排序
        sorted_results = sorted(results, key=lambda x: x.get("priority_score", 0), reverse=True)

        # 计算整体评分（各模块平均）
        total_score = sum(r.get("score", 0) for r in results)
        overall_score = total_score // len(results) if results else 0

        # 收集所有亮点
        all_highlights = []
        for r in results:
            highlights = r.get("highlights", [])
            if isinstance(highlights, list):
                all_highlights.extend(highlights)

        # 收集所有问题
        all_issues = []
        for r in results:
            issues = r.get("issues", [])
            if isinstance(issues, list):
                all_issues.extend(issues)

        return {
            "overall_score": overall_score,
            "modules": sorted_results,
            "top_priority": sorted_results[0] if sorted_results else None,
            "all_highlights": all_highlights,
            "all_issues": all_issues
        }

    def get_next_recommendation(self, aggregated: Dict) -> Optional[str]:
        """根据聚合结果获取下一步优化建议

        Args:
            aggregated: 聚合后的分析结果

        Returns:
            下一步优化建议文本
        """
        top = aggregated.get("top_priority")
        if not top:
            return None

        module_name = top.get("module_display_name", top.get("module", ""))
        priority_score = top.get("priority_score", 0)
        score = top.get("score", 0)

        # 根据 priority_score 和 score 生成建议
        if priority_score >= 70:
            return f"优化{module_name}（优先级: {priority_score}/100）"
        elif score >= 80:
            return f"查看{module_name}详情（已良好）"
        else:
            return f"优化{module_name}"
