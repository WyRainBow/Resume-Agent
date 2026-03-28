#!/usr/bin/env python3
import asyncio
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


ROOT = Path("/Users/wy770/Resume-Agent")
STATE_ENV = ROOT / ".browser-fast" / "domshell.env"


def _load_token() -> str:
    token = os.environ.get("DOMSHELL_TOKEN", "").strip()
    if token:
        return token
    if STATE_ENV.exists():
        for line in STATE_ENV.read_text(encoding="utf-8").splitlines():
            if line.startswith("export DOMSHELL_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("DOMSHELL_TOKEN not found. Run browser-start and connect the DOMShell extension first.")


def _server_params() -> StdioServerParameters:
    token = _load_token()
    port = os.environ.get("DOMSHELL_PORT", "3001")
    return StdioServerParameters(
        command="npx",
        args=["-p", "@apireno/domshell", "domshell-proxy", "--port", port, "--token", token],
    )


async def _call(session: ClientSession, tool: str, args: dict, timeout: int = 20):
    return await asyncio.wait_for(session.call_tool(tool, args), timeout=timeout)


def _tool_text(result) -> str:
    parts: list[str] = []
    for item in getattr(result, "content", []) or []:
        text = getattr(item, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


async def _wait_for_text(session: ClientSession, text: str, timeout: int = 15) -> None:
    deadline = asyncio.get_running_loop().time() + timeout
    while True:
        result = await _call(session, "domshell_eval", {"expression": f"document.body.innerText.includes({text!r})"}, timeout=10)
        if "true" in _tool_text(result).lower():
            return
        if asyncio.get_running_loop().time() >= deadline:
            raise RuntimeError(f"Timed out waiting for text: {text}")
        await asyncio.sleep(1)


async def _click_by_js(session: ClientSession, code: str, description: str) -> str:
    result = await _call(session, "domshell_js", {"code": code}, timeout=20)
    text = _tool_text(result)
    if '"ok": true' not in text:
        raise RuntimeError(f"{description} failed: {text or 'no result'}")
    return text


async def run_resume_diagnosis_flow(url: str) -> None:
    async with stdio_client(_server_params()) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            open_result = await _call(session, "domshell_open", {"url": url})
            print("[open]")
            print(_tool_text(open_result))

            await _wait_for_text(session, "展示简历", timeout=20)

            show_resume = r"""
(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (el) => (el.innerText || '').includes('展示简历')
  );
  if (!btn) return {ok:false, reason:'show_resume_not_found'};
  btn.click();
  return {ok:true, text:(btn.innerText || '').trim()};
})()
"""
            print("[click-show-resume]")
            print(await _click_by_js(session, show_resume, "click 展示简历"))

            await _wait_for_text(session, "选择已有简历", timeout=15)

            choose_existing = r"""
(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (el) => (el.innerText || '').trim().startsWith('选择已有简历')
  );
  if (!btn) return {ok:false, reason:'choose_existing_not_found'};
  btn.click();
  return {ok:true, text:(btn.innerText || '').trim()};
})()
"""
            print("[click-choose-existing]")
            print(await _click_by_js(session, choose_existing, "click 选择已有简历"))

            await _wait_for_text(session, "选择一份简历", timeout=20)

            select_first_resume = r"""
(() => {
  const cards = Array.from(document.querySelectorAll('button,div,[role="button"]')).filter((el) => {
    const txt = (el.innerText || '').trim();
    return txt.includes('更新于') && getComputedStyle(el).cursor === 'pointer';
  });
  const target = cards[0];
  if (!target) return {ok:false, reason:'resume_card_not_found'};
  const txt = (target.innerText || '').trim();
  target.click();
  return {ok:true, text:txt};
})()
"""
            print("[click-first-resume]")
            print(await _click_by_js(session, select_first_resume, "select first resume"))

            await asyncio.sleep(2)
            await _wait_for_text(session, "简历诊断", timeout=15)

            click_diagnosis = r"""
(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (el) => (el.innerText || '').includes('简历诊断')
  );
  if (!btn) return {ok:false, reason:'resume_diagnosis_not_found'};
  btn.click();
  return {ok:true, text:(btn.innerText || '').trim()};
})()
"""
            print("[click-resume-diagnosis]")
            print(await _click_by_js(session, click_diagnosis, "click 简历诊断"))

            body = await _call(session, "domshell_eval", {"expression": "document.body.innerText.slice(0,5000)"}, timeout=15)
            print("[body]")
            print(_tool_text(body))


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: browser-resume-flow.py resume-diagnosis [url]", file=sys.stderr)
        return 2

    flow = sys.argv[1]
    url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5173/agent/new"

    if flow != "resume-diagnosis":
        print(f"Unsupported flow: {flow}", file=sys.stderr)
        return 2

    rc = 0
    try:
        asyncio.run(run_resume_diagnosis_flow(url))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        rc = 1
    finally:
        # Force exit to avoid hanging on async generator teardown in this runtime.
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(rc)


if __name__ == "__main__":
    raise SystemExit(main())
