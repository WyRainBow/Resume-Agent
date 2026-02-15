from __future__ import annotations

import argparse

from remote.client import exec_command
from remote.config import load_config
from remote.history import log_event


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch remote logs")
    parser.add_argument("--config", default=None, help="Path to remote.toml")
    parser.add_argument("--service", default="", help="PM2 service name")
    parser.add_argument("--lines", type=int, default=200, help="Number of lines")
    parser.add_argument("--file", default="", help="Log file path to tail")
    parser.add_argument("--journal", default="", help="Journalctl unit name")
    parser.add_argument("--force", action="store_true", help="Bypass allowlist/denylist checks")
    args = parser.parse_args()

    cfg = load_config(args.config)

    if args.service:
        cmd = f"pm2 logs {args.service} --lines {args.lines}"
        label = f"pm2:{args.service}"
    elif args.journal:
        cmd = f"journalctl -u {args.journal} -n {args.lines} --no-pager"
        label = f"journal:{args.journal}"
    elif args.file:
        cmd = f"tail -n {args.lines} {args.file}"
        label = f"file:{args.file}"
    else:
        raise SystemExit("Specify --service, --journal, or --file")

    result = exec_command(cfg, cmd, force=args.force)
    log_event(f"logs host={cfg.host} user={cfg.user} target={label} exit={result.exit_code}")

    print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="")

    return int(result.exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
