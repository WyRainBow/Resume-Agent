from __future__ import annotations

import argparse

from remote.transfer import upload


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload file via SFTP")
    parser.add_argument("--local", required=True)
    parser.add_argument("--remote", required=True)
    parser.add_argument("--config", default=None)
    args = parser.parse_args()

    upload(args.local, args.remote, args.config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
