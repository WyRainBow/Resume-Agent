from click.testing import CliRunner

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
