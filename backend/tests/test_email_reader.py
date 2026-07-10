"""email_reader 测试:mock imaplib 验证解析与排序;路由无凭证 400"""
import email.message
import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
for p in (str(BACKEND_DIR), str(BACKEND_DIR.parent)):
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.database import Base, get_db  # noqa: E402
from backend.models import EmailTemplate, User  # noqa: E402
from middleware.auth import get_current_user  # noqa: E402
from backend.services.email_reader import fetch_sent_emails  # noqa: E402


def make_raw_email(subject: str, to: str, body: str, date: str) -> bytes:
    msg = email.message.EmailMessage()
    msg["Subject"] = subject
    msg["To"] = to
    msg["Date"] = date
    msg.set_content(body)
    return msg.as_bytes()


def test_fetch_sent_emails_parses_and_reverses():
    raw1 = make_raw_email("简历优化建议 v1", "a@qq.com", "第一封正文", "Wed, 09 Jul 2026 10:00:00 +0800")
    raw2 = make_raw_email("简历优化建议 v2", "b@qq.com", "第二封正文", "Thu, 10 Jul 2026 11:30:00 +0800")

    server = MagicMock()
    server.login.return_value = ("OK", [b""])
    server._simple_command.return_value = ("OK", [b""])
    server._untagged_response.return_value = ("OK", [b""])
    server.select.return_value = ("OK", [b"2"])
    server.uid.side_effect = [
        ("OK", [b"1 2"]),  # search
        ("OK", [           # fetch:两封,IMAP 顺序旧→新
            (b"1 (UID 1 RFC822)", raw1),
            (b"2 (UID 2 RFC822)", raw2),
        ]),
    ]
    with patch("backend.services.email_reader.imaplib.IMAP4_SSL", return_value=server):
        emails = fetch_sent_emails("me@qq.com", "authcode", limit=10)

    assert len(emails) == 2
    # 最近的在前
    assert emails[0]["subject"] == "简历优化建议 v2"
    assert emails[0]["to"] == "b@qq.com"
    assert emails[0]["date"].startswith("2026-07-10")
    assert "第二封正文" in emails[0]["body"]
    assert emails[1]["uid"] == "1"


def test_sent_route_requires_credential():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from backend.models import EmailCredential

    Base.metadata.create_all(
        engine, tables=[User.__table__, EmailTemplate.__table__, EmailCredential.__table__]
    )
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    user = User(username="boss", email="b@example.com", password_hash="x", role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)

    route_path = BACKEND_DIR / "routes" / "email_templates.py"
    spec = importlib.util.spec_from_file_location("email_templates_route_sent_test", route_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    app = FastAPI()
    app.include_router(module.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[module.get_db] = lambda: db
    app.dependency_overrides[module.get_current_user] = lambda: user
    client = TestClient(app)

    resp = client.get("/api/email/sent")
    assert resp.status_code == 400
    assert "连接 QQ 邮箱" in resp.json()["detail"]
