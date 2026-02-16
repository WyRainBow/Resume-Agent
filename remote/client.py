from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

import paramiko

from remote.config import RemoteConfig


@dataclass
class CommandResult:
    stdout: str
    stderr: str
    exit_code: int


def _ensure_key_path(key_path: str) -> None:
    path = Path(key_path)
    if not path.exists():
        raise FileNotFoundError(f"SSH key not found: {key_path}")


def _is_allowed(command: str, cfg: RemoteConfig) -> Tuple[bool, str]:
    for banned in cfg.denylist:
        if banned and banned in command:
            return False, f"Command contains denylist pattern: {banned}"

    if not cfg.allowlist:
        return True, ""

    cmd_name = command.strip().split()[0] if command.strip() else ""
    if cmd_name in cfg.allowlist:
        return True, ""
    return False, f"Command not in allowlist: {cmd_name}"


def connect(cfg: RemoteConfig) -> paramiko.SSHClient:
    _ensure_key_path(cfg.key_path)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=cfg.host,
        port=cfg.port,
        username=cfg.user,
        key_filename=cfg.key_path,
        timeout=cfg.connect_timeout,
        banner_timeout=cfg.connect_timeout,
        auth_timeout=cfg.connect_timeout,
        look_for_keys=False,
        allow_agent=False,
    )
    return client


def exec_command(cfg: RemoteConfig, command: str, force: bool = False) -> CommandResult:
    allowed, reason = _is_allowed(command, cfg)
    if not allowed and not force:
        raise PermissionError(reason)

    client = connect(cfg)
    try:
        stdin, stdout, stderr = client.exec_command(command)
        channel = stdout.channel
        start = time.time()
        out_chunks = []
        err_chunks = []

        while not channel.exit_status_ready():
            if channel.recv_ready():
                out_chunks.append(channel.recv(4096).decode("utf-8", errors="ignore"))
            if channel.recv_stderr_ready():
                err_chunks.append(channel.recv_stderr(4096).decode("utf-8", errors="ignore"))
            if time.time() - start > cfg.command_timeout:
                channel.close()
                raise TimeoutError(f"Command timeout after {cfg.command_timeout}s")
            time.sleep(0.05)

        # flush any remaining output
        while channel.recv_ready():
            out_chunks.append(channel.recv(4096).decode("utf-8", errors="ignore"))
        while channel.recv_stderr_ready():
            err_chunks.append(channel.recv_stderr(4096).decode("utf-8", errors="ignore"))

        exit_code = channel.recv_exit_status()
        return CommandResult("".join(out_chunks), "".join(err_chunks), exit_code)
    finally:
        client.close()


def get_sftp(cfg: RemoteConfig) -> Tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    client = connect(cfg)
    sftp = client.open_sftp()
    return client, sftp


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    parts = Path(remote_dir).parts
    current = ""
    for part in parts:
        current = f"{current}/{part}" if current else part
        try:
            sftp.listdir(current)
        except IOError:
            sftp.mkdir(current)
