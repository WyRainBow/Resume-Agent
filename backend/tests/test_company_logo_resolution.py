import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import backend.company_logos as company_logos
from backend.latex_generator import _sanitize_resume_for_available_assets


def test_get_all_logos_prefers_cos_over_local(monkeypatch):
    local = [{"key": "tencent", "name": "腾讯", "url": "/api/logos/file/tencent", "keywords": ["腾讯"]}]
    cos = [{"key": "tencent", "name": "腾讯", "url": "https://cos.example.com/tencent.png", "keywords": ["腾讯"]}]

    monkeypatch.setattr(company_logos, "_scan_cos_logos", lambda: cos)
    monkeypatch.setattr(company_logos, "_scan_local_logos", lambda: local)
    company_logos.clear_cache()

    logos = company_logos.get_all_logos_with_urls()

    assert logos == cos


def test_get_logo_cos_url_uses_company_logo_prefix():
    company_logos.clear_cache()
    company_logos._cos_cache = []  # type: ignore[attr-defined]
    company_logos._cos_cache_time = 9999999999  # type: ignore[attr-defined]
    company_logos._cos_key_to_file = {"tencent": "company_logo/腾讯.png"}

    url = company_logos.get_logo_cos_url("tencent")

    assert url == "https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/company_logo/%E8%85%BE%E8%AE%AF.png"


def test_scan_cos_logos_deduplicates_root_objects_when_company_logo_exists(monkeypatch):
    monkeypatch.setenv("COS_SECRET_ID", "x")
    monkeypatch.setenv("COS_SECRET_KEY", "y")
    monkeypatch.setattr(
        company_logos,
        "_list_cos_logo_keys",
        lambda: ["company_logo/腾讯.png", "腾讯.png", "company_logo/字节跳动.png", "字节跳动.png"],
    )
    company_logos.clear_cache()

    logos = company_logos._scan_cos_logos()

    assert len(logos) == 2
    assert [item["key"] for item in logos] == ["tencent", "bytedance"]
    assert all("/company_logo/" in item["url"] for item in logos)


def test_download_logos_falls_back_to_local_when_cos_download_fails(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
      local_src = Path(tmp) / "腾讯.png"
      local_src.write_bytes(b"fake-logo")

      monkeypatch.setattr(company_logos, "get_logo_cos_url", lambda key: "https://cos.example.com/tencent.png")
      monkeypatch.setattr(company_logos, "get_logo_local_path", lambda key: local_src if key == "tencent" else None)

      def _raise(*args, **kwargs):
          raise RuntimeError("cos down")

      monkeypatch.setattr(company_logos.urllib.request, "urlretrieve", _raise)

      logo_map = company_logos.download_logos_to_dir([{"logo": "tencent"}], tmp)
      out = Path(tmp) / "logos" / "logo_0.png"

      assert logo_map == {0: "logo_0.png"}
      assert out.exists()
      assert out.read_bytes() == b"fake-logo"


def test_sanitize_resume_removes_missing_company_logos():
    resume = {
        "internships": [
            {"logo": "tencent", "title": "腾讯"},
            {"title": "字节跳动"},
        ],
        "education": [
            {"logo": "北京大学", "title": "北京大学"},
        ],
    }

    sanitized = _sanitize_resume_for_available_assets(
        resume,
        logo_map={},
        school_logo_map={0: "school_logo_0.png"},
    )

    assert "logo" not in sanitized["internships"][0]
    assert "logoSize" not in sanitized["internships"][0]
    assert sanitized["education"][0]["logo"] == "北京大学"
