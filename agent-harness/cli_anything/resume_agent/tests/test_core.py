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


def test_backend_start_dry_run_includes_command() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["backend-start", "--dry-run"])
    assert result.exit_code == 0
    assert "python3 -m uvicorn backend.main:app" in result.output


def test_service_status_json_reports_services() -> None:
    runner = CliRunner()
    result = runner.invoke(main, ["--json", "service-status"])
    assert result.exit_code == 0
    assert '"backend"' in result.output
    assert '"frontend"' in result.output
