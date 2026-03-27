import os
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path


RUN_DIR = Path("/Users/wy770/Resume-Agent/agent-harness/run")


@dataclass(frozen=True)
class ProcessSpec:
    name: str
    command: list[str]
    cwd: str
    pid_file: Path
    log_file: Path


def ensure_run_dir(base_dir: Path | None = None) -> Path:
    run_dir = Path(base_dir) if base_dir else RUN_DIR
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def pid_file_for(name: str, base_dir: Path | None = None) -> Path:
    return ensure_run_dir(base_dir) / f"{name}.pid"


def log_file_for(name: str, base_dir: Path | None = None) -> Path:
    return ensure_run_dir(base_dir) / f"{name}.log"


def read_pid(spec: ProcessSpec) -> int | None:
    if not spec.pid_file.exists():
        return None
    raw = spec.pid_file.read_text(encoding="utf-8").strip()
    return int(raw) if raw else None


def write_pid_file(spec: ProcessSpec, pid: int) -> None:
    ensure_run_dir(spec.pid_file.parent)
    spec.pid_file.write_text(str(pid), encoding="utf-8")


def remove_pid_file(spec: ProcessSpec) -> None:
    if spec.pid_file.exists():
        spec.pid_file.unlink()


def is_process_running(pid: int | None) -> bool:
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def process_status(spec: ProcessSpec) -> dict:
    pid = read_pid(spec)
    running = is_process_running(pid)
    if pid is not None and not running:
        remove_pid_file(spec)
        pid = None
    return {
        "name": spec.name,
        "running": running,
        "pid": pid,
        "pid_file": str(spec.pid_file),
        "log_file": str(spec.log_file),
    }


def start_process(spec: ProcessSpec) -> dict:
    status = process_status(spec)
    if status["running"]:
        return status

    ensure_run_dir(spec.log_file.parent)
    with spec.log_file.open("a", encoding="utf-8") as log_handle:
        proc = subprocess.Popen(
            spec.command,
            cwd=spec.cwd,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    write_pid_file(spec, proc.pid)
    return process_status(spec)


def stop_process(spec: ProcessSpec) -> dict:
    pid = read_pid(spec)
    if pid is None:
        return process_status(spec)

    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        remove_pid_file(spec)
        return process_status(spec)
    except PermissionError:
        os.kill(pid, signal.SIGTERM)

    remove_pid_file(spec)
    return process_status(spec)
