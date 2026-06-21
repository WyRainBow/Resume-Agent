import os

from backend.core.local_network import ensure_local_no_proxy


def test_ensure_local_no_proxy_merges_entries(monkeypatch):
    monkeypatch.delenv("NO_PROXY", raising=False)
    monkeypatch.delenv("no_proxy", raising=False)
    monkeypatch.setenv("NO_PROXY", "example.com")

    merged = ensure_local_no_proxy()

    assert "example.com" in merged
    assert ".myqcloud.com" in merged
    assert "127.0.0.1" in merged
    assert os.environ["NO_PROXY"] == merged
    assert os.environ["no_proxy"] == merged


def test_ensure_local_no_proxy_deduplicates(monkeypatch):
    monkeypatch.setenv("NO_PROXY", "localhost,.myqcloud.com")

    merged = ensure_local_no_proxy()

    assert merged.count("localhost") == 1
    assert merged.count(".myqcloud.com") == 1