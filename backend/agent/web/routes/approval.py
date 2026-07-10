"""运行时确认端点:用户在确认卡中批准/取消 requires_approval 工具的挂起调用。

批准时允许携带编辑后的参数(仅限工具声明的 approval_editable_fields),
合并后同步执行工具并返回结果——不复活 SSE 流,前端直接用响应更新卡片。
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.agent import approval as approval_store
from backend.core.logger import get_logger
from backend.middleware.auth import get_current_user
from backend.models import User

logger = get_logger(__name__)

router = APIRouter()


class ApprovalActionRequest(BaseModel):
    approval_id: str
    action: str  # approve | cancel
    params: Optional[Dict[str, Any]] = None


class PolishRequest(BaseModel):
    text: str
    instruction: str


POLISH_SYSTEM_PROMPT = (
    "你是邮件正文润色助手。用户会给你一段邮件正文和一条修改指令。"
    "严格遵守:①按指令改写;②保留正文中的事实内容(改了哪些简历内容、具体建议),"
    "不得编造新事实;③保留称呼与署名结构;④只输出改写后的正文本身,"
    "不要任何解释、前后缀或 markdown 代码块。"
)


def _build_tool(tool_name: str, pending: Dict[str, Any]):
    """按挂起记录重建工具实例并注入上下文。目前唯一的 requires_approval 工具
    是 send_resume_email;新增工具时在此登记(工具本身零白名单,只有执行侧需要映射)。"""
    if tool_name == "send_resume_email":
        from backend.agent.tool.send_resume_email_tool import SendResumeEmailTool

        tool = SendResumeEmailTool()
        tool.session_id = pending["session_id"]
        tool.user_id = pending["user_id"]
        return tool
    return None


@router.post("/approval")
async def handle_approval(
    payload: ApprovalActionRequest,
    current_user: User = Depends(get_current_user),
):
    pending = approval_store.get_valid(payload.approval_id)
    if not pending:
        raise HTTPException(status_code=404, detail="确认请求不存在或已过期,请重新发起。")
    if pending["user_id"] is not None and pending["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作该确认请求。")

    if payload.action == "cancel":
        approval_store.pop(payload.approval_id)
        return {"ok": True, "message": "已取消发送。"}

    if payload.action != "approve":
        raise HTTPException(status_code=400, detail="未知操作。")

    tool = _build_tool(pending["tool_name"], pending)
    if tool is None:
        approval_store.pop(payload.approval_id)
        raise HTTPException(status_code=400, detail=f"未知的待确认工具:{pending['tool_name']}")

    # 合并用户编辑:只接受工具声明为可编辑的字段,其余以挂起时的原参数为准
    args = dict(pending["args"])
    editable = set(getattr(tool, "approval_editable_fields", []))
    for key, value in (payload.params or {}).items():
        if key in editable:
            args[key] = value

    approval_store.pop(payload.approval_id)  # 单次有效:执行前即失效,防重放
    try:
        result = await tool.execute(**args)
    except Exception as exc:
        logger.exception(f"[approval] 执行 {pending['tool_name']} 失败")
        return {"ok": False, "message": f"执行失败:{exc}"}

    error = getattr(result, "error", None)
    if error:
        return {"ok": False, "message": str(error)}
    return {"ok": True, "message": str(getattr(result, "output", None) or "已完成。")}


@router.post("/approval/polish")
async def polish_text(
    payload: PolishRequest,
    current_user: User = Depends(get_current_user),
):
    """确认卡内的 AI 润色:按指令改写邮件正文,一次轻量 LLM 调用,同步返回。"""
    text = (payload.text or "").strip()
    instruction = (payload.instruction or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="正文为空,没有可润色的内容。")
    if not instruction:
        raise HTTPException(status_code=400, detail="请告诉我想怎么改(如:更正式、更简洁)。")
    if len(text) > 8000 or len(instruction) > 500:
        raise HTTPException(status_code=400, detail="内容过长,无法润色。")

    from backend.agent.llm import LLM

    try:
        llm = LLM()
        polished = await llm.ask(
            messages=[{
                "role": "user",
                "content": f"修改指令:{instruction}\n\n邮件正文:\n{text}",
            }],
            system_msgs=[{"role": "system", "content": POLISH_SYSTEM_PROMPT}],
            stream=False,
        )
    except Exception as exc:
        logger.exception("[approval] 润色失败")
        return {"ok": False, "message": f"润色失败:{exc}"}

    polished = (polished or "").strip()
    if not polished:
        return {"ok": False, "message": "润色结果为空,请换个说法再试。"}
    return {"ok": True, "text": polished}
