from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

import httpx


class JDFetchError(RuntimeError):
    pass


@dataclass(frozen=True)
class JDFetchResult:
    url: str
    title: str
    raw_text: str


def _format_crawler_error(exc: Exception) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    if "Executable doesn't exist" in message or "playwright install" in message:
        return (
            "岗位链接抓取失败：服务端缺少 Playwright 浏览器可执行文件。"
            "请先执行 `playwright install chromium`，或改为粘贴 JD 文本。"
        )
    return f"岗位链接抓取失败：{message}。请改为粘贴 JD 文本。"


def _extract_honor_context(url: str) -> tuple[str, str] | None:
    parsed = urlparse(url)
    if parsed.netloc != "career.honor.com":
        return None
    path_parts = [part for part in parsed.path.split("/") if part]
    if len(path_parts) < 3 or path_parts[1] != "mc" or path_parts[2] != "detail":
        return None
    suite_id = path_parts[0].strip()
    post_id = (parse_qs(parsed.query).get("postId") or [""])[0].strip()
    if not suite_id or not post_id:
        return None
    return suite_id, post_id


def _build_honor_raw_text(detail: dict) -> str:
    sections = [
        f"岗位名称：{detail.get('postName', '')}".strip(),
        f"所属组织：{detail.get('orgName') or detail.get('company') or ''}".strip(),
        f"招聘项目：{detail.get('projectName', '')}".strip(),
        f"岗位类型：{detail.get('workTypeStr', '')}".strip(),
        f"岗位类别：{detail.get('postTypeName', '')}".strip(),
        f"工作地点：{detail.get('workPlaceStr', '')}".strip(),
        f"学历要求：{detail.get('education', '')}".strip(),
        f"岗位编号：{detail.get('postCode', '')}".strip(),
        f"发布时间：{detail.get('publishDate', '')}".strip(),
        f"截止时间：{detail.get('endDate', '')}".strip(),
        "",
        "岗位职责：",
        str(detail.get("workContent") or "").strip(),
        "",
        "任职要求：",
        str(detail.get("serviceCondition") or "").strip(),
    ]
    return "\n".join(line for line in sections if line)


async def _fetch_honor_job_description(url: str, timeout_seconds: int) -> JDFetchResult | None:
    context = _extract_honor_context(url)
    if context is None:
        return None

    suite_id, post_id = context
    api_url = f"https://career.honor.com/wecruit/positionInfo/listPositionDetail/{suite_id}"
    params = {
        "iSaJAx": "isAjax",
        "request_locale": "zh_CN",
        "postId": post_id,
    }
    headers = {
        "Referer": url,
        "User-Agent": "Mozilla/5.0",
    }
    async with httpx.AsyncClient(
        timeout=timeout_seconds,
        follow_redirects=True,
        trust_env=False,
    ) as client:
        response = await client.get(api_url, params=params, headers=headers)
    response.raise_for_status()

    payload = response.json()
    detail = payload.get("data") or {}
    if str(payload.get("state")) != "200" or not detail:
        raise JDFetchError("岗位链接抓取失败：Honor 岗位详情接口未返回有效数据。请改为粘贴 JD 文本。")

    raw_text = _build_honor_raw_text(detail).strip()
    if not raw_text:
        raise JDFetchError("岗位链接抓取失败：Honor 岗位详情接口返回空内容。请改为粘贴 JD 文本。")
    return JDFetchResult(
        url=url,
        title=str(detail.get("postName") or "").strip(),
        raw_text=raw_text,
    )


def validate_public_url(url: str) -> str:
    normalized = (url or "").strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise JDFetchError("岗位链接格式无效，请提供公开可访问的 http/https 链接。")
    return normalized


async def fetch_job_description_from_url(url: str, timeout_seconds: int = 30) -> JDFetchResult:
    normalized_url = validate_public_url(url)
    honor_result = await _fetch_honor_job_description(normalized_url, timeout_seconds)
    if honor_result is not None:
        return honor_result

    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
    except ImportError as exc:
        raise JDFetchError("服务端缺少 Crawl4AI 依赖，暂时无法抓取岗位链接。") from exc

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        browser_type="chromium",
        ignore_https_errors=True,
        java_script_enabled=True,
    )
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
        process_iframes=True,
        remove_overlay_elements=True,
        excluded_tags=["script", "style"],
        page_timeout=timeout_seconds * 1000,
        verbose=False,
        wait_until="domcontentloaded",
    )
    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=normalized_url, config=run_config)
    except Exception as exc:
        raise JDFetchError(_format_crawler_error(exc)) from exc

    if not result.success:
        message = getattr(result, "error_message", "未知错误")
        raise JDFetchError(f"岗位链接抓取失败：{message}。请改为粘贴 JD 文本。")

    markdown = (getattr(result, "markdown", "") or "").strip()
    if not markdown:
        raise JDFetchError("岗位链接抓取结果为空，请改为粘贴 JD 文本。")

    metadata = getattr(result, "metadata", None) or {}
    title = str(metadata.get("title") or "").strip() if isinstance(metadata, dict) else ""
    return JDFetchResult(url=normalized_url, title=title, raw_text=markdown)
