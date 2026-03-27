import json
import shlex
from pathlib import Path

import click

from cli_anything.resume_agent.core.session import STATE
from cli_anything.resume_agent.utils.process_manager import (
    ProcessSpec,
    log_file_for,
    pid_file_for,
    process_status,
    start_process,
    stop_process,
)
from cli_anything.resume_agent.utils.runner import run_command


ROOT = Path("/Users/wy770/Resume-Agent")
RUN_DIR = ROOT / "agent-harness" / "run"
SCRIPT_DIR = ROOT / "scripts"
STATE_DIR = ROOT / ".browser-fast"


def _browser_start_script() -> str:
    return str(SCRIPT_DIR / "browser-fast-start.sh")


def _browser_stop_script() -> str:
    return str(SCRIPT_DIR / "browser-fast-stop.sh")


def _browser_run_script() -> str:
    return str(SCRIPT_DIR / "browser-fast.sh")


def _backend_spec() -> ProcessSpec:
    return ProcessSpec(
        name="backend",
        command=[
            "python3",
            "-m",
            "uvicorn",
            "backend.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "9000",
        ],
        cwd=str(ROOT),
        pid_file=pid_file_for("backend", base_dir=RUN_DIR),
        log_file=log_file_for("backend", base_dir=RUN_DIR),
    )


def _frontend_spec() -> ProcessSpec:
    return ProcessSpec(
        name="frontend",
        command=["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
        cwd=str(ROOT / "frontend"),
        pid_file=pid_file_for("frontend", base_dir=RUN_DIR),
        log_file=log_file_for("frontend", base_dir=RUN_DIR),
    )


def _emit(payload: dict) -> None:
    if STATE.json_output:
        click.echo(json.dumps(payload, ensure_ascii=False))
        return
    msg = payload.get("message")
    if msg:
        click.echo(msg)
    details = payload.get("details") or {}
    for key, value in details.items():
        click.echo(f"- {key}: {value}")


def _browser_status_details() -> dict:
    pid_file = STATE_DIR / "domshell.pid"
    token_file = STATE_DIR / "domshell.env"
    log_file = STATE_DIR / "domshell.log"
    pid = None
    running = False
    if pid_file.exists():
        raw = pid_file.read_text(encoding="utf-8").strip()
        pid = int(raw) if raw else None
        if pid is not None:
            try:
                import os

                os.kill(pid, 0)
                running = True
            except ProcessLookupError:
                running = False
            except PermissionError:
                running = True

    return {
        "domshell_running": running,
        "pid": pid,
        "pid_file": str(pid_file),
        "token_file": str(token_file),
        "token_ready": token_file.exists(),
        "log_file": str(log_file),
        "log_ready": log_file.exists(),
    }


@click.group(invoke_without_command=True)
@click.option("--json", "json_output", is_flag=True, help="Output machine-readable JSON")
@click.pass_context
def main(ctx: click.Context, json_output: bool) -> None:
    """CLI harness for Resume-Agent operations."""
    STATE.json_output = json_output
    if ctx.invoked_subcommand is None:
        repl()


@main.command("status")
def status_cmd() -> None:
    frontend_pkg = ROOT / "frontend" / "package.json"
    backend_main = ROOT / "backend" / "main.py"
    payload = {
        "ok": frontend_pkg.exists() and backend_main.exists(),
        "message": "Workspace status",
        "details": {
            "root": str(ROOT),
            "frontend_package": frontend_pkg.exists(),
            "backend_main": backend_main.exists(),
        },
    }
    _emit(payload)


@main.command("run-backend")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def run_backend(dry_run: bool) -> None:
    cmd = _backend_spec().command
    if dry_run:
        _emit({"ok": True, "message": "Backend command", "details": {"cmd": " ".join(cmd)}})
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Backend command executed",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            },
        }
    )


@main.command("run-frontend")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def run_frontend(dry_run: bool) -> None:
    spec = _frontend_spec()
    cmd = spec.command
    if dry_run:
        _emit({"ok": True, "message": "Frontend command", "details": {"cmd": " ".join(cmd), "cwd": spec.cwd}})
        return
    result = run_command(cmd, cwd=spec.cwd)
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Frontend command executed",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            },
        }
    )


@main.command("build-frontend")
def build_frontend() -> None:
    result = run_command(["npm", "run", "build"], cwd=str(ROOT / "frontend"))
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Frontend build",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            },
        }
    )


@main.command("backend-test")
def backend_test() -> None:
    cmd = ["pytest", "backend", "-q"]
    result = run_command(cmd, cwd=str(ROOT))
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Backend tests",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            },
        }
    )


@main.command("backend-start")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def backend_start(dry_run: bool) -> None:
    spec = _backend_spec()
    if dry_run:
        _emit({"ok": True, "message": "Backend start command", "details": {"cmd": " ".join(spec.command), "log_file": str(spec.log_file)}})
        return
    status = start_process(spec)
    _emit({"ok": status["running"], "message": "Backend service status", "details": status})


@main.command("backend-stop")
def backend_stop() -> None:
    status = stop_process(_backend_spec())
    _emit({"ok": True, "message": "Backend stop requested", "details": status})


@main.command("frontend-start")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def frontend_start(dry_run: bool) -> None:
    spec = _frontend_spec()
    if dry_run:
        _emit({"ok": True, "message": "Frontend start command", "details": {"cmd": " ".join(spec.command), "log_file": str(spec.log_file)}})
        return
    status = start_process(spec)
    _emit({"ok": status["running"], "message": "Frontend service status", "details": status})


@main.command("frontend-stop")
def frontend_stop() -> None:
    status = stop_process(_frontend_spec())
    _emit({"ok": True, "message": "Frontend stop requested", "details": status})


@main.command("service-status")
def service_status() -> None:
    payload = {
        "backend": process_status(_backend_spec()),
        "frontend": process_status(_frontend_spec()),
    }
    _emit({"ok": True, "message": "Service status", "details": payload})


@main.command("browser-start")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def browser_start(dry_run: bool) -> None:
    cmd = ["bash", _browser_start_script()]
    if dry_run:
        _emit({"ok": True, "message": "Browser start command", "details": {"cmd": " ".join(cmd)}})
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Browser start",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                **_browser_status_details(),
            },
        }
    )


@main.command("browser-stop")
def browser_stop() -> None:
    result = run_command(["bash", _browser_stop_script()], cwd=str(ROOT))
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Browser stop",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                **_browser_status_details(),
            },
        }
    )


@main.command("browser-status")
def browser_status() -> None:
    _emit({"ok": True, "message": "Browser status", "details": _browser_status_details()})


@main.command("browser-run", context_settings={"ignore_unknown_options": True})
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
@click.argument("browser_args", nargs=-1, type=click.UNPROCESSED)
def browser_run(dry_run: bool, browser_args: tuple[str, ...]) -> None:
    cmd = ["bash", _browser_run_script(), *browser_args]
    if dry_run:
        _emit({"ok": True, "message": "Browser run command", "details": {"cmd": " ".join(cmd)}})
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(
        {
            "ok": result.returncode == 0,
            "message": "Browser run",
            "details": {
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            },
        }
    )


def repl() -> None:
    click.echo("Resume-Agent REPL. Type 'help' for commands, 'exit' to quit.")
    commands = {
        "status": status_cmd,
        "run-backend": run_backend,
        "run-frontend": run_frontend,
        "build-frontend": build_frontend,
        "backend-test": backend_test,
        "backend-start": backend_start,
        "backend-stop": backend_stop,
        "frontend-start": frontend_start,
        "frontend-stop": frontend_stop,
        "service-status": service_status,
        "browser-start": browser_start,
        "browser-stop": browser_stop,
        "browser-status": browser_status,
    }
    while True:
        raw = click.prompt("resume-agent>", prompt_suffix=" ", default="", show_default=False)
        line = raw.strip()
        if not line:
            continue
        if line in {"exit", "quit"}:
            break
        if line == "help":
            click.echo("Available commands: status, service-status, browser-status, run-backend [--dry-run], run-frontend [--dry-run], backend-start [--dry-run], backend-stop, frontend-start [--dry-run], frontend-stop, browser-start [--dry-run], browser-stop, build-frontend, backend-test")
            continue

        parts = shlex.split(line)
        name = parts[0]
        cmd_fn = commands.get(name)
        if not cmd_fn:
            click.echo(f"Unknown command: {name}")
            continue

        if name in {"run-backend", "run-frontend", "backend-start", "frontend-start", "browser-start"}:
            dry_run = "--dry-run" in parts[1:]
            cmd_fn.callback(dry_run=dry_run)
        else:
            cmd_fn.callback()


if __name__ == "__main__":
    main()
