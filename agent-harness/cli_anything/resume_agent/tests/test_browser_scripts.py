from pathlib import Path


SCRIPT = Path("/Users/wy770/Resume-Agent/scripts/browser-fast-start.sh")


def test_browser_fast_start_uses_explicit_token_and_write_flags() -> None:
    content = SCRIPT.read_text(encoding="utf-8")

    assert "--allow-write" in content
    assert "--no-confirm" in content
    assert "--token" in content
