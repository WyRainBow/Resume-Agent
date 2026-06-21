"""本地开发网络配置：避免国内云服务经系统代理（如 Clash）导致 SSL 失败。"""

from __future__ import annotations

import os

# 直连域名后缀（腾讯云 COS 等），不走 HTTP_PROXY / HTTPS_PROXY
_DEFAULT_NO_PROXY_ENTRIES = (
    "localhost",
    "127.0.0.1",
    ".myqcloud.com",
    ".tencentcos.cn",
    ".volces.com",
    ".bigmodel.cn",
)


def _merge_no_proxy(existing: str, additions: tuple[str, ...]) -> str:
    parts: list[str] = []
    seen: set[str] = set()
    for raw in (existing, *additions):
        for item in raw.split(","):
            entry = item.strip()
            if not entry or entry in seen:
                continue
            seen.add(entry)
            parts.append(entry)
    return ",".join(parts)


def ensure_local_no_proxy(extra_entries: tuple[str, ...] = ()) -> str:
    """
    合并 NO_PROXY / no_proxy，使腾讯云 COS 等国内服务直连。

    在 load_dotenv 之后、发起任何 COS / 本地 API 请求之前调用。
    返回合并后的 NO_PROXY 值。
    """
    merged = _merge_no_proxy(
        os.environ.get("NO_PROXY", os.environ.get("no_proxy", "")),
        (*_DEFAULT_NO_PROXY_ENTRIES, *extra_entries),
    )
    os.environ["NO_PROXY"] = merged
    os.environ["no_proxy"] = merged
    return merged