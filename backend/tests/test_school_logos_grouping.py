import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi.testclient import TestClient

from backend.main import app
import backend.school_logos as school_logos


def test_local_school_logos_are_grouped_from_nested_directories(tmp_path, monkeypatch):
    base = tmp_path / "school_logo"
    (base / "985").mkdir(parents=True)
    (base / "211").mkdir(parents=True)
    (base / "香港").mkdir(parents=True)
    (base / "双非").mkdir(parents=True)
    (base / "985" / "北京大学.png").write_bytes(b"fake")
    (base / "211" / "吉林大学.png").write_bytes(b"fake")
    (base / "香港" / "香港大学.png").write_bytes(b"fake")
    (base / "双非" / "深圳大学.png").write_bytes(b"fake")

    monkeypatch.setattr(school_logos, "LOCAL_SCHOOL_LOGO_DIR", base)
    monkeypatch.delenv("COS_SECRET_ID", raising=False)
    monkeypatch.delenv("COS_SECRET_KEY", raising=False)
    school_logos.clear_cache()

    groups = school_logos.get_grouped_school_logos_with_urls()
    flat = school_logos.get_all_school_logos_with_urls()

    assert [group["name"] for group in groups] == ["985", "211", "香港", "双非"]
    assert [logo["name"] for logo in groups[0]["logos"]] == ["北京大学"]
    assert [logo["name"] for logo in groups[1]["logos"]] == ["吉林大学"]
    assert [logo["name"] for logo in groups[2]["logos"]] == ["香港大学"]
    assert [logo["name"] for logo in groups[3]["logos"]] == ["深圳大学"]
    assert {logo["key"] for logo in flat} == {"北京大学", "吉林大学", "香港大学", "深圳大学"}


def test_school_logos_api_returns_groups_and_flat_list(tmp_path, monkeypatch):
    base = tmp_path / "school_logo"
    (base / "985").mkdir(parents=True)
    (base / "985" / "北京大学.png").write_bytes(b"fake")

    monkeypatch.setattr(school_logos, "LOCAL_SCHOOL_LOGO_DIR", base)
    monkeypatch.delenv("COS_SECRET_ID", raising=False)
    monkeypatch.delenv("COS_SECRET_KEY", raising=False)
    school_logos.clear_cache()

    client = TestClient(app)
    response = client.get("/api/school-logos")

    assert response.status_code == 200
    payload = response.json()
    assert payload["logos"][0]["name"] == "北京大学"
    assert payload["groups"][0]["name"] == "985"
    assert payload["groups"][0]["logos"][0]["name"] == "北京大学"
