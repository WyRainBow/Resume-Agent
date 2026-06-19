import asyncio
import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient

from backend import better_auth


def load_better_auth_route_module():
    route_path = Path(__file__).resolve().parents[1] / "routes" / "better_auth.py"
    spec = importlib.util.spec_from_file_location("better_auth_route_for_test", route_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_extract_bearer_token_rejects_missing_header():
    with pytest.raises(HTTPException) as exc:
        better_auth.extract_bearer_token(None)

    assert exc.value.status_code == 401
    assert exc.value.detail == "未提供 BetterAuth Bearer Token"


def test_extract_bearer_token_accepts_bearer_header():
    assert better_auth.extract_bearer_token("Bearer session-token") == "session-token"


def test_verify_better_auth_token_calls_get_session(monkeypatch):
    calls = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "session": {"id": "session_1"},
                "user": {
                    "id": "user_1",
                    "email": "ada@example.com",
                    "name": "Ada Lovelace",
                    "image": "https://example.com/ada.png",
                },
            }

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            calls["client_kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url, headers):
            calls["url"] = url
            calls["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(better_auth.httpx, "AsyncClient", FakeAsyncClient)

    user = asyncio.run(
        better_auth.verify_better_auth_token(
            "session-token",
            auth_base_url="http://localhost:3000",
        )
    )

    assert calls["url"] == "http://localhost:3000/api/auth/get-session"
    assert calls["headers"] == {"Authorization": "Bearer session-token"}
    assert user.id == "user_1"
    assert user.email == "ada@example.com"
    assert user.name == "Ada Lovelace"
    assert user.image == "https://example.com/ada.png"


def test_verify_better_auth_token_rejects_empty_session(monkeypatch):
    class FakeResponse:
        status_code = 200

        def json(self):
            return None

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url, headers):
            return FakeResponse()

    monkeypatch.setattr(better_auth.httpx, "AsyncClient", FakeAsyncClient)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            better_auth.verify_better_auth_token(
                "session-token",
                auth_base_url="http://localhost:3000",
            )
        )

    assert exc.value.status_code == 401


def test_protected_probe_route_uses_dependency(monkeypatch):
    async def fake_current_user():
        return better_auth.BetterAuthUser(
            id="user_1",
            email="ada@example.com",
            name="Ada Lovelace",
            image=None,
        )

    app = FastAPI()

    @app.get("/probe")
    async def probe(user=Depends(fake_current_user)):
        return {"id": user.id, "email": user.email}

    client = TestClient(app)
    response = client.get("/probe")

    assert response.status_code == 200
    assert response.json() == {"id": "user_1", "email": "ada@example.com"}


def test_current_user_accepts_trusted_internal_headers(monkeypatch):
    monkeypatch.setenv("FASTAPI_INTERNAL_AUTH_SECRET", "shared-secret")
    app = FastAPI()

    @app.get("/probe")
    async def probe(user=Depends(better_auth.get_current_better_auth_user)):
        return {"id": user.id, "email": user.email, "name": user.name, "image": user.image}

    client = TestClient(app)
    response = client.get(
        "/probe",
        headers={
            "X-Internal-Auth-Secret": "shared-secret",
            "X-Better-Auth-User-Id": "user_1",
            "X-Better-Auth-User-Email": "ada@example.com",
            "X-Better-Auth-User-Name": "Ada Lovelace",
            "X-Better-Auth-User-Image": "https://example.com/ada.png",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": "user_1",
        "email": "ada@example.com",
        "name": "Ada Lovelace",
        "image": "https://example.com/ada.png",
    }


def test_current_user_rejects_invalid_internal_secret(monkeypatch):
    monkeypatch.setenv("FASTAPI_INTERNAL_AUTH_SECRET", "shared-secret")
    app = FastAPI()

    @app.get("/probe")
    async def probe(user=Depends(better_auth.get_current_better_auth_user)):
        return {"id": user.id}

    client = TestClient(app)
    response = client.get(
        "/probe",
        headers={
            "X-Internal-Auth-Secret": "wrong-secret",
            "X-Better-Auth-User-Id": "user_1",
        },
    )

    assert response.status_code == 401


def test_better_auth_me_route_returns_verified_user(monkeypatch):
    better_auth_route = load_better_auth_route_module()

    async def fake_current_user():
        return better_auth.BetterAuthUser(
            id="user_1",
            email="ada@example.com",
            name="Ada Lovelace",
            image=None,
        )

    app = FastAPI()
    app.dependency_overrides[better_auth.get_current_better_auth_user] = fake_current_user
    app.include_router(better_auth_route.router)

    client = TestClient(app)
    response = client.get("/api/auth/better/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": "user_1",
        "email": "ada@example.com",
        "name": "Ada Lovelace",
        "image": None,
    }
