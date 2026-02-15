from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List
import os

try:
    import tomllib  # py3.11+
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore


@dataclass(frozen=True)
class RemoteConfig:
    host: str
    port: int
    user: str
    key_path: str
    connect_timeout: int
    command_timeout: int
    allowlist: List[str]
    denylist: List[str]


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "remote.toml"


def _expand_path(path: str) -> str:
    return os.path.expanduser(path)


def load_config(path: str | None = None) -> RemoteConfig:
    cfg_path = Path(path).expanduser() if path else DEFAULT_CONFIG_PATH
    if not cfg_path.exists():
        raise FileNotFoundError(f"Remote config not found: {cfg_path}")

    raw = tomllib.loads(cfg_path.read_text(encoding="utf-8"))

    return RemoteConfig(
        host=str(raw.get("host", "")),
        port=int(raw.get("port", 22)),
        user=str(raw.get("user", "root")),
        key_path=_expand_path(str(raw.get("key_path", "~/.ssh/id_rsa"))),
        connect_timeout=int(raw.get("connect_timeout", 10)),
        command_timeout=int(raw.get("command_timeout", 120)),
        allowlist=list(raw.get("allowlist", [])),
        denylist=list(raw.get("denylist", [])),
    )
