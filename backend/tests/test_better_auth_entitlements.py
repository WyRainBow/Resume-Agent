import importlib.util
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.better_auth import BetterAuthUser, get_current_better_auth_user
from backend.database import Base, get_db
from backend.models import BetterAuthEntitlement
from backend.services.better_auth_entitlements import get_or_create_entitlement


def make_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[BetterAuthEntitlement.__table__])
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def load_better_auth_route_module():
    route_path = Path(__file__).resolve().parents[1] / "routes" / "better_auth.py"
    spec = importlib.util.spec_from_file_location("better_auth_route_for_entitlement_test", route_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_get_or_create_entitlement_creates_free_defaults():
    db = make_session()
    user = BetterAuthUser(id="ba_user_1", email="ada@example.com", name="Ada", image=None)

    entitlement = get_or_create_entitlement(db, user)

    assert entitlement.better_auth_user_id == "ba_user_1"
    assert entitlement.email == "ada@example.com"
    assert entitlement.name == "Ada"
    assert entitlement.plan == "free"
    assert entitlement.credits == 0
    assert entitlement.daily_usage_count == 0
    assert entitlement.subscription_status == "free"
    assert entitlement.provider_customer_id is None
    assert entitlement.provider_subscription_id is None


def test_get_or_create_entitlement_reuses_existing_row_and_refreshes_profile():
    db = make_session()

    first = get_or_create_entitlement(
        db,
        BetterAuthUser(id="ba_user_1", email="old@example.com", name="Old", image=None),
    )
    first.credits = 12
    db.commit()

    second = get_or_create_entitlement(
        db,
        BetterAuthUser(id="ba_user_1", email="new@example.com", name="New", image="https://example.com/a.png"),
    )

    assert second.id == first.id
    assert second.email == "new@example.com"
    assert second.name == "New"
    assert second.image == "https://example.com/a.png"
    assert second.credits == 12
    assert db.query(BetterAuthEntitlement).count() == 1


def test_better_auth_account_route_returns_user_and_entitlement():
    better_auth_route = load_better_auth_route_module()
    db = make_session()

    async def fake_current_user():
        return BetterAuthUser(id="ba_user_1", email="ada@example.com", name="Ada", image=None)

    def fake_get_db():
        yield db

    app = FastAPI()
    app.dependency_overrides[get_current_better_auth_user] = fake_current_user
    app.dependency_overrides[get_db] = fake_get_db
    app.include_router(better_auth_route.router)

    client = TestClient(app)
    response = client.get("/api/auth/better/account")

    assert response.status_code == 200
    assert response.json() == {
        "user": {
            "id": "ba_user_1",
            "email": "ada@example.com",
            "name": "Ada",
            "image": None,
        },
        "entitlement": {
            "plan": "free",
            "credits": 0,
            "daily_usage_count": 0,
            "subscription_status": "free",
            "provider_customer_id": None,
            "provider_subscription_id": None,
            "current_period_end": None,
        },
    }


def test_better_auth_health_route_reports_non_secret_status(monkeypatch):
    better_auth_route = load_better_auth_route_module()
    db = make_session()
    monkeypatch.setenv("BETTER_AUTH_INTERNAL_URL", "http://localhost:3000")
    monkeypatch.setenv("FASTAPI_INTERNAL_AUTH_SECRET", "super-secret-value")

    def fake_get_db():
        yield db

    app = FastAPI()
    app.dependency_overrides[get_db] = fake_get_db
    app.include_router(better_auth_route.router)

    client = TestClient(app)
    response = client.get("/api/auth/better/health")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "better_auth_internal_url": "http://localhost:3000",
        "better_auth_internal_url_configured": True,
        "fastapi_internal_auth_secret_configured": True,
        "entitlement_table_ready": True,
    }
    assert "super-secret-value" not in response.text
