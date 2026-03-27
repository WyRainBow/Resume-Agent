import subprocess
from dataclasses import dataclass


@dataclass
class CmdResult:
    returncode: int
    stdout: str
    stderr: str


def run_command(cmd: list[str], cwd: str) -> CmdResult:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return CmdResult(returncode=proc.returncode, stdout=proc.stdout, stderr=proc.stderr)
