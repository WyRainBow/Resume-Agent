"""
send_resume_email 工具:把当前会话简历生成 PDF,通过用户自己配置的
QQ 邮箱 SMTP 发送到指定收件人。仅管理员会话注册(见 Manus._build_tool_collection),
工具内部再查库校验一次角色,双重防护。

发送采用两段式确认:第一次调用(confirm=false)只返回确认文案,
必须等用户在下一轮对话明确同意后,才允许带 confirm=true 真正发送。
"""
import json
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
        "把当前会话中的简历生成 PDF,通过用户已连接的 QQ 邮箱发送到指定收件邮箱。"
        "重要:必须先以 confirm=false(或省略 confirm)调用一次,把返回的确认文案展示给用户;"
        "只有用户在之后的对话中明确回复同意发送(如「确认」「发吧」),才允许再次调用并传 confirm=true。"
        "严禁在用户未明确确认时直接传 confirm=true。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "to_email": {
                "type": "string",
                "description": "收件人邮箱地址",
            },
            "subject": {
                "type": "string",
                "description": "邮件主题,缺省为「XX的简历」",
            },
            "message": {
                "type": "string",
                "description": "邮件正文留言,缺省为一句简短的投递问候",
            },
            "confirm": {
                "type": "boolean",
                "description": "是否已获得用户明确确认。首次调用必须为 false;仅当用户明确回复同意后才能为 true",
            },
        },
        "required": ["to_email"],
    }

    user_id: Optional[int] = Field(default=None, exclude=True)

    async def execute(
        self,
        to_email: str,
        subject: Optional[str] = None,
        message: Optional[str] = None,
        confirm: bool = False,
    ) -> ToolResult:
        to_email = (to_email or "").strip()
        if not EMAIL_RE.match(to_email):
            return ToolResult(error=f"收件邮箱地址「{to_email}」格式不正确,请确认后重试。")

        resume_data = ResumeDataStore.get_data(self.session_id)
        if not resume_data:
            return ToolResult(error="当前会话还没有加载简历,请先展示或导入一份简历再发送。")

        resume_name = self._resume_name(resume_data)
        final_subject = (subject or "").strip() or f"{resume_name}的简历"
        final_message = (message or "").strip() or "您好,附件是我的简历,烦请查收,期待您的回复。"

        if not confirm:
            structured = {
                "type": "send_resume_email_confirm",
                "to_email": to_email,
                "subject": final_subject,
                "message": final_message,
                "resume_name": resume_name,
            }
            return ToolResult(
                output=(
                    f"📧 即将发送简历,请确认:\n"
                    f"- 收件人:{to_email}\n"
                    f"- 主题:{final_subject}\n"
                    f"- 附件:《{resume_name}的简历》PDF\n"
                    f"- 留言:{final_message}\n\n"
                    f"确认发送吗?回复「确认」我就立即发出。"
                ),
                system=json.dumps(structured, ensure_ascii=False),
            )

        return await self._do_send(to_email, final_subject, final_message, resume_data, resume_name)

    @staticmethod
    def _resume_name(resume_data: dict) -> str:
        basic = resume_data.get("basic") or resume_data.get("basics") or {}
        if isinstance(basic, dict) and basic.get("name"):
            return str(basic["name"]).strip()
        return "我"

    async def _do_send(
        self,
        to_email: str,
        subject: str,
        message: str,
        resume_data: dict,
        resume_name: str,
    ) -> ToolResult:
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
                subject=subject,
                body=message,
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
    def _render_pdf(resume_data: dict) -> bytes:
        """复用 PDF 主链路的 LaTeX 生成与编译。"""
        from backend.routes.pdf import (
            _compile_pdf_bytes,
            _prepare_latex_content,
            _resolve_template_dir,
        )

        latex_content = _prepare_latex_content(resume_data, None)
        return _compile_pdf_bytes(latex_content, _resolve_template_dir(), resume_data)
