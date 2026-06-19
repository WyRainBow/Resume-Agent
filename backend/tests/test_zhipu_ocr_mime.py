import httpx

from backend.services import zhipu_layout


def test_recognize_with_ocr_uses_image_mime(monkeypatch):
    captured = {}

    class FakeResp:
        status_code = 200

        def json(self):
            return {"md_results": "OCR文本"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, json, headers):
            captured["file"] = json["file"]
            return FakeResp()

    monkeypatch.setattr(zhipu_layout, "ZHIPU_API_KEY", "test-key")
    # recognize_with_ocr 内部是局部 import httpx，故 patch 真实 httpx.Client
    monkeypatch.setattr(httpx, "Client", FakeClient)

    out = zhipu_layout.recognize_with_ocr(b"\x89PNG", mime="image/png")

    assert out == "OCR文本"
    assert captured["file"].startswith("data:image/png;base64,")
