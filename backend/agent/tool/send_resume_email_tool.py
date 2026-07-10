"""
send_resume_email 工具:把当前会话简历渲染成 PDF,连同给简历主人的优化
建议正文,通过用户配置的 QQ 邮箱 SMTP 发送。仅管理员会话注册(见
Manus._build_tool_collection),工具内部再查库校验一次角色,双重防护。

发送确认走运行时挂起协议(requires_approval,见 backend/agent/approval.py):
LLM 调用本工具时 execute_tool 不执行,而是推可编辑确认卡;用户批准(可修改
收件人/主题/正文)后由 /api/agent/approval 端点带改后参数执行 execute()。
模型无法绕过这道门——execute 只会被批准链路调用。
"""
import re
import smtplib
import time
from typing import Dict, List, Optional

from pydantic import Field

from backend.agent.tool.base import BaseTool, ToolResult
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.core.logger import get_logger

logger = get_logger(__name__)

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

# 频率限制:同一 user_id 每小时最多 5 次发送尝试(成功失败都计数,防失败重试绕过)
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 3600
_send_attempts: Dict[int, List[float]] = {}


def _check_rate_limit(user_id: int) -> bool:
    """记录一次尝试并返回是否放行。"""
    now = time.time()
    attempts = [t for t in _send_attempts.get(user_id, []) if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(attempts) >= RATE_LIMIT_MAX_ATTEMPTS:
        _send_attempts[user_id] = attempts
        return False
    attempts.append(now)
    _send_attempts[user_id] = attempts
    return True


class SendResumeEmailTool(BaseTool):
    name: str = "send_resume_email"
    description: str = (
        "把当前会话中(通常是刚优化过)的简历渲染成 PDF,连同你写的邮件正文一起,"
        "通过用户已连接的 QQ 邮箱发送给简历的主人。"
        "body 必须由你根据本会话真实发生的优化/诊断内容撰写:先友好称呼对方,"
        "说明这次帮他改了哪些地方、为什么这样改,再给出 1-3 条进一步完善的建议;"
        "不要编造没有发生过的修改。缺少收件人邮箱或不知道怎么称呼对方时,先向用户提问,"
        "不要猜测。调用本工具后会弹出可编辑的确认卡,由用户确认后才真正发送,"
        "因此你只需调用一次,之后本轮结束,不要重复调用。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "to_email": {
                "type": "string",
                "description": "收件人(简历主人)的邮箱地址",
            },
            "subject": {
                "type": "string",
                "description": "邮件主题,缺省为「XX的简历(已优化)」",
            },
            "body": {
                "type": "string",
                "description": "邮件正文:本次优化了什么 + 进一步建议,对收件人友好称呼",
            },
        },
        "required": ["to_email", "body"],
    }

    # 运行时确认:挂起等用户在确认卡批准,收件人/主题/正文均可编辑
    requires_approval: bool = True
    approval_editable_fields: list = ["to_email", "subject", "body"]

    user_id: Optional[int] = Field(default=None, exclude=True)

    # ---- 确认前校验:注定失败的调用不产生确认卡 ----

    def validate_before_approval(self, to_email: str = "", subject: Optional[str] = None, body: Optional[str] = None, **_: object) -> Optional[str]:
        if not EMAIL_RE.match((to_email or "").strip()):
            return f"收件邮箱地址「{to_email}」格式不正确,请确认后重试。"
        if not (body or "").strip():
            return "邮件正文不能为空:请先根据本次优化内容写好给对方的说明与建议。"
        if not ResumeDataStore.get_data(self.session_id):
            return "当前会话还没有加载简历,请先展示或导入一份简历再发送。"

        from backend.database import SessionLocal
        from backend.models import EmailCredential, User

        if not self.user_id:
            return "无法确认当前用户身份,发送已取消。"
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == self.user_id).first()
            if not user or getattr(user, "role", None) != "admin":
                return "邮件发送功能仅管理员可用。"
            credential = (
                db.query(EmailCredential)
                .filter(EmailCredential.user_id == self.user_id)
                .first()
            )
            if not credential:
                return "你还没有连接 QQ 邮箱。请点击对话输入框旁的邮箱图标,填入 QQ 邮箱地址和授权码后再试。"
        finally:
            db.close()
        return None

    def approval_preview(self, **kwargs) -> dict:
        resume_data = ResumeDataStore.get_data(self.session_id) or {}
        resume_name = self._resume_name(resume_data)
        return {
            "resume_name": resume_name,
            "attachment_label": f"《{resume_name}的简历》PDF",
        }

    # ---- 真正执行(仅由 approval 端点在用户批准后调用) ----

    async def execute(
        self,
        to_email: str,
        body: str,
        subject: Optional[str] = None,
    ) -> ToolResult:
        to_email = (to_email or "").strip()
        if not EMAIL_RE.match(to_email):
            return ToolResult(error=f"收件邮箱地址「{to_email}」格式不正确。")
        body = (body or "").strip()
        if not body:
            return ToolResult(error="邮件正文不能为空。")

        resume_data = ResumeDataStore.get_data(self.session_id)
        if not resume_data:
            return ToolResult(error="当前会话还没有加载简历,发送已取消。")

        resume_name = self._resume_name(resume_data)
        final_subject = (subject or "").strip() or f"{resume_name}的简历(已优化)"

        from backend.database import SessionLocal
        from backend.models import EmailCredential, User
        from backend.utils.crypto import decrypt_secret

        if not self.user_id:
            return ToolResult(error="无法确认当前用户身份,发送已取消。")

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == self.user_id).first()
            if not user or getattr(user, "role", None) != "admin":
                return ToolResult(error="邮件发送功能仅管理员可用。")

            credential = (
                db.query(EmailCredential)
                .filter(EmailCredential.user_id == self.user_id)
                .first()
            )
            if not credential:
                return ToolResult(
                    error="你还没有连接 QQ 邮箱。请点击对话输入框旁的邮箱图标,填入 QQ 邮箱地址和授权码后再试。"
                )
            from_email = credential.email_address
            auth_code = decrypt_secret(credential.encrypted_auth_code)
        finally:
            db.close()

        if not _check_rate_limit(self.user_id):
            return ToolResult(error="发送太频繁(每小时最多 5 次),请稍后再试。")

        try:
            pdf_bytes = self._render_pdf(resume_data)
        except Exception as exc:
            logger.error(f"[send_resume_email] PDF 渲染失败: {exc}")
            return ToolResult(error=f"简历 PDF 生成失败:{exc}")

        from backend.services.email_sender import send_resume_email

        try:
            send_resume_email(
                from_email=from_email,
                auth_code=auth_code,
                to_email=to_email,
                subject=final_subject,
                body=body,
                pdf_bytes=pdf_bytes,
                filename=f"{resume_name}的简历.pdf",
            )
        except smtplib.SMTPAuthenticationError:
            return ToolResult(error="QQ 邮箱登录失败,授权码可能已失效。请重新连接邮箱后再试。")
        except (smtplib.SMTPException, OSError) as exc:
            logger.error(f"[send_resume_email] SMTP 发送失败: {exc}")
            return ToolResult(error="邮件服务暂时不可用,请稍后再试。")

        logger.info(f"[send_resume_email] 已发送: user_id={self.user_id}, to={to_email}")
        return ToolResult(output=f"✅ 已通过 {from_email} 把《{resume_name}的简历》PDF 发送到 {to_email}。")

    @staticmethod
    def _resume_name(resume_data: dict) -> str:
        basic = resume_data.get("basic") or resume_data.get("basics") or {}
        if isinstance(basic, dict) and basic.get("name"):
            return str(basic["name"]).strip()
        return "我"

    @staticmethod
    def _render_pdf(resume_data: dict) -> bytes:
        """复用 PDF 主链路的 LaTeX 生成与编译。"""
        from backend.routes.pdf import (
            _compile_pdf_bytes,
            _prepare_latex_content,
            _resolve_template_dir,
        )

        latex_content = _prepare_latex_content(resume_data, None)
        return _compile_pdf_bytes(latex_content, _resolve_template_dir(), resume_data)
