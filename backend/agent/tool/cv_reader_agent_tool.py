"""
CVReader Agent Tool - 读取简历数据的工具

简化版本：只负责读取和返回简历数据，不生成回复。
所有回复由 Manus 根据返回的数据生成。
"""

from typing import Optional
from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.cv_reader_tool import ReadCVContext
from backend.agent.tool.resume_data_store import ResumeDataStore


class CVReaderAgentTool(BaseTool):
    """CVReader 工具 - 读取简历数据

    功能：读取当前加载的简历数据，并以结构化格式返回给 Manus。
    Manus 会根据返回的数据生成回复，而不是由这个工具生成回复。

    使用场景：
    - 用户要求查看/了解当前简历内容
    - 用户要求介绍简历情况
    - 用户要求查看某个模块的内容
    """

    name: str = "cv_reader_agent"
    description: str = """Read and return the current resume data as raw text.

Use this tool when:
- User asks to view/understand their resume
- You need resume data for further analysis

Returns: Raw resume data (no analysis). After getting data, use cv_analyzer_agent for analysis.

Parameters:
- section: "all" (default), "basic", "experience", "education", etc.
- output_mode: "content" (default) or "structure"
- file_path: (optional) Path to resume markdown file to load
"""

    parameters: dict = {
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "description": "The specific section to read. Use 'all' to read the full resume.",
                "enum": ["all", "basic", "education", "experience", "projects", "skills", "awards", "opensource"],
                "default": "all"
            },
            "output_mode": {
                "type": "string",
                "description": "Output mode: 'content' returns formatted resume, 'structure' returns field paths.",
                "enum": ["content", "structure"],
                "default": "content"
            },
            "file_path": {
                "type": "string",
                "description": "Optional path to a resume markdown file to load and parse."
            }
        },
        "required": []
    }

    class Config:
        arbitrary_types_allowed = True

    async def execute(
        self,
        section: str = "all",
        output_mode: str = "content",
        file_path: Optional[str] = None,
    ) -> ToolResult:
        """读取简历数据并返回

        直接使用 ReadCVContext 工具格式化简历数据，不生成回复。
        """
        resume_data = ResumeDataStore.get_data(self.session_id)

        # 如果提供了文件路径，从文件加载简历数据
        if file_path:
            try:
                from backend.agent.utils.resume_parser import parse_markdown_resume
                resume_data = parse_markdown_resume(file_path)
                # 同时更新共享数据存储
                ResumeDataStore.set_data(resume_data, session_id=self.session_id)
            except Exception as e:
                return ToolResult(error=f"Failed to load resume from file: {str(e)}")

        if not resume_data:
            return ToolResult(
                output="No resume data loaded. Please load resume data first."
            )

        try:
            if output_mode == "structure":
                output = self._format_structure(resume_data)
                # 🔧 修复：同时返回结构化数据
                import json
                structured_data = {
                    "type": "resume_structure",
                    "section": section,
                    "data": resume_data
                }
                return ToolResult(
                    output=output,
                    system=json.dumps(structured_data, ensure_ascii=False)
                )

            # 使用 ReadCVContext 工具格式化简历数据
            read_tool = ReadCVContext()
            read_tool.set_resume_data(resume_data)

            # 读取并格式化简历数据
            formatted_data = await read_tool.execute(section)

            # 🔧 修复：同时返回结构化数据供前端使用
            import json
            structured_data = {
                "type": "resume_data",
                "section": section,
                "data": resume_data
            }

            return ToolResult(
                output=formatted_data,
                system=json.dumps(structured_data, ensure_ascii=False)
            )

        except Exception as e:
            return ToolResult(error=f"Failed to read resume data: {str(e)}")

    def _format_structure(
        self,
        resume_data: dict,
        max_depth: int = 3,
    ) -> str:
        """格式化简历结构（字段路径），用于编辑定位。"""
        lines = []

        def format_structure(data: dict, prefix: str = "", current_depth: int = 0) -> None:
            if current_depth >= max_depth:
                return

            for key, value in data.items():
                if key.startswith("_"):
                    continue
                path = f"{prefix}.{key}" if prefix else key
                if isinstance(value, dict):
                    lines.append(f"📁 {path}/")
                    format_structure(value, path, current_depth + 1)
                elif isinstance(value, list):
                    if value and isinstance(value[0], dict):
                        lines.append(f"📋 {path}[{len(value)} items]")
                        format_structure(value[0], f"{path}[0]", current_depth + 1)
                        if len(value) > 1:
                            lines.append(f"  ... and {len(value) - 1} more items")
                    else:
                        lines.append(f"📋 {path}[{len(value)}]")
                else:
                    value_str = str(value)[:50]
                    if len(str(value)) > 50:
                        value_str = value_str + "..."
                    lines.append(f"📄 {path} = {value_str}")

        format_structure(resume_data)
        return "📋 Resume Structure:\n\n" + "\n".join(lines)

