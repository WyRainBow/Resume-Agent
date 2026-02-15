from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


# Disallow shell metacharacters to prevent injection. We only run argv with shell=False.
_FORBIDDEN_RAW_CHARS_RE = re.compile(r"[;|&><$()`\n\r]")

# Remove ANSI escape sequences from logs/command output for stable rendering in UI.
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")

# Keep allowlist small by default. Extend carefully.
_ALLOWLIST_CMDS = {
    "pm2",
    "journalctl",
    "ss",
    "ps",
    "df",
    "du",
    "free",
    "uptime",
    "cat",
    "grep",
    "tail",
    "head",
    "ls",
}

# Extra deny patterns beyond allowlist. (Defense in depth)
_DENY_SUBSTRINGS = [
    "mkfs",
    "dd",
    "chmod",
    "chown",
    "useradd",
    "usermod",
    "iptables",
    "firewall-cmd",
    "systemctl stop",
    "systemctl disable",
]


def _strip_ansi(s: str) -> str:
    return _ANSI_RE.sub("", s or "")


def _truncate_utf8(s: str, max_bytes: int) -> str:
    if max_bytes <= 0:
        return ""
    b = (s or "").encode("utf-8", errors="ignore")
    if len(b) <= max_bytes:
        return s or ""
    cut = b[:max_bytes]
    return cut.decode("utf-8", errors="ignore") + "\n[truncated]\n"


def repo_root() -> Path:
    # backend/services/runtime_ops.py -> backend/services -> backend -> repo root
    return Path(__file__).resolve().parents[2]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_argv(
    argv: list[str],
    *,
    timeout_sec: int,
    cwd: Path | None = None,
    max_output_bytes: int = 200_000,
) -> tuple[int, str, str, int]:
    t0 = time.perf_counter()
    try:
        p = subprocess.run(
            argv,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )
        duration_ms = int((time.perf_counter() - t0) * 1000)
        stdout = _truncate_utf8(_strip_ansi(p.stdout or ""), max_output_bytes)
        stderr = _truncate_utf8(_strip_ansi(p.stderr or ""), max_output_bytes)
        return int(p.returncode), stdout, stderr, duration_ms
    except subprocess.TimeoutExpired as exc:
        duration_ms = int((time.perf_counter() - t0) * 1000)
        stdout = _truncate_utf8(_strip_ansi((exc.stdout or "").decode("utf-8", "ignore") if isinstance(exc.stdout, bytes) else (exc.stdout or "")), max_output_bytes)
        stderr = _truncate_utf8(_strip_ansi((exc.stderr or "").decode("utf-8", "ignore") if isinstance(exc.stderr, bytes) else (exc.stderr or "")), max_output_bytes)
        stderr = (stderr + "\n[timeout]\n").lstrip()
        return 124, stdout, stderr, duration_ms


def get_git_info(root: Path) -> dict[str, Any]:
    if not (root / ".git").exists():
        return {"available": False}
    rc1, out1, _, _ = _run_argv(["git", "rev-parse", "HEAD"], timeout_sec=8, cwd=root)
    rc2, out2, _, _ = _run_argv(["git", "rev-parse", "--abbrev-ref", "HEAD"], timeout_sec=8, cwd=root)
    rc3, out3, _, _ = _run_argv(["git", "status", "--porcelain"], timeout_sec=8, cwd=root)
    if rc1 != 0:
        return {"available": False}
    return {
        "available": True,
        "commit": out1.strip(),
        "branch": out2.strip() if rc2 == 0 else "",
        "dirty": bool(out3.strip()) if rc3 == 0 else None,
    }


def pm2_home() -> Path:
    raw = os.getenv("PM2_HOME")
    if raw:
        return Path(raw).expanduser()
    return Path.home() / ".pm2"


def pm2_log_paths(service_name: str) -> dict[str, Any]:
    base = pm2_home() / "logs"
    out_path = base / f"{service_name}-out.log"
    err_path = base / f"{service_name}-error.log"
    return {
        "pm2_home": str(pm2_home()),
        "out_path": str(out_path),
        "error_path": str(err_path),
        "out_exists": out_path.exists(),
        "error_exists": err_path.exists(),
    }


def pm2_jlist(timeout_sec: int = 8) -> list[dict[str, Any]]:
    if not shutil.which("pm2"):
        raise RuntimeError("pm2 not found in PATH")
    rc, out, err, _ = _run_argv(["pm2", "jlist"], timeout_sec=timeout_sec)
    if rc != 0:
        raise RuntimeError(f"pm2 jlist failed: {err.strip()}")
    data = json.loads(out or "[]")
    if not isinstance(data, list):
        return []
    return [x for x in data if isinstance(x, dict)]


def find_pm2_process(jlist: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    for p in jlist:
        if p.get("name") == name:
            return p
    return None


def pm2_process_summary(proc: dict[str, Any]) -> dict[str, Any]:
    env = proc.get("pm2_env") or {}
    monit = proc.get("monit") or {}
    return {
        "name": proc.get("name"),
        "pid": proc.get("pid"),
        "status": env.get("status"),
        "restart_time": env.get("restart_time"),
        "pm_uptime": env.get("pm_uptime"),
        "memory_bytes": monit.get("memory"),
        "cpu_percent": monit.get("cpu"),
        "exec_cwd": env.get("pm_cwd"),
        "node_env": env.get("env", {}).get("NODE_ENV") if isinstance(env.get("env"), dict) else None,
    }


def tail_file(path: str, *, lines: int = 200, max_bytes: int = 512_000) -> str:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    if lines <= 0:
        return ""

    # Read a window from the end; then splitlines and keep tail.
    size = p.stat().st_size
    read_size = min(size, max_bytes)
    with p.open("rb") as f:
        if read_size < size:
            f.seek(size - read_size)
        chunk = f.read(read_size)
    text = chunk.decode("utf-8", errors="ignore")
    text = _strip_ansi(text)
    parts = text.splitlines()
    return "\n".join(parts[-lines:]) + ("\n" if parts else "")


@dataclass(frozen=True)
class DBCheck:
    ok: bool
    dialect: str
    latency_ms: float | None = None
    error: str | None = None


def check_db() -> DBCheck:
    try:
        from database import engine

        dialect = getattr(engine.dialect, "name", "") or ""
        t0 = time.perf_counter()
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        latency_ms = (time.perf_counter() - t0) * 1000
        return DBCheck(ok=True, dialect=dialect, latency_ms=round(latency_ms, 2))
    except Exception as exc:
        return DBCheck(ok=False, dialect="", error=str(exc))


def system_snapshot(root: Path) -> dict[str, Any]:
    snap: dict[str, Any] = {}
    try:
        la = os.getloadavg()
        snap["loadavg"] = {"1m": la[0], "5m": la[1], "15m": la[2]}
    except Exception:
        snap["loadavg"] = None

    try:
        usage = shutil.disk_usage(str(root))
        snap["disk"] = {
            "path": str(root),
            "free_bytes": int(usage.free),
            "total_bytes": int(usage.total),
            "used_bytes": int(usage.used),
        }
    except Exception:
        snap["disk"] = None
    return snap


def get_runtime_status(service_name: str = "resume-backend") -> dict[str, Any]:
    root = repo_root()
    status: dict[str, Any] = {
        "server_time_utc": now_utc_iso(),
        "app_root": str(root),
        "git": get_git_info(root),
        "database": check_db().__dict__,
        "system": system_snapshot(root),
        "service": {"name": service_name},
        "logs": pm2_log_paths(service_name),
    }

    # pm2
    try:
        jlist = pm2_jlist()
        proc = find_pm2_process(jlist, service_name)
        status["pm2"] = {
            "ok": True,
            "count": len(jlist),
            "process": pm2_process_summary(proc) if proc else None,
        }
    except Exception as exc:
        status["pm2"] = {"ok": False, "error": str(exc)}

    # Optional version info (avoid failing status if not available)
    try:
        rc, out, err, _ = _run_argv(["pm2", "-v"], timeout_sec=6)
        status["pm2"]["version"] = out.strip() if rc == 0 else (err.strip() or None)
    except Exception:
        pass

    return status


def _normalize_client_ip(raw: str | None) -> str | None:
    if not raw:
        return None
    # X-Forwarded-For can be a list.
    return raw.split(",")[0].strip() or None


def audit_log_path() -> Path:
    root = repo_root()
    log_dir = Path(os.getenv("LOG_DIR", "logs"))
    if not log_dir.is_absolute():
        log_dir = root / log_dir
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "admin_runtime_history.log"


def append_audit_event(payload: dict[str, Any]) -> None:
    p = audit_log_path()
    line = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    with p.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


class CommandRejected(ValueError):
    pass


def _contains_denied_fragments(command: str, argv: Iterable[str]) -> bool:
    lowered = command.lower()
    if any(x in lowered for x in _DENY_SUBSTRINGS):
        return True
    return any((a or "").lower() in {"rm", "mkfs", "dd"} for a in argv)


def _reject_if_unsafe_raw(command: str) -> None:
    if not command or not command.strip():
        raise CommandRejected("empty command")
    if _FORBIDDEN_RAW_CHARS_RE.search(command):
        raise CommandRejected("forbidden characters in command")


def parse_and_validate_command(command: str) -> list[str]:
    _reject_if_unsafe_raw(command)
    try:
        argv = shlex.split(command, posix=True)
    except ValueError as exc:
        raise CommandRejected(f"invalid command: {exc}") from exc

    if not argv:
        raise CommandRejected("empty command")
    exe = argv[0]
    if exe not in _ALLOWLIST_CMDS:
        raise CommandRejected(f"command not allowed: {exe}")
    if _contains_denied_fragments(command, argv):
        raise CommandRejected("command denied by policy")

    # File-oriented commands are additionally constrained to safe roots to reduce
    # accidental leakage (e.g. /etc, ~/.ssh). Use dedicated endpoints for logs.
    if exe in {"cat", "grep", "tail", "head", "ls", "du"}:
        _validate_file_args(argv)
    return argv


def _safe_path_roots() -> list[Path]:
    roots: list[Path] = []
    roots.append(pm2_home() / "logs")
    try:
        root = repo_root()
        log_dir = Path(os.getenv("LOG_DIR", "logs"))
        if not log_dir.is_absolute():
            log_dir = root / log_dir
        roots.append(log_dir)
    except Exception:
        pass
    # De-dupe
    uniq: list[Path] = []
    for r in roots:
        rr = r.expanduser()
        if rr not in uniq:
            uniq.append(rr)
    return uniq


def _is_under(path: Path, root: Path) -> bool:
    try:
        path_resolved = path.resolve()
        root_resolved = root.resolve()
        return root_resolved in path_resolved.parents or path_resolved == root_resolved
    except Exception:
        return False


def _extract_candidate_paths(argv: list[str]) -> list[str]:
    exe = argv[0]
    # Skip the command itself.
    args = argv[1:]
    out: list[str] = []
    for a in args:
        if not a or a == "-":
            continue
        if a.startswith("-"):
            continue
        # Heuristic: treat strings that look like paths.
        if "/" in a or a.startswith(".") or a.startswith("~"):
            out.append(a)
            continue
        # For ls/du without explicit path, we don't require any.
        if exe in {"ls", "du"}:
            continue
    return out


def _validate_file_args(argv: list[str]) -> None:
    exe = argv[0]
    candidates = _extract_candidate_paths(argv)
    if exe in {"cat", "tail", "head", "grep"} and not candidates:
        raise CommandRejected("file path required for this command")

    roots = _safe_path_roots()
    for raw in candidates:
        p = Path(raw).expanduser()
        # Relative paths are resolved against repo root for predictability.
        if not p.is_absolute():
            p = repo_root() / p
        if not any(_is_under(p, r) for r in roots):
            raise CommandRejected(f"path not allowed: {raw}")


def exec_restricted_command(command: str, *, timeout_sec: int = 30) -> dict[str, Any]:
    argv = parse_and_validate_command(command)
    timeout_sec = int(timeout_sec or 0)
    if timeout_sec <= 0:
        timeout_sec = 30
    timeout_sec = min(timeout_sec, 120)

    rc, out, err, duration_ms = _run_argv(argv, timeout_sec=timeout_sec, max_output_bytes=200_000)
    return {
        "exit_code": rc,
        "stdout": out,
        "stderr": err,
        "duration_ms": duration_ms,
        "argv": argv,
    }
