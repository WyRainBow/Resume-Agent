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
