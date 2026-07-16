"""List resumes tool——让 agent 主动查用户简历库,替代弹面板手动选。

UP简历入口流对标(2026-07-13):用户说"我要优化简历"→ agent 自主调本工具
看用户有哪些简历,而不是弹面板让用户手动点(传统交互)。返回列表后由
LLM 决策:恰好一份直接 get_resume_detail 加载;多份走 show_resume 面板选。
"""

from typing import Optional

from pydantic import Field

from backend.agent.tool.base import BaseTool, ToolResult


class ListResumesTool(BaseTool):
    """查看当前用户简历库(标题 + ID),供 agent 自主决策加载哪一份。"""

    name: str = "list_resumes"
    description: str = (
        "查看当前用户简历库里有哪些简历(返回每份的标题和 ID)。"
        "当用户要优化/查看/编辑简历、但当前会话还没有加载简历时,"
        "先调用它看看用户有哪些简历,再决定加载哪一份——不要弹面板让用户手动选。"
        "调用前先用一句话告诉用户你在做什么(例:『我先看看你现有的简历』)。"
    )
    parameters: dict = {"type": "object", "properties": {}, "required": []}
    # 由 Manus._inject_tool_context 注入(hasattr 检测,必须显式声明)
    user_id: Optional[int] = Field(default=None, exclude=True)

    class Config:
        arbitrary_types_allowed = True

    async def execute(self) -> ToolResult:
        if not self.user_id:
            return ToolResult(error="无法确定当前用户身份,无法查询简历库。")

        from backend.database import SessionLocal
        from backend.models import Resume

        db = SessionLocal()
        try:
            resumes = (
                db.query(Resume)
                .filter(Resume.user_id == self.user_id)
                .order_by(Resume.updated_at.desc())
                .all()
            )
            items = [
                {
                    "id": r.id,
                    "name": r.name,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in resumes
            ]
        finally:
            db.close()

        if not items:
            return ToolResult(
                output="用户简历库为空,还没有任何简历。",
                structured_data={"type": "resume_list", "resumes": []},
            )

        lines = "\n".join(f"- 「{it['name']}」(ID: {it['id']})" for it in items)
        return ToolResult(
            output=f"用户简历库中有 {len(items)} 份简历:\n{lines}",
            structured_data={"type": "resume_list", "resumes": items},
        )
