"""邮件模板路由测试:预置四岗位 + 自存 CRUD + 权限"""
import importlib.util
import sys
from pathlib import Path

import pytest
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


def load_route_module():
    route_path = BACKEND_DIR / "routes" / "email_templates.py"
    spec = importlib.util.spec_from_file_location("email_templates_route_test", route_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_client(role: str):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[User.__table__, EmailTemplate.__table__])
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    user = User(username="tester", email="t@example.com", password_hash="x", role=role)
    db.add(user)
    db.commit()
    db.refresh(user)

    module = load_route_module()
    app = FastAPI()
    app.include_router(module.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[module.get_db] = lambda: db
    app.dependency_overrides[module.get_current_user] = lambda: user
    return TestClient(app), db, user


def test_list_contains_four_presets_and_crud_roundtrip():
    client, db, user = make_client("admin")

    r = client.get("/api/email/templates")
    assert r.status_code == 200
    data = r.json()
    assert [p["name"] for p in data["presets"]] == ["运营岗", "产品岗", "会计岗", "开发岗"]
    # 按用户真实邮件风格:统一「同学你好」开场,不用 {name} 占位
    assert all(p["content"].startswith("同学你好") for p in data["presets"])
    assert data["templates"] == []

    r = client.post("/api/email/templates", json={"name": "我的默认", "content": "{name}你好,这是我的底稿"})
    assert r.status_code == 200
    tid = r.json()["template"]["id"]

    r = client.get("/api/email/templates")
    assert [t["name"] for t in r.json()["templates"]] == ["我的默认"]

    assert client.delete(f"/api/email/templates/{tid}").status_code == 200
    assert client.get("/api/email/templates").json()["templates"] == []
    assert client.delete(f"/api/email/templates/{tid}").status_code == 404


def test_length_limits_and_cross_user_isolation():
    """审查 #18:超长 name/content 拒绝;跨用户看不到也删不掉对方模板"""
    client_a, db_a, _ = make_client("admin")
    assert client_a.post("/api/email/templates", json={"name": "x" * 65, "content": "y"}).status_code == 400
    assert client_a.post("/api/email/templates", json={"name": "n", "content": "y" * 8001}).status_code == 400

    r = client_a.post("/api/email/templates", json={"name": "A的模板", "content": "内容A"})
    tid = r.json()["template"]["id"]

    client_b, _, _ = make_client("admin")  # 另一个独立用户(独立内存库,验证过滤语义)
    assert client_b.get("/api/email/templates").json()["templates"] == []
    assert client_b.delete(f"/api/email/templates/{tid}").status_code == 404

    # 同库跨用户隔离:B 用户挂进 A 的库
    from backend.models import User as UserModel
    user_b = UserModel(username="other", email="o@example.com", password_hash="x", role="admin")
    db_a.add(user_b); db_a.commit(); db_a.refresh(user_b)
    module = load_route_module()
    from fastapi import FastAPI
    from backend.database import get_db
    from middleware.auth import get_current_user
    app = FastAPI(); app.include_router(module.router)
    app.dependency_overrides[get_db] = lambda: db_a
    app.dependency_overrides[get_current_user] = lambda: user_b
    app.dependency_overrides[module.get_db] = lambda: db_a
    app.dependency_overrides[module.get_current_user] = lambda: user_b
    client_b_same_db = TestClient(app)
    assert client_b_same_db.get("/api/email/templates").json()["templates"] == []
    assert client_b_same_db.delete(f"/api/email/templates/{tid}").status_code == 404
    # A 的模板仍在
    assert [t["id"] for t in client_a.get("/api/email/templates").json()["templates"]] == [tid]


def test_validation_and_admin_gate():
    client, _, _ = make_client("admin")
    assert client.post("/api/email/templates", json={"name": "", "content": "x"}).status_code == 400
    assert client.post("/api/email/templates", json={"name": "a", "content": ""}).status_code == 400

    pleb_client, _, _ = make_client("user")
    assert pleb_client.get("/api/email/templates").status_code == 403
    assert pleb_client.post("/api/email/templates", json={"name": "a", "content": "b"}).status_code == 403
