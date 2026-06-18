"""针对 /api/resume/jd-keyword-integrate 的三路测试（golden / 边界 / 错误）。

通过 monkeypatch backend.routes.resume.call_llm 避免真实 LLM 调用与 API Key 依赖。
"""
import json

import pytest
from fastapi.testclient import TestClient

from backend.main import app
import backend.routes.resume as resume_routes

client = TestClient(app)

URL = "/api/resume/jd-keyword-integrate"
FIELDS = [
    {
        "key": "experience:1",
        "label": "实习经历",
        "content": "负责后端接口开发，完成订单模块，接口响应时间下降 30%。",
    }
]


def _patch_llm(monkeypatch, payload):
    monkeypatch.setattr(resume_routes, "call_llm", lambda provider, prompt: json.dumps(payload))


def test_golden_integrate(monkeypatch):
    """LLM 返回的 original 逐字命中字段内容 → integrated True，原样回传可替换片段。"""
    _patch_llm(monkeypatch, {
        "key": "experience:1",
        "original": "负责后端接口开发，完成订单模块",
        "suggested": "基于 Kubernetes 负责后端接口开发，完成订单模块",
        "reason": "融入容器编排关键词",
    })
    res = client.post(URL, json={"keyword": "Kubernetes", "jd_text": "需要 Kubernetes 经验", "fields": FIELDS})
    assert res.status_code == 200
    data = res.json()
    assert data["integrated"] is True
    assert data["keyword"] == "Kubernetes"
    assert data["key"] == "experience:1"
    assert data["original"] in FIELDS[0]["content"]
    assert data["suggested"] != data["original"]


def test_original_not_in_field(monkeypatch):
    """LLM 编造了字段里不存在的 original → integrated False（系统边界校验）。"""
    _patch_llm(monkeypatch, {
        "key": "experience:1",
        "original": "这段文字根本不在简历里",
        "suggested": "随便改写",
        "reason": "x",
    })
    res = client.post(URL, json={"keyword": "Redis", "fields": FIELDS})
    assert res.status_code == 200
    assert res.json() == {"integrated": False, "keyword": "Redis"}


def test_empty_object_means_not_integrated(monkeypatch):
    """LLM 判断无法自然融入返回 {} → integrated False。"""
    _patch_llm(monkeypatch, {})
    res = client.post(URL, json={"keyword": "区块链", "fields": FIELDS})
    assert res.status_code == 200
    assert res.json()["integrated"] is False


def test_empty_keyword_rejected():
    res = client.post(URL, json={"keyword": "  ", "fields": FIELDS})
    assert res.status_code == 400


def test_no_field_content_rejected():
    res = client.post(URL, json={"keyword": "Go", "fields": [{"key": "x", "label": "y", "content": "   "}]})
    assert res.status_code == 400
