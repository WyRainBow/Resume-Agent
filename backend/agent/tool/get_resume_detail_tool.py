"""Get resume detail tool——加载某份简历完整内容到会话,右侧展开预览。

UP简历入口流对标(2026-07-13):list_resumes 拿到 ID 后,agent 自主调本工具
把简历完整内容读进会话上下文并让前端展开预览——这是"agent 主动读简历"
链路的第二步,替代弹面板选完再 replay 的老路。
"""

from typing import Optional

from pydantic import Field

from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.resume_data_store import ResumeDataStore


class GetResumeDetailTool(BaseTool):
    """按 ID 加载简历完整内容到会话 + 触发前端展开预览。"""

    name: str = "get_resume_detail"
    description: str = (
        "获取某一份简历的完整内容,加载到当前会话(右侧会展开预览)。"
        "先用 list_resumes 拿到简历 ID,再用它加载。加载后简历内容进入上下文,"
        "可以基于它做后续优化。调用前先用一句话告诉用户你在做什么"
        "(例:『有一份「张三_后端_应届」,我获取完整内容看看』)。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "resume_id": {
                "type": "string",
                "description": "要加载的简历 ID(来自 list_resumes 的返回)",
            }
        },
        "required": ["resume_id"],
    }
    user_id: Optional[str] = Field(default=None, exclude=True)

    class Config:
        arbitrary_types_allowed = True

    async def execute(self, resume_id: str) -> ToolResult:
        if not self.user_id:
            return ToolResult(error="无法确定当前用户身份。")
        if not resume_id or not str(resume_id).strip():
            return ToolResult(error="缺少 resume_id,请先用 list_resumes 拿到简历 ID。")

        from backend.database import SessionLocal
        from backend.models import Resume

        db = SessionLocal()
        try:
            resume = (
                db.query(Resume)
                .filter(Resume.id == resume_id, Resume.user_id == self.user_id)
                .first()
            )
            if not resume:
                return ToolResult(
                    error=f"未找到 ID 为 {resume_id} 的简历,或它不属于当前用户。"
                    "请先用 list_resumes 确认可用的简历 ID。"
                )
            data = resume.data
            name = resume.name
        finally:
            db.close()

        # 写入会话简历共享状态(后续 think 会经 _sync_resume_loaded_state 同步
        # resume_loaded=True)。meta 用 DB 实锤的 id/user_id 补入,与前端
        # applyResumeToChat 的 resumeDataWithMeta 形状对齐,后续持久化不依赖
        # JSON 里不可信的自带字段(Codex review P2)。
        session_data = dict(data) if isinstance(data, dict) else {"raw": data}
        session_data["resume_id"] = resume_id
        session_data["user_id"] = self.user_id
        session_data["_meta"] = {
            "resume_id": resume_id,
            "user_id": self.user_id,
            "name": name,
        }
        ResumeDataStore.set_data(session_data, session_id=self.session_id)
        # structured 只传 {id,name}:完整简历(含联系方式等 PII)不进 SSE/前端
        # localStorage 持久化;前端凭 id 走已鉴权接口取详情展开(Codex review P2)
        return ToolResult(
            output=f"已加载简历「{name}」,完整内容已进入当前会话。",
            structured_data={
                "type": "resume_loaded",
                "resume": {"id": resume_id, "name": name},
            },
        )
