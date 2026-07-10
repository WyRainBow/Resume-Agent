"""send_resume_email 运行时确认协议测试:
挂起门禁(未批准任何路径不发送)/ 确认前校验 / approve 带改后参数 / cancel /
越权 403 / 限频与 admin 校验保留 / 非 admin 会话不注册工具
"""
import sys
import os
import asyncio
import json
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # backend/ 供 middleware.auth 的脚本式 import

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.models import EmailCredential, User
# 先导入 manus 完成 agent 包初始化,避开 backend.agent.tool.__init__ 的循环导入
import backend.agent.agent.manus  # noqa: F401
# 路由链(经 middleware.auth → backend/auth.py)在首次 import 时会 load_dotenv(override=True)
# 覆盖进程 env;必须在任何 monkeypatch.setenv 之前完成这次 import,否则测试内设置的
# EMAIL_CREDENTIAL_ENC_KEY 会被真实 .env 覆盖,导致解密签名不匹配
from backend.agent.web.routes.approval import router as approval_router  # noqa: E402
from backend.middleware.auth import get_current_user  # noqa: E402
from backend.agent import approval as approval_store
from backend.agent.tool import send_resume_email_tool as tool_module
from backend.agent.tool.send_resume_email_tool import SendResumeEmailTool
from backend.agent.tool.resume_data_store import ResumeDataStore
from backend.agent.schema import ToolCall
from backend.agent.schema import Function as ToolFunction

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
def clean_state():
    ResumeDataStore.set_data(dict(RESUME), session_id=SESSION_ID)
    tool_module._send_attempts.clear()
    approval_store._pending.clear()
    yield
    ResumeDataStore._data_by_session.pop(SESSION_ID, None)
    approval_store._pending.clear()


def make_tool(user_id=1):
    tool = SendResumeEmailTool()
    tool.session_id = SESSION_ID
    tool.user_id = user_id
    return tool


def seed_admin_with_credential(db, username="boss"):
    from backend.utils.crypto import encrypt_secret

    user = User(username=username, email=f"{username}@example.com", password_hash="x", role="admin")
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


# ---------- 挂起门禁(execute_tool 层) ----------

def make_agent_with_tool(tool):
    from backend.agent.agent.manus import Manus

    agent = Manus(session_id=SESSION_ID, is_admin=True, user_id=tool.user_id)
    agent.available_tools.tool_map[tool.name] = tool
    return agent


def run_execute_tool(agent, args: dict):
    call = ToolCall(
        id="call_test_1",
        type="function",
        function=ToolFunction(name="send_resume_email", arguments=json.dumps(args)),
    )
    return asyncio.run(agent.execute_tool(call))


def test_gate_suspends_instead_of_sending(db_session):
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    agent = make_agent_with_tool(tool)
    with patch("backend.services.email_sender.send_resume_email") as mock_send:
        observation = run_execute_tool(agent, {
            "to_email": "someone@qq.com",
            "body": "帮你优化了实习经历的量化表达,建议补充项目链接。",
        })
    mock_send.assert_not_called()
    assert "等待用户确认" in observation
    structured = agent.get_structured_tool_result("call_test_1")
    assert structured and structured["type"] == "approval_request"
    payload = structured["payload"]
    assert payload["editable_fields"] == ["to_email", "subject", "body"]
    assert payload["attachment_label"] == "《张三的简历》PDF"
    assert approval_store.get_valid(payload["approval_id"]) is not None
    assert agent._halt_for_pending_approval is True


def test_gate_strips_llm_approved_flag(db_session):
    """LLM 在参数里塞 _approved=true 也无法绕过挂起门"""
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    agent = make_agent_with_tool(tool)
    with patch("backend.services.email_sender.send_resume_email") as mock_send:
        run_execute_tool(agent, {
            "to_email": "someone@qq.com",
            "body": "正文",
            "_approved": True,
        })
    mock_send.assert_not_called()
    assert len(approval_store._pending) == 1


def test_validation_failure_produces_no_pending(db_session):
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    agent = make_agent_with_tool(tool)
    observation = run_execute_tool(agent, {"to_email": "not-an-email", "body": "x"})
    assert "格式不正确" in observation
    assert len(approval_store._pending) == 0

    observation = run_execute_tool(agent, {"to_email": "a@qq.com", "body": "  "})
    assert "正文不能为空" in observation
    assert len(approval_store._pending) == 0


def test_supersede_old_pending(db_session):
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    agent = make_agent_with_tool(tool)
    run_execute_tool(agent, {"to_email": "a@qq.com", "body": "第一版"})
    run_execute_tool(agent, {"to_email": "a@qq.com", "body": "第二版"})
    assert len(approval_store._pending) == 1
    only = list(approval_store._pending.values())[0]
    assert only["args"]["body"] == "第二版"


# ---------- approval 端点 ----------

def make_client(current_user):
    app = FastAPI()
    app.include_router(approval_router, prefix="/api/agent")
    app.dependency_overrides[get_current_user] = lambda: current_user
    return TestClient(app)


def create_pending_via_gate(db, user):
    tool = make_tool(user.id)
    agent = make_agent_with_tool(tool)
    run_execute_tool(agent, {
        "to_email": "someone@qq.com",
        "subject": None,
        "body": "原始正文",
    })
    return agent.get_structured_tool_result("call_test_1")["payload"]["approval_id"]


def test_approve_sends_with_edited_params(db_session):
    user = seed_admin_with_credential(db_session)
    approval_id = create_pending_via_gate(db_session, user)
    client = make_client(user)
    with patch.object(SendResumeEmailTool, "_render_pdf", return_value=b"%PDF"), \
         patch("backend.services.email_sender.send_resume_email") as mock_send:
        resp = client.post("/api/agent/approval", json={
            "approval_id": approval_id,
            "action": "approve",
            "params": {"body": "用户改过的正文", "subject": "改后的主题", "ignored_field": "x"},
        })
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True
    kwargs = mock_send.call_args.kwargs
    assert kwargs["body"] == "用户改过的正文"
    assert kwargs["subject"] == "改后的主题"
    assert kwargs["to_email"] == "someone@qq.com"
    # 单次有效:执行后 pending 失效
    assert approval_store.get_valid(approval_id) is None


def test_cancel_drops_pending(db_session):
    user = seed_admin_with_credential(db_session)
    approval_id = create_pending_via_gate(db_session, user)
    client = make_client(user)
    resp = client.post("/api/agent/approval", json={"approval_id": approval_id, "action": "cancel"})
    assert resp.status_code == 200 and resp.json()["ok"] is True
    assert approval_store.get_valid(approval_id) is None


def test_foreign_user_forbidden(db_session):
    user = seed_admin_with_credential(db_session)
    approval_id = create_pending_via_gate(db_session, user)
    intruder = User(username="intruder", email="i@example.com", password_hash="x", role="admin")
    db_session.add(intruder)
    db_session.commit()
    db_session.refresh(intruder)
    client = make_client(intruder)
    resp = client.post("/api/agent/approval", json={"approval_id": approval_id, "action": "approve"})
    assert resp.status_code == 403


def test_unknown_or_expired_pending_404(db_session):
    user = seed_admin_with_credential(db_session)
    client = make_client(user)
    resp = client.post("/api/agent/approval", json={"approval_id": "appr_missing", "action": "approve"})
    assert resp.status_code == 404


# ---------- execute 本体的护栏保留 ----------

def test_rate_limit_preserved(db_session):
    user = seed_admin_with_credential(db_session)
    tool = make_tool(user.id)
    with patch.object(SendResumeEmailTool, "_render_pdf", return_value=b"%PDF"), \
         patch("backend.services.email_sender.send_resume_email"):
        for _ in range(5):
            result = asyncio.run(tool.execute(to_email="a@qq.com", body="正文"))
            assert result.error is None
        result = asyncio.run(tool.execute(to_email="a@qq.com", body="正文"))
    assert result.error and "太频繁" in result.error


def test_non_admin_rejected_in_execute(db_session):
    user = User(username="pleb", email="p@example.com", password_hash="x", role="user")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    tool = make_tool(user.id)
    result = asyncio.run(tool.execute(to_email="a@qq.com", body="正文"))
    assert result.error and "仅管理员" in result.error


def test_tool_not_registered_for_non_admin():
    from backend.agent.agent.manus import Manus

    admin_agent = Manus(session_id="s-admin", is_admin=True, user_id=1)
    normal_agent = Manus(session_id="s-user", is_admin=False, user_id=2)
    assert "send_resume_email" in [t.name for t in admin_agent.available_tools.tools]
    assert "send_resume_email" not in [t.name for t in normal_agent.available_tools.tools]
