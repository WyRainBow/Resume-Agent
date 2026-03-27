import subprocess
import time

from cli_anything.resume_agent.utils.process_manager import (
    ProcessSpec,
    pid_file_for,
    process_status,
    remove_pid_file,
    write_pid_file,
)


def test_process_status_reports_stopped_when_missing_pid_file(tmp_path) -> None:
    spec = ProcessSpec(
        name="backend",
        command=["python3", "-c", "import time; time.sleep(1)"],
        cwd=str(tmp_path),
        pid_file=tmp_path / "backend.pid",
        log_file=tmp_path / "backend.log",
    )

    status = process_status(spec)

    assert status["running"] is False
    assert status["pid"] is None


def test_process_status_reports_running_process(tmp_path) -> None:
    spec = ProcessSpec(
        name="frontend",
        command=["python3", "-c", "import time; time.sleep(5)"],
        cwd=str(tmp_path),
        pid_file=pid_file_for("frontend", base_dir=tmp_path),
        log_file=tmp_path / "frontend.log",
    )
    proc = subprocess.Popen(spec.command, cwd=spec.cwd)
    try:
        write_pid_file(spec, proc.pid)
        time.sleep(0.1)

        status = process_status(spec)

        assert status["running"] is True
        assert status["pid"] == proc.pid
    finally:
        proc.terminate()
        proc.wait(timeout=5)
        remove_pid_file(spec)
