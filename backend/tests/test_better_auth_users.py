import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.better_auth import BetterAuthUser
from backend.database import Base
from backend.models import User
from backend.services.better_auth_users import resolve_legacy_user


def make_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[User.__table__])
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def test_resolve_legacy_user_creates_user_from_better_auth_profile():
    db = make_session()
    user = resolve_legacy_user(
        db,
        BetterAuthUser(
            id="ba_user_1",
            email="ada@example.com",
            name="Ada Lovelace",
            image=None,
        ),
    )

    assert user.id is not None
    assert user.email == "ada@example.com"
    assert user.username == "Ada-Lovelace"
    assert user.role == "user"
    assert db.query(User).count() == 1


def test_resolve_legacy_user_reuses_existing_email():
    db = make_session()
    existing = User(username="legacy", email="ada@example.com", password_hash="hash")
    db.add(existing)
    db.commit()

    user = resolve_legacy_user(
        db,
        BetterAuthUser(id="ba_user_1", email="ada@example.com", name="Ada", image=None),
    )

    assert user.id == existing.id
    assert db.query(User).count() == 1


def test_get_current_user_accepts_trusted_headers(monkeypatch):
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
        return {"id": current_user.id, "email": current_user.email}

    app.dependency_overrides[get_db] = fake_get_db

    client = TestClient(app)
    response = client.get(
        "/probe",
        headers={
            "X-Internal-Auth-Secret": "shared-secret",
            "X-Better-Auth-User-Id": "ba_user_1",
            "X-Better-Auth-User-Email": "ada@example.com",
            "X-Better-Auth-User-Name": "Ada Lovelace",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert isinstance(body["id"], int)