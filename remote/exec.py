from __future__ import annotations

import argparse
import sys

from remote.client import exec_command
from remote.config import load_config
from remote.history import log_event


def main() -> int:
    parser = argparse.ArgumentParser(description="Execute remote command via SSH")
    parser.add_argument("command", help="Command string to execute")
    parser.add_argument("--config", default=None, help="Path to remote.toml")
    parser.add_argument("--force", action="store_true", help="Bypass allowlist/denylist checks")
    args = parser.parse_args()

    cfg = load_config(args.config)
    result = exec_command(cfg, args.command, force=args.force)

    log_event(f"exec host={cfg.host} user={cfg.user} cmd={args.command!r} exit={result.exit_code}")

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")

    return int(result.exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
