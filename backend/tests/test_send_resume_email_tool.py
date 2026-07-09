"""send_resume_email 工具测试:confirm 两段式 / 无凭证 / 超限 / 非 admin 不注册"""
import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# 工具模块 import 期就要拿 logger,必须先初始化日志
from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import asyncio

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.models import EmailCredential, User
# 先导入 manus 完成 agent 包初始化,避开 backend.agent.tool.__init__ 的循环导入
import backend.agent.agent.manus  # noqa: F401
from backend.agent.tool import send_resume_email_tool as tool_module
from backend.agent.tool.send_resume_email_tool import SendResumeEmailTool
from backend.agent.tool.resume_data_store import ResumeDataStore

SESSION_ID = "test-email-session"
RESUME = {"basic": {"name": "张三"}, "experience": [], "projects": []}


@pytest.fixture()
def db_session(monkeypatch):
    monkeypatch.setenv("EMAIL_CREDENTIAL_ENC_KEY", Fernet.generate_key().decode())
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[User.__table__, EmailCredential.__table__])
    SessionLocal = sessionmaker(bind=engine)
    monkeypatch.setattr("backend.database.SessionLocal", SessionLocal)
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(autouse=True)
def resume_in_store():
    ResumeDataStore.set_data(dict(RESUME), session_id=SESSION_ID)
    tool_module._send_attempts.clear()
    yield
    ResumeDataStore._data_by_session.pop(SESSION_ID, None)


def make_tool(user_id=1):
    tool = SendResumeEmailTool()
    tool.session_id = SESSION_ID
    tool.user_id = user_id
    return tool


def seed_admin_with_credential(db):
    from backend.utils.crypto import encrypt_secret

    user = User(username="boss", email="boss@example.com", password_hash="x", role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(EmailCredential(
        user_id=user.id,
        email_address="boss@qq.com",
        encrypted_auth_code=encrypt_secret("authcode"),
    ))
    db.commit()
    return user


def test_first_call_returns_confirmation_without_sending(db_session):
    tool = make_tool()
    with patch.object(SendResumeEmailTool, "_render_pdf") as mock_pdf:
        result = asyncio.run(tool.execute(to_email="hr@example.com"))
    assert result.error is None
    assert "确认" in result.output
    assert "hr@example.com" in result.output
    mock_pdf.assert_not_called()


def test_confirmed_send_golden_path(db_session):
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    with patch.object(SendResumeEmailTool, "_render_pdf", return_value=b"%PDF"), \
         patch("backend.services.email_sender.send_resume_email") as mock_send:
        result = asyncio.run(tool.execute(to_email="hr@example.com", confirm=True))
    assert result.error is None, result.error
    assert "已通过 boss@qq.com" in result.output
    kwargs = mock_send.call_args.kwargs
    assert kwargs["to_email"] == "hr@example.com"
    assert kwargs["auth_code"] == "authcode"
    assert kwargs["filename"] == "张三的简历.pdf"


def test_no_credential_prompts_connection(db_session):
    user = User(username="boss2", email="b2@example.com", password_hash="x", role="admin")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    tool = make_tool(user.id)
    result = asyncio.run(tool.execute(to_email="hr@example.com", confirm=True))
    assert result.error and "还没有连接 QQ 邮箱" in result.error


def test_non_admin_rejected(db_session):
    user = User(username="pleb", email="p@example.com", password_hash="x", role="user")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    tool = make_tool(user.id)
    result = asyncio.run(tool.execute(to_email="hr@example.com", confirm=True))
    assert result.error and "仅管理员" in result.error


def test_rate_limit(db_session):
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    with patch.object(SendResumeEmailTool, "_render_pdf", return_value=b"%PDF"), \
         patch("backend.services.email_sender.send_resume_email"):
        for _ in range(5):
            result = asyncio.run(tool.execute(to_email="hr@example.com", confirm=True))
            assert result.error is None
        result = asyncio.run(tool.execute(to_email="hr@example.com", confirm=True))
    assert result.error and "太频繁" in result.error


def test_invalid_email_rejected(db_session):
    tool = make_tool()
    result = asyncio.run(tool.execute(to_email="not-an-email"))
    assert result.error and "格式不正确" in result.error


def test_tool_not_registered_for_non_admin():
    from backend.agent.agent.manus import Manus

    admin_agent = Manus(session_id="s-admin", is_admin=True, user_id=1)
    normal_agent = Manus(session_id="s-user", is_admin=False, user_id=2)
    admin_names = [t.name for t in admin_agent.available_tools.tools]
    normal_names = [t.name for t in normal_agent.available_tools.tools]
    assert "send_resume_email" in admin_names
    assert "send_resume_email" not in normal_names
    # user_id 注入到位
    email_tool = next(t for t in admin_agent.available_tools.tools if t.name == "send_resume_email")
    assert email_tool.user_id == 1
