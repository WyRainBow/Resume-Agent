from __future__ import annotations

import argparse

from remote.transfer import download


def main() -> int:
    parser = argparse.ArgumentParser(description="Download file via SFTP")
    parser.add_argument("--remote", required=True)
    parser.add_argument("--local", required=True)
    parser.add_argument("--config", default=None)
    args = parser.parse_args()

    download(args.remote, args.local, args.config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
