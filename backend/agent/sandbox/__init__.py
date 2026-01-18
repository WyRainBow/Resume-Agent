"""
Docker Sandbox Module

Provides secure containerized execution environment with resource limits
and isolation for running untrusted code.
"""
from backend.agent.sandbox.client import (
    BaseSandboxClient,
    LocalSandboxClient,
    create_sandbox_client,
)
from backend.agent.sandbox.core.exceptions import (
    SandboxError,
    SandboxResourceError,
    SandboxTimeoutError,
)
from backend.agent.sandbox.core.manager import SandboxManager
from backend.agent.sandbox.core.sandbox import DockerSandbox


__all__ = [
    "DockerSandbox",
    "SandboxManager",
    "BaseSandboxClient",
    "LocalSandboxClient",
    "create_sandbox_client",
    "SandboxError",
    "SandboxTimeoutError",
    "SandboxResourceError",
]
