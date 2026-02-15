from __future__ import annotations

from datetime import datetime
from pathlib import Path


HISTORY_PATH = Path(__file__).resolve().parent / "history.log"


def log_event(event: str) -> None:
    ts = datetime.utcnow().isoformat()
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with HISTORY_PATH.open("a", encoding="utf-8") as f:
        f.write(f"{ts} {event}\n")
