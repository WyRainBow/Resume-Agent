"""
AgentSharedState - session-scoped shared state container.
"""

from threading import RLock
from typing import Any, Dict, Optional


class StateStorage:
    """Optional storage backend for AgentSharedState."""

    def get(self, session_id: str, key: str) -> Any:
        raise NotImplementedError

    def set(self, session_id: str, key: str, value: Any) -> None:
        raise NotImplementedError

    def delete(self, session_id: str, key: str) -> None:
        raise NotImplementedError


class RedisStateStorage(StateStorage):
    """Redis-backed storage (optional)."""

    def __init__(self, url: str):
        try:
            import redis  # type: ignore
        except ImportError as exc:
            raise RuntimeError("redis package is required for RedisStateStorage") from exc

        self._client = redis.Redis.from_url(url)

    def _key(self, session_id: str, key: str) -> str:
        return f"agent_state:{session_id}:{key}"

    def get(self, session_id: str, key: str) -> Any:
        value = self._client.get(self._key(session_id, key))
        return value

    def set(self, session_id: str, key: str, value: Any) -> None:
        self._client.set(self._key(session_id, key), value)

    def delete(self, session_id: str, key: str) -> None:
        self._client.delete(self._key(session_id, key))


class AgentSharedState:
    """Thread-safe shared state for a single conversation/session."""

    def __init__(
        self,
        session_id: str,
        initial: Optional[Dict[str, Any]] = None,
        storage: Optional[StateStorage] = None,
    ):
        self.session_id = session_id
        self._data: Dict[str, Any] = dict(initial or {})
        self._lock = RLock()
        self._storage = storage

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = value
            if self._storage:
                self._storage.set(self.session_id, key, value)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            if key in self._data:
                return self._data.get(key, default)
            if self._storage:
                value = self._storage.get(self.session_id, key)
                if value is not None:
                    self._data[key] = value
                    return value
            return default

    def has(self, key: str) -> bool:
        with self._lock:
            return key in self._data

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._data:
                del self._data[key]
                if self._storage:
                    self._storage.delete(self.session_id, key)
                return True
            return False

    def update(self, data: Dict[str, Any]) -> None:
        with self._lock:
            self._data.update(data)
            if self._storage:
                for key, value in data.items():
                    self._storage.set(self.session_id, key, value)

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._data)
