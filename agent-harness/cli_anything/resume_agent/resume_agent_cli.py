import json
import os
import shlex
import socket
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


def _browser_flow_script() -> str:
    return str(SCRIPT_DIR / "browser-resume-flow.py")


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


def _payload(command: str, resource: str, ok: bool, message: str, details: dict) -> dict:
    return {
        "ok": ok,
        "command": command,
        "resource": resource,
        "message": message,
        "details": details,
    }


def _pid_running(pid: int | None) -> bool:
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _browser_status_details() -> dict:
    pid_file = STATE_DIR / "domshell.pid"
    token_file = STATE_DIR / "domshell.env"
    log_file = STATE_DIR / "domshell.log"
    pid = None
    if pid_file.exists():
        raw = pid_file.read_text(encoding="utf-8").strip()
        pid = int(raw) if raw else None
    pid_running = _pid_running(pid)
    ws_port_ready = _port_in_use(9876)
    http_port_ready = _port_in_use(3001)
    running = pid_running or ws_port_ready or http_port_ready

    return {
        "domshell_running": running,
        "pid_running": pid_running,
        "pid": pid,
        "pid_file": str(pid_file),
        "token_file": str(token_file),
        "token_ready": token_file.exists(),
        "log_file": str(log_file),
        "log_ready": log_file.exists(),
        "ws_port_ready": ws_port_ready,
        "http_port_ready": http_port_ready,
    }


def _ensure_browser_started() -> None:
    details = _browser_status_details()
    if details["ws_port_ready"] and details["http_port_ready"]:
        return
    result = run_command(["bash", _browser_start_script()], cwd=str(ROOT))
    if result.returncode != 0:
        raise click.ClickException(result.stderr.strip() or result.stdout.strip() or "browser-start failed")


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
    payload = _payload(
        command="status",
        resource="workspace",
        ok=frontend_pkg.exists() and backend_main.exists(),
        message="Workspace status",
        details={
            "root": str(ROOT),
            "frontend_package": frontend_pkg.exists(),
            "backend_main": backend_main.exists(),
        },
    )
    _emit(payload)


@main.command("run-backend")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def run_backend(dry_run: bool) -> None:
    cmd = _backend_spec().command
    if dry_run:
        _emit(_payload("run-backend", "backend", True, "Backend command", {"cmd": " ".join(cmd)}))
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("run-backend", "backend", result.returncode == 0, "Backend command executed", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("run-frontend")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def run_frontend(dry_run: bool) -> None:
    spec = _frontend_spec()
    cmd = spec.command
    if dry_run:
        _emit(_payload("run-frontend", "frontend", True, "Frontend command", {"cmd": " ".join(cmd), "cwd": spec.cwd}))
        return
    result = run_command(cmd, cwd=spec.cwd)
    _emit(_payload("run-frontend", "frontend", result.returncode == 0, "Frontend command executed", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("build-frontend")
def build_frontend() -> None:
    result = run_command(["npm", "run", "build"], cwd=str(ROOT / "frontend"))
    _emit(_payload("build-frontend", "frontend", result.returncode == 0, "Frontend build", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("backend-test")
def backend_test() -> None:
    cmd = ["pytest", "backend", "-q"]
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("backend-test", "backend", result.returncode == 0, "Backend tests", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("backend-start")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def backend_start(dry_run: bool) -> None:
    spec = _backend_spec()
    if dry_run:
        _emit(_payload("backend-start", "backend", True, "Backend start command", {"cmd": " ".join(spec.command), "log_file": str(spec.log_file)}))
        return
    status = start_process(spec)
    _emit(_payload("backend-start", "backend", status["running"], "Backend service status", status))


@main.command("backend-stop")
def backend_stop() -> None:
    status = stop_process(_backend_spec())
    _emit(_payload("backend-stop", "backend", True, "Backend stop requested", status))


@main.command("frontend-start")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def frontend_start(dry_run: bool) -> None:
    spec = _frontend_spec()
    if dry_run:
        _emit(_payload("frontend-start", "frontend", True, "Frontend start command", {"cmd": " ".join(spec.command), "log_file": str(spec.log_file)}))
        return
    status = start_process(spec)
    _emit(_payload("frontend-start", "frontend", status["running"], "Frontend service status", status))


@main.command("frontend-stop")
def frontend_stop() -> None:
    status = stop_process(_frontend_spec())
    _emit(_payload("frontend-stop", "frontend", True, "Frontend stop requested", status))


@main.command("service-status")
def service_status() -> None:
    payload = {
        "backend": process_status(_backend_spec()),
        "frontend": process_status(_frontend_spec()),
    }
    _emit(_payload("service-status", "services", True, "Service status", payload))


@main.command("browser-start")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def browser_start(dry_run: bool) -> None:
    cmd = ["bash", _browser_start_script()]
    if dry_run:
        _emit(_payload("browser-start", "browser", True, "Browser start command", {"cmd": " ".join(cmd)}))
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("browser-start", "browser", result.returncode == 0, "Browser start", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        **_browser_status_details(),
    }))


@main.command("browser-stop")
def browser_stop() -> None:
    result = run_command(["bash", _browser_stop_script()], cwd=str(ROOT))
    _emit(_payload("browser-stop", "browser", result.returncode == 0, "Browser stop", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        **_browser_status_details(),
    }))


@main.command("browser-status")
def browser_status() -> None:
    _emit(_payload("browser-status", "browser", True, "Browser status", _browser_status_details()))


@main.command("browser-run", context_settings={"ignore_unknown_options": True})
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
@click.argument("browser_args", nargs=-1, type=click.UNPROCESSED)
def browser_run(dry_run: bool, browser_args: tuple[str, ...]) -> None:
    cmd = ["bash", _browser_run_script(), *browser_args]
    if dry_run:
        _emit(_payload("browser-run", "browser", True, "Browser run command", {"cmd": " ".join(cmd)}))
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("browser-run", "browser", result.returncode == 0, "Browser run", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("browser-open")
@click.argument("url")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def browser_open(url: str, dry_run: bool) -> None:
    cmd = ["bash", _browser_run_script(), "page", "open", url]
    if dry_run:
        _emit(_payload("browser-open", "browser", True, "Browser open command", {"cmd": " ".join(cmd)}))
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("browser-open", "browser", result.returncode == 0, "Browser open", {
        "url": url,
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("browser-session-status")
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def browser_session_status(dry_run: bool) -> None:
    cmd = ["bash", _browser_run_script(), "session", "status"]
    if dry_run:
        _emit(_payload("browser-session-status", "browser", True, "Browser session status command", {"cmd": " ".join(cmd)}))
        return
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("browser-session-status", "browser", result.returncode == 0, "Browser session status", {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


@main.command("browser-flow")
@click.argument("flow")
@click.argument("url", required=False)
@click.option("--dry-run", is_flag=True, help="Show the command without executing")
def browser_flow(flow: str, url: str | None, dry_run: bool) -> None:
    target_url = url or "http://localhost:5173/agent/new"
    cmd = ["uv", "run", "--with", "mcp", "python3", _browser_flow_script(), flow, target_url]
    if dry_run:
        _emit(_payload("browser-flow", "browser", True, "Browser flow command", {"cmd": " ".join(cmd)}))
        return
    _ensure_browser_started()
    result = run_command(cmd, cwd=str(ROOT))
    _emit(_payload("browser-flow", "browser", result.returncode == 0, "Browser flow", {
        "flow": flow,
        "url": target_url,
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }))


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
        "browser-open": browser_open,
        "browser-session-status": browser_session_status,
        "browser-flow": browser_flow,
    }
    while True:
        raw = click.prompt("resume-agent>", prompt_suffix=" ", default="", show_default=False)
        line = raw.strip()
        if not line:
            continue
        if line in {"exit", "quit"}:
            break
        if line == "help":
            click.echo("Available commands: status, service-status, browser-status, browser-open [--dry-run] <url>, browser-session-status [--dry-run], browser-flow [--dry-run] <flow> [url], run-backend [--dry-run], run-frontend [--dry-run], backend-start [--dry-run], backend-stop, frontend-start [--dry-run], frontend-stop, browser-start [--dry-run], browser-stop, build-frontend, backend-test")
            continue

        parts = shlex.split(line)
        name = parts[0]
        cmd_fn = commands.get(name)
        if not cmd_fn:
            click.echo(f"Unknown command: {name}")
            continue

        if name in {"run-backend", "run-frontend", "backend-start", "frontend-start", "browser-start", "browser-session-status"}:
            dry_run = "--dry-run" in parts[1:]
            cmd_fn.callback(dry_run=dry_run)
        elif name == "browser-open":
            dry_run = "--dry-run" in parts[1:]
            url = next((part for part in parts[1:] if part != "--dry-run"), "")
            cmd_fn.callback(url=url, dry_run=dry_run)
        elif name == "browser-flow":
            dry_run = "--dry-run" in parts[1:]
            values = [part for part in parts[1:] if part != "--dry-run"]
            flow = values[0] if values else ""
            url = values[1] if len(values) > 1 else None
            cmd_fn.callback(flow=flow, url=url, dry_run=dry_run)
        else:
            cmd_fn.callback()


if __name__ == "__main__":
    main()
