from io import BytesIO
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.main import app
import backend.routes.pdf as pdf_route


def test_render_pdf_uses_template_id_from_body(monkeypatch):
    captured = {}

    def fake_compile(latex_content, template_dir, resume_data=None):
        captured["latex"] = latex_content
        captured["template_dir"] = template_dir
        return BytesIO(b"%PDF-1.4\n%fake\n")

    monkeypatch.setattr(pdf_route, "compile_latex_to_pdf", fake_compile, raising=False)
    client = TestClient(app)

    response = client.post(
        "/api/pdf/render",
        json={
            "template_id": "compact",
            "resume": {"name": "张三", "contact": {}, "globalSettings": {}},
            "section_order": [],
        },
    )

    assert response.status_code == 200
    assert captured["template_dir"].name == "compact"
    assert "\\geometry{a4paper,left=0.25in" in captured["latex"]


def test_render_pdf_rejects_unknown_template():
    client = TestClient(app)

    response = client.post(
        "/api/pdf/render",
        json={
            "template_id": "missing-template",
            "resume": {"name": "张三", "contact": {}},
            "section_order": [],
        },
    )

    assert response.status_code == 422
    assert "模板不存在" in response.json()["detail"]


def test_render_pdf_uses_resume_template_id_when_body_omits_it(monkeypatch):
    captured = {}

    def fake_compile(latex_content, template_dir, resume_data=None):
        captured["template_dir"] = template_dir
        return BytesIO(b"%PDF-1.4\n%fake\n")

    monkeypatch.setattr(pdf_route, "compile_latex_to_pdf", fake_compile, raising=False)
    client = TestClient(app)

    response = client.post(
        "/api/pdf/render",
        json={
            "resume": {"templateId": "compact", "name": "张三", "contact": {}},
            "section_order": [],
        },
    )

    assert response.status_code == 200
    assert captured["template_dir"].name == "compact"
