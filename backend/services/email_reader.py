"""
QQ 邮箱 IMAP 读取服务(只读):拉取「已发送」文件夹最近若干封邮件,
供用户从历史邮件中挑选正文导入为模板。凭证复用 SMTP 的授权码。

注意:QQ 邮箱 IMAP 要求客户端先发送 ID 扩展命令,否则 select 时报
"Unsafe Login"——imaplib 原生不封装 ID,这里用 _simple_command 手发。
"""
import email
import html as html_lib
import imaplib
import re
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List

IMAP_HOST = "imap.qq.com"
IMAP_PORT = 993
IMAP_TIMEOUT_SECONDS = 20
SENT_FOLDER = '"Sent Messages"'
MAX_BODY_CHARS = 5000


def _decode(value: str) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _strip_html(raw: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>|</p>|</div>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_lib.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _extract_body(msg: email.message.Message) -> str:
    plain, html_part = None, None
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        ctype = part.get_content_type()
        if part.get("Content-Disposition", "").startswith("attachment"):
            continue
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            text = payload.decode(charset, errors="replace")
        except Exception:
            continue
        if ctype == "text/plain" and plain is None:
            plain = text
        elif ctype == "text/html" and html_part is None:
            html_part = text
    body = plain if plain is not None else _strip_html(html_part or "")
    return body.strip()[:MAX_BODY_CHARS]


def fetch_sent_emails(from_email: str, auth_code: str, limit: int = 30) -> List[Dict[str, Any]]:
    """拉取已发送文件夹最近 limit 封,按时间倒序返回。

    Raises:
        imaplib.IMAP4.error: 登录失败(授权码失效)等
        OSError: 连接失败/超时
    """
    imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, timeout=IMAP_TIMEOUT_SECONDS)
    try:
        imap.login(from_email, auth_code)
        # QQ 邮箱要求 ID 命令,否则报 Unsafe Login
        typ, dat = imap._simple_command(
            "ID", '("name" "ResumeAgent" "version" "1.0" "vendor" "resumeagent")'
        )
        imap._untagged_response(typ, dat, "ID")

        typ, _ = imap.select(SENT_FOLDER, readonly=True)
        if typ != "OK":
            raise imaplib.IMAP4.error(f"无法打开已发送文件夹: {typ}")

        typ, data = imap.uid("search", None, "ALL")
        if typ != "OK":
            raise imaplib.IMAP4.error("检索已发送邮件失败")
        uids = data[0].split()
        if not uids:
            return []
        recent = uids[-limit:]

        typ, fetched = imap.uid("fetch", b",".join(recent), "(RFC822)")
        if typ != "OK":
            raise imaplib.IMAP4.error("拉取邮件内容失败")

        results: List[Dict[str, Any]] = []
        for item in fetched:
            if not isinstance(item, tuple) or len(item) < 2:
                continue
            try:
                msg = email.message_from_bytes(item[1])
                sent_at = ""
                if msg.get("Date"):
                    try:
                        sent_at = parsedate_to_datetime(msg["Date"]).strftime("%Y-%m-%d %H:%M")
                    except Exception:
                        sent_at = msg["Date"]
                uid_match = re.search(rb"UID (\d+)", item[0] or b"")
                results.append({
                    "uid": uid_match.group(1).decode() if uid_match else "",
                    "subject": _decode(msg.get("Subject", "")) or "(无主题)",
                    "to": _decode(msg.get("To", "")),
                    "date": sent_at,
                    "body": _extract_body(msg),
                })
            except Exception:
                continue
        results.reverse()  # 最近的在前
        return results
    finally:
        try:
            imap.logout()
        except Exception:
            pass
