"""
CVAnalyzer Agent Tool - 将 CVAnalyzer Agent 包装成 Manus 可调用的工具

参考 CVReaderAgentTool 的集成方式，这个工具内部使用 CVAnalyzer Agent 来处理简历深度分析任务。
"""

from typing import Optional
from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.resume_data_store import ResumeDataStore


class CVAnalyzerAgentTool(BaseTool):
    """CVAnalyzer Agent 工具

    这是一个特殊的工具，它内部使用 CVAnalyzer Agent 来处理简历深度分析任务。
    Manus 可以委托简历分析任务给这个工具，CVAnalyzer 会以 Agent 的方式处理。

    使用场景：
    - 用户要求分析简历质量（深度分析）
    - 用户要求找出简历需要优化的地方
    - 用户要求使用 STAR 法则分析经历
    """

    name: str = "cv_analyzer_agent"
    description: str = """Delegate CV/Resume deep analysis to the CVAnalyzer Agent.

Use this tool when the user asks to:
- "分析我的简历" (analyze my resume)
- "帮我分析一下简历" (help me analyze my resume)
- "找出简历需要优化的地方" (find areas that need improvement)
- "深度分析简历" (deeply analyze the resume)

The CVAnalyzer Agent will:
1. Check completeness (empty/missing fields)
2. Analyze content quality using STAR methodology
3. Identify skills that need better description
4. Provide structured optimization suggestions

此工具用于深度分析求职者的简历内容质量。"""

    parameters: dict = {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The analysis question or request"
            }
        },
        "required": ["question"]
    }

    class Config:
        arbitrary_types_allowed = True

    async def execute(self, question: str) -> ToolResult:
        """执行简历深度分析

        内部创建 CVAnalyzer Agent 并运行它来处理分析任务
        """
        resume_data = ResumeDataStore.get_data(self.session_id)
        if not resume_data:
            return ToolResult(
                output="No resume data loaded. Please use cv_reader_agent tool first to read resume data."
            )

        try:
            # 确保 resume_data 是字典类型
            if not isinstance(resume_data, dict):
                return ToolResult(
                    error=f"Invalid resume data type: {type(resume_data)}. Expected dict."
                )

            # 延迟导入避免循环依赖
            from backend.agent.agent.cv_analyzer import CVAnalyzer

            # 创建 CVAnalyzer Agent 实例
            cv_analyzer = CVAnalyzer()

            # 加载简历数据（确保传递的是字典）
            cv_analyzer.load_resume(resume_data)

            # 运行 CVAnalyzer Agent 处理问题
            result = await cv_analyzer.chat(question)

            return ToolResult(output=result)

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            return ToolResult(error=f"CVAnalyzer Agent error: {str(e)}\n{error_detail}")
