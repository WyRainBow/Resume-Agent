from __future__ import annotations

from remote.client import exec_command
from remote.config import load_config
from remote.history import log_event


def main() -> int:
    cfg = load_config(None)
    cmd = "uname -a && uptime"
    result = exec_command(cfg, cmd, force=True)
    log_event(f"health host={cfg.host} user={cfg.user} exit={result.exit_code}")
    print(result.stdout, end="")
    return int(result.exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
