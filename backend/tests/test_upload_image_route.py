import io

from fastapi.testclient import TestClient

from backend.main import app
import backend.routes.resume as resume_routes

client = TestClient(app)


def _patch(monkeypatch):
    monkeypatch.setattr(
        resume_routes, "image_to_text", lambda b, ct, m: "王宇 后端开发工程师"
    )
    monkeypatch.setattr(
        resume_routes,
        "assemble_resume_data",
        lambda raw_text, layout, ocr_text, model: {"name": "王宇"},
    )
    monkeypatch.setattr(
        resume_routes, "normalize_resume_json", lambda d: {"name": "王宇", "skills": []}
    )


def test_upload_image_golden(monkeypatch):
    _patch(monkeypatch)
    files = {"file": ("r.png", io.BytesIO(b"\x89PNG"), "image/png")}
    resp = client.post(
        "/api/resume/upload-image", files=files, data={"model": "qwen-vl-max"}
    )
    assert resp.status_code == 200
    assert resp.json()["resume"]["name"] == "王宇"


def test_upload_image_rejects_non_image(monkeypatch):
    _patch(monkeypatch)
    files = {"file": ("r.pdf", io.BytesIO(b"%PDF"), "application/pdf")}
    resp = client.post(
        "/api/resume/upload-image", files=files, data={"model": "qwen-vl-max"}
    )
    assert resp.status_code == 400
