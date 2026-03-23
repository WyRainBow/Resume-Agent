"""
File-based adapter for session state persistence.
"""

import json
from pathlib import Path
from typing import Any, Dict, Optional


class FileSessionStateStorage:
    def __init__(self, base_dir: str = "data/session_state"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, conversation_id: str) -> Path:
        safe_id = conversation_id.replace("/", "_")
        return self.base_dir / f"{safe_id}.json"

    def save(self, conversation_id: str, state: Dict[str, Any]) -> None:
        path = self._path(conversation_id)
        path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    def load(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        path = self._path(conversation_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def delete(self, conversation_id: str) -> None:
        path = self._path(conversation_id)
        if path.exists():
            path.unlink()
