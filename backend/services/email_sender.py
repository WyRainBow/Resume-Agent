"""
QQ 邮箱 SMTP 发信服务

仅支持 QQ 邮箱(smtp.qq.com:465 SSL + 授权码登录),用于 Agent
send_resume_email 工具发送简历 PDF 附件。异常原样抛出,由调用方
翻译成面向用户的文案,不在这里吞错降级。
"""
import smtplib
from email.header import Header
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = "smtp.qq.com"
SMTP_PORT = 465
SMTP_TIMEOUT_SECONDS = 30


def send_resume_email(
    from_email: str,
    auth_code: str,
    to_email: str,
    subject: str,
    body: str,
    pdf_bytes: bytes,
    filename: str,
) -> None:
    """通过发件人自己的 QQ 邮箱发送带 PDF 附件的邮件。

    Raises:
        smtplib.SMTPAuthenticationError: 授权码错误/失效
        smtplib.SMTPException / OSError: 连接失败、发送失败等
    """
    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = Header(subject, "utf-8")
    msg.attach(MIMEText(body, "plain", "utf-8"))

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=("utf-8", "", filename))
    msg.attach(attachment)

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
        server.login(from_email, auth_code)
        server.sendmail(from_email, [to_email], msg.as_string())
