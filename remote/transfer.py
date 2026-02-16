from __future__ import annotations

import argparse
from pathlib import Path

from remote.client import get_sftp, ensure_remote_dir
from remote.config import load_config
from remote.history import log_event


def upload(local_path: str, remote_path: str, config_path: str | None) -> None:
    cfg = load_config(config_path)
    client, sftp = get_sftp(cfg)
    try:
        local = Path(local_path).expanduser()
        ensure_remote_dir(sftp, str(Path(remote_path).parent))
        sftp.put(str(local), remote_path)
        log_event(f"upload host={cfg.host} user={cfg.user} local={local} remote={remote_path}")
    finally:
        sftp.close()
        client.close()


def download(remote_path: str, local_path: str, config_path: str | None) -> None:
    cfg = load_config(config_path)
    client, sftp = get_sftp(cfg)
    try:
        local = Path(local_path).expanduser()
        local.parent.mkdir(parents=True, exist_ok=True)
        sftp.get(remote_path, str(local))
        log_event(f"download host={cfg.host} user={cfg.user} remote={remote_path} local={local}")
    finally:
        sftp.close()
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload/download files via SFTP")
    sub = parser.add_subparsers(dest="action", required=True)

    up = sub.add_parser("upload")
    up.add_argument("--local", required=True)
    up.add_argument("--remote", required=True)
    up.add_argument("--config", default=None)

    down = sub.add_parser("download")
    down.add_argument("--remote", required=True)
    down.add_argument("--local", required=True)
    down.add_argument("--config", default=None)

    args = parser.parse_args()

    if args.action == "upload":
        upload(args.local, args.remote, args.config)
    else:
        download(args.remote, args.local, args.config)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
