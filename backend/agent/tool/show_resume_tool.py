"""
Show resume tool.

Expose resume display as an explicit tool call so frontend can render
the same resume card/preview flow based on tool_result events.
"""

from typing import Optional

from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.cv_reader_tool import ReadCVContext
from backend.agent.tool.resume_data_store import ResumeDataStore


class ShowResumeTool(BaseTool):
    """Display current resume content as a tool output."""

    name: str = "show_resume"
    description: str = (
        "Display current loaded resume for user preview. "
        "Use when user asks to show/view/open resume content."
    )

    parameters: dict = {
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "description": "The section to display. Use 'all' for full resume.",
                "enum": ["all", "basic", "education", "experience", "projects", "skills", "awards", "opensource"],
                "default": "all",
            },
            "output_mode": {
                "type": "string",
                "description": "Output mode. 'content' returns formatted text, 'structure' returns field paths.",
                "enum": ["content", "structure"],
                "default": "content",
            },
            "file_path": {
                "type": "string",
                "description": "Optional resume markdown file path to load before display.",
            },
        },
        "required": [],
    }

    class Config:
        arbitrary_types_allowed = True

    async def execute(
        self,
        section: str = "all",
        output_mode: str = "content",
        file_path: Optional[str] = None,
    ) -> ToolResult:
        resume_data = ResumeDataStore.get_data(self.session_id)

        if file_path:
            try:
                from backend.agent.utils.resume_parser import parse_markdown_resume

                resume_data = parse_markdown_resume(file_path)
                ResumeDataStore.set_data(resume_data, session_id=self.session_id)
            except Exception as e:
                return ToolResult(error=f"Failed to load resume from file: {str(e)}")

        if not resume_data:
            return ToolResult(output="No resume data loaded. Please load resume data first.")

        try:
            if output_mode == "structure":
                return ToolResult(output=self._format_structure(resume_data))

            read_tool = ReadCVContext()
            read_tool.set_resume_data(resume_data)
            formatted_data = await read_tool.execute(section)
            return ToolResult(output=formatted_data)
        except Exception as e:
            return ToolResult(error=f"Failed to show resume: {str(e)}")

    def _format_structure(self, resume_data: dict, max_depth: int = 3) -> str:
        lines = []

        def walk(data: dict, prefix: str = "", depth: int = 0) -> None:
            if depth >= max_depth:
                return
            for key, value in data.items():
                if key.startswith("_"):
                    continue
                path = f"{prefix}.{key}" if prefix else key
                if isinstance(value, dict):
                    lines.append(f"DIR {path}/")
                    walk(value, path, depth + 1)
                elif isinstance(value, list):
                    if value and isinstance(value[0], dict):
                        lines.append(f"LIST {path}[{len(value)} items]")
                        walk(value[0], f"{path}[0]", depth + 1)
                        if len(value) > 1:
                            lines.append(f"  ... and {len(value) - 1} more items")
                    else:
                        lines.append(f"LIST {path}[{len(value)}]")
                else:
                    value_str = str(value)
                    if len(value_str) > 50:
                        value_str = value_str[:50] + "..."
                    lines.append(f"VAL {path} = {value_str}")

        walk(resume_data)
        return "Resume structure:\n\n" + "\n".join(lines)

