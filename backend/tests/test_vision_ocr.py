import pytest

from backend.services.vision_ocr import resolve_vision_provider
from backend.services import vision_ocr


def test_qwen_routes_to_qwen():
    assert resolve_vision_provider("qwen-vl-max") == "qwen"


def test_glm_ocr_routes_to_zhipu_ocr():
    assert resolve_vision_provider("glm-ocr") == "zhipu_ocr"


def test_unknown_model_raises():
    with pytest.raises(ValueError):
        resolve_vision_provider("gpt-4o")


def test_qwen_vl_ocr_builds_image_payload(monkeypatch):
    captured = {}

    class FakeResp:
        status_code = 200
        text = ""

        def json(self):
            return {"choices": [{"message": {"content": "识别文本"}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, json, headers):
            captured["url"] = url
            captured["json"] = json
            return FakeResp()

    monkeypatch.setattr(vision_ocr, "DASHSCOPE_API_KEY", "test-key")
    monkeypatch.setattr(vision_ocr.httpx, "Client", FakeClient)

    out = vision_ocr.image_to_text(b"\x89PNG", "image/png", "qwen-vl-max")

    assert out == "识别文本"
    content = captured["json"]["messages"][0]["content"]
    assert content[1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert captured["url"].endswith("/chat/completions")
