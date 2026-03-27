from pathlib import Path

from click.testing import CliRunner

import cli_anything.resume_agent.resume_agent_cli as cli_mod

from cli_anything.resume_agent.resume_agent_cli import main


def test_status_command_runs() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["status"])
    assert result.exit_code == 0
    assert "Workspace status" in result.output


def test_status_command_json_mode() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["--json", "status"])
    assert result.exit_code == 0
    assert '"ok":' in result.output
    assert '"command": "status"' in result.output
    assert '"resource": "workspace"' in result.output


def test_backend_start_dry_run_includes_command() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["backend-start", "--dry-run"])
    assert result.exit_code == 0
    assert "python3 -m uvicorn backend.main:app" in result.output


def test_service_status_json_reports_services() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["--json", "service-status"])
    assert result.exit_code == 0
    assert '"command": "service-status"' in result.output
    assert '"resource": "services"' in result.output
    assert '"backend"' in result.output
    assert '"frontend"' in result.output


def test_browser_start_dry_run_includes_script() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["browser-start", "--dry-run"])
    assert result.exit_code == 0
    assert "scripts/browser-fast-start.sh" in result.output


def test_browser_status_json_reports_browser_state() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["--json", "browser-status"])
    assert result.exit_code == 0
    assert '"command": "browser-status"' in result.output
    assert '"resource": "browser"' in result.output
    assert '"domshell_running"' in result.output
    assert '"token_file"' in result.output


def test_browser_open_dry_run_includes_page_open() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["browser-open", "https://example.com", "--dry-run"])
    assert result.exit_code == 0
    assert "page open https://example.com" in result.output


def test_browser_session_status_dry_run_targets_session_status() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["browser-session-status", "--dry-run"])
    assert result.exit_code == 0
    assert "session status" in result.output


def test_browser_flow_resume_diagnosis_dry_run_targets_flow_script() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["browser-flow", "resume-diagnosis", "--dry-run"])
    assert result.exit_code == 0
    assert "browser-resume-flow.py" in result.output
    assert "resume-diagnosis" in result.output


def test_browser_status_prefers_open_ports_when_pid_is_stale(monkeypatch, tmp_path: Path) -> None:
    state_dir = tmp_path / "browser-state"
    state_dir.mkdir()
    (state_dir / "domshell.pid").write_text("12345", encoding="utf-8")
    (state_dir / "domshell.env").write_text("export DOMSHELL_TOKEN=test", encoding="utf-8")
    (state_dir / "domshell.log").write_text("ready", encoding="utf-8")

    monkeypatch.setattr(cli_mod, "STATE_DIR", state_dir)
    monkeypatch.setattr(cli_mod, "_pid_running", lambda pid: False)
    monkeypatch.setattr(cli_mod, "_port_in_use", lambda port: port == 9876)

    details = cli_mod._browser_status_details()

    assert details["pid"] == 12345
    assert details["domshell_running"] is True
    assert details["ws_port_ready"] is True
    assert details["http_port_ready"] is False
