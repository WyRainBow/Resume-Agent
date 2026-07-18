"""Tests for PDF download quota enforcement.

2026-07-17 身份统一：配额计数存 better_auth_entitlements，入参为 AppUser
（BetterAuth 非数字字符串 id——同时充当防 int() 假设复活的回归护栏）。
"""

import logging
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import BetterAuthEntitlement
from backend.core.logger import setup_logging

setup_logging(is_production=False, log_level="ERROR", log_dir=None)

from backend.middleware.auth import AppUser
from backend.routes import pdf as pdf_routes
from backend.models import RenderPDFRequest
from backend.services.pdf_download_quota import (
    PDF_DOWNLOAD_LIMIT,
    assert_pdf_download_allowed,
    build_quota_payload,
    get_pdf_download_remaining,
    record_successful_pdf_download,
)

BA_ID = "jD8mNxK4tQw9RbY2eZ7cV5uH1aS6fG3p"  # 32 位非数字 BetterAuth id


def _set_count(session, value: int) -> None:
    session.query(BetterAuthEntitlement).filter(
        BetterAuthEntitlement.better_auth_user_id == BA_ID
    ).update({"pdf_download_count": value})
    session.commit()


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(
        BetterAuthEntitlement(
            better_auth_user_id=BA_ID,
            email="tester@example.com",
            name="tester",
            role="user",
            pdf_download_count=0,
        )
    )
    session.commit()
    user = AppUser(
        id=BA_ID,
        email="tester@example.com",
        name="tester",
        role="user",
        pdf_download_count=0,
    )
    try:
        yield session, user
    finally:
        session.close()


def test_regular_user_quota_payload(db_session):
    session, user = db_session
    payload = build_quota_payload(user)
    assert payload["limit"] == PDF_DOWNLOAD_LIMIT
    assert payload["used"] == 0
    assert payload["remaining"] == PDF_DOWNLOAD_LIMIT
    assert payload["unlimited"] is False


def test_admin_user_unlimited():
    admin = SimpleNamespace(role="admin", pdf_download_count=99)
    payload = build_quota_payload(admin)
    assert payload["unlimited"] is True
    assert payload["remaining"] is None
    assert_pdf_download_allowed(admin)


def test_record_successful_pdf_download_increments(db_session):
    session, user = db_session
    record_successful_pdf_download(user, session)
    assert user.pdf_download_count == 1
    assert get_pdf_download_remaining(user) == PDF_DOWNLOAD_LIMIT - 1
    stored = (
        session.query(BetterAuthEntitlement.pdf_download_count)
        .filter(BetterAuthEntitlement.better_auth_user_id == BA_ID)
        .scalar()
    )
    assert stored == 1


def test_limit_blocks_after_max(db_session):
    session, user = db_session
    _set_count(session, PDF_DOWNLOAD_LIMIT)
    user.pdf_download_count = PDF_DOWNLOAD_LIMIT

    with pytest.raises(HTTPException) as exc:
        assert_pdf_download_allowed(user)
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc2:
        record_successful_pdf_download(user, session)
    assert exc2.value.status_code == 403


def test_limit_exceeded_logs_quota_context(db_session, caplog):
    session, user = db_session
    _set_count(session, PDF_DOWNLOAD_LIMIT)
    user.pdf_download_count = PDF_DOWNLOAD_LIMIT

    with caplog.at_level(logging.WARNING, logger="backend"):
        with pytest.raises(HTTPException):
            assert_pdf_download_allowed(user)

    assert "PDF_DOWNLOAD_LIMIT_EXCEEDED" in caplog.text
    assert f"user_id={user.id}" in caplog.text
    assert f"used={PDF_DOWNLOAD_LIMIT}" in caplog.text
    assert f"limit={PDF_DOWNLOAD_LIMIT}" in caplog.text


@pytest.mark.anyio
async def test_render_pdf_preview_does_not_consume_download_quota(db_session, monkeypatch):
    session, user = db_session
    _set_count(session, PDF_DOWNLOAD_LIMIT)
    user.pdf_download_count = PDF_DOWNLOAD_LIMIT

    monkeypatch.setattr(pdf_routes, "_prepare_latex_content", lambda *_args, **_kwargs: "latex")
    monkeypatch.setattr(pdf_routes, "_compile_pdf_bytes", lambda *_args, **_kwargs: b"%PDF-1.4\n")

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/pdf/render",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )
    body = RenderPDFRequest(resume={"name": "Tester"}, section_order=[])

    response = await pdf_routes.render_pdf(body, request, user, session)

    assert response.status_code == 200
    assert user.pdf_download_count == PDF_DOWNLOAD_LIMIT
    stored = (
        session.query(BetterAuthEntitlement.pdf_download_count)
        .filter(BetterAuthEntitlement.better_auth_user_id == BA_ID)
        .scalar()
    )
    assert stored == PDF_DOWNLOAD_LIMIT
