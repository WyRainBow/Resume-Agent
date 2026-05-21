from pathlib import Path
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.main import app
from backend.resume_templates.latex.registry import (
    DEFAULT_TEMPLATE_ID,
    list_latex_templates,
    resolve_latex_template,
)


def test_list_latex_templates_contains_classic_and_compact():
    templates = list_latex_templates()
    ids = {item.id for item in templates}

    assert DEFAULT_TEMPLATE_ID == "classic"
    assert {"classic", "compact"}.issubset(ids)


def test_resolve_missing_template_uses_classic():
    resolved = resolve_latex_template(None)

    assert resolved.meta.id == "classic"
    assert resolved.template_dir.name == "classic"


def test_resolve_invalid_template_raises_value_error():
    with pytest.raises(ValueError, match="Unknown LaTeX template"):
        resolve_latex_template("not-registered")


def test_manifest_preview_path_stays_inside_template_dir():
    resolved = resolve_latex_template("classic")
    preview = resolved.preview_path

    assert preview is not None
    assert Path(preview).resolve().is_relative_to(resolved.template_dir.resolve())


def test_list_resume_templates_api_returns_latex_templates():
    client = TestClient(app)

    response = client.get("/api/resume-templates?type=latex")

    assert response.status_code == 200
    payload = response.json()
    ids = {item["id"] for item in payload["data"]}
    assert {"classic", "compact"}.issubset(ids)
    assert all(item["type"] == "latex" for item in payload["data"])


def test_template_preview_api_returns_png():
    client = TestClient(app)

    response = client.get("/api/resume-templates/classic/preview")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")
