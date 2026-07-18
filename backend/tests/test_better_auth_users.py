"""身份解析测试（2026-07-17 身份统一后语义）。

原 resolve_legacy_user 邮箱桥接已随 users 表退役；本文件改测新链路：
BetterAuth 身份 → get_or_create_entitlement → AppUser（字符串 id 透传）。
含非数字 32 位 id 回归护栏（防 int() 假设复活）。
"""
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.better_auth import BetterAuthUser
from backend.database import Base
from backend.models import BetterAuthEntitlement
from backend.services.better_auth_entitlements import get_or_create_entitlement

# 典型 BetterAuth id：32 位随机字符串（非数字）
BA_ID = "LndqVOVPwql7rmVFjkrcSBfO6rG6JO06"


def make_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[BetterAuthEntitlement.__table__])
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def test_get_or_create_entitlement_creates_profile_with_defaults():
    db = make_session()
    ent = get_or_create_entitlement(
        db,
        BetterAuthUser(id=BA_ID, email="ada@example.com", name="Ada Lovelace", image=None),
    )

    assert ent.better_auth_user_id == BA_ID
    assert ent.email == "ada@example.com"
    assert ent.role == "user"
    assert (ent.pdf_download_count or 0) == 0
    assert db.query(BetterAuthEntitlement).count() == 1


def test_get_or_create_entitlement_reuses_existing_row():
    db = make_session()
    first = get_or_create_entitlement(
        db, BetterAuthUser(id=BA_ID, email="ada@example.com", name="Ada", image=None)
    )
    first.role = "admin"
    db.commit()

    again = get_or_create_entitlement(
        db, BetterAuthUser(id=BA_ID, email="ada@new.com", name="Ada L", image=None)
    )

    assert again.id == first.id
    assert again.role == "admin"          # 已有 profile 字段不被重置
    assert again.email == "ada@new.com"   # 联系信息随 BetterAuth 刷新
    assert db.query(BetterAuthEntitlement).count() == 1


def test_get_current_user_accepts_trusted_headers_with_string_id(monkeypatch):
    backend_dir = Path(__file__).resolve().parents[1]
    backend_dir_str = str(backend_dir)
    if backend_dir_str not in sys.path:
        sys.path.insert(0, backend_dir_str)

    from fastapi import Depends, FastAPI
    from fastapi.testclient import TestClient
    from database import get_db
    from middleware.auth import get_current_user

    db = make_session()
    monkeypatch.setenv("FASTAPI_INTERNAL_AUTH_SECRET", "shared-secret")

    def fake_get_db():
        yield db

    app = FastAPI()

    @app.get("/probe")
    async def probe(current_user=Depends(get_current_user)):
        return {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
        }

    app.dependency_overrides[get_db] = fake_get_db

    client = TestClient(app)
    response = client.get(
        "/probe",
        headers={
            "X-Internal-Auth-Secret": "shared-secret",
            "X-Better-Auth-User-Id": BA_ID,
            "X-Better-Auth-User-Email": "ada@example.com",
            "X-Better-Auth-User-Name": "Ada Lovelace",
        },
    )

    assert response.status_code == 200
    body = response.json()
    # 身份统一核心断言：id 是 BetterAuth 字符串原样透传，不再是整数
    assert body["id"] == BA_ID
    assert isinstance(body["id"], str)
    assert body["email"] == "ada@example.com"
    assert body["role"] == "user"
    # 副作用：entitlements 行已按需创建
    assert db.query(BetterAuthEntitlement).count() == 1
