"""邮箱凭证路由测试:golden path / 非管理员 403 / 非法邮箱 400"""
import importlib.util
import sys
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
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
from backend.models import EmailCredential, User  # noqa: E402
from middleware.auth import get_current_user  # noqa: E402


def load_route_module():
    route_path = BACKEND_DIR / "routes" / "email_credential.py"
    spec = importlib.util.spec_from_file_location("email_credential_route_test", route_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_client(role: str, monkeypatch):
    monkeypatch.setenv("EMAIL_CREDENTIAL_ENC_KEY", Fernet.generate_key().decode())
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[User.__table__, EmailCredential.__table__])
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    user = User(username="tester", email="tester@example.com", password_hash="x", role=role)
    db.add(user)
    db.commit()
    db.refresh(user)

    module = load_route_module()
    app = FastAPI()
    app.include_router(module.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    # 路由模块以脚本方式 exec,其内部 Depends 引用的是模块自己 import 的对象
    app.dependency_overrides[module.get_db] = lambda: db
    app.dependency_overrides[module.get_current_user] = lambda: user
    return TestClient(app), db, user


def test_admin_put_get_delete_roundtrip(monkeypatch):
    client, db, user = make_client("admin", monkeypatch)

    r = client.get("/api/email/credential")
    assert r.status_code == 200
    assert r.json() == {"configured": False, "masked_email": None}

    r = client.put(
        "/api/email/credential",
        json={"email_address": "coco123@qq.com", "auth_code": "abcdefghijklmnop"},
    )
    assert r.status_code == 200
    assert r.json()["configured"] is True
    assert r.json()["masked_email"] == "coc***@qq.com"

    row = db.query(EmailCredential).filter(EmailCredential.user_id == user.id).one()
    assert row.encrypted_auth_code != "abcdefghijklmnop"  # 必须加密

    r = client.delete("/api/email/credential")
    assert r.status_code == 200
    assert db.query(EmailCredential).count() == 0


def test_non_admin_forbidden(monkeypatch):
    client, _, _ = make_client("user", monkeypatch)
    assert client.get("/api/email/credential").status_code == 403
    assert client.put(
        "/api/email/credential",
        json={"email_address": "a@qq.com", "auth_code": "x"},
    ).status_code == 403
    assert client.delete("/api/email/credential").status_code == 403


def test_invalid_email_rejected(monkeypatch):
    client, _, _ = make_client("admin", monkeypatch)
    r = client.put(
        "/api/email/credential",
        json={"email_address": "hacker@gmail.com", "auth_code": "abc"},
    )
    assert r.status_code == 400
