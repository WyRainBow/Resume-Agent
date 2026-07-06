"""
探测 DashScope 账号下可用的 qwen-latest 系列模型

直接用最小请求测试各候选模型名是否可用，避免猜测。
"""
import os
import sys
from pathlib import Path
from openai import OpenAI

PROJECT_ROOT = Path(__file__).resolve().parents[2]
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(PROJECT_ROOT / ".env"), override=True)
except Exception:
    pass

BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

# 候选模型名：各种 latest 写法 + 已知可用作对照
CANDIDATES = [
    # latest 系列变体
    "qwen-latest",
    "qwen3-latest",
    "qwen-plus-latest",
    "qwen-max-latest",
    "qwen-turbo-latest",
    # 已知可用（对照）
    "qwen-plus",
    "qwen-max",
    "qwen-turbo",
]

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
print(f"Base URL: {BASE_URL}")
print(f"测试 {len(CANDIDATES)} 个候选模型（每个发一句 hello）\n")
print(f"{'模型':<22} {'状态':<8} {'耗时':>8}  说明")
print("-" * 70)

import time
results = []
for model in CANDIDATES:
    t0 = time.perf_counter()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "说一个字"}],
            max_tokens=10,
            temperature=0,
        )
        elapsed = time.perf_counter() - t0
        content = resp.choices[0].message.content or ""
        print(f"{model:<22} {'✅ 可用':<8} {elapsed:>7.2f}s  回复: {content[:20]}")
        results.append((model, True, elapsed))
    except Exception as e:
        elapsed = time.perf_counter() - t0
        msg = str(e)
        # 提取关键错误信息
        if "model_not_found" in msg or "does not exist" in msg:
            status = "❌ 不存在"
        elif "Access denied" in msg or "Permission" in msg or "未开通" in msg:
            status = "⚠️ 未授权"
        else:
            status = "❌ 错误"
        print(f"{model:<22} {status:<8} {elapsed:>7.2f}s  {msg[:80]}")
        results.append((model, False, elapsed))

print("\n" + "=" * 70)
ok = [r for r in results if r[1]]
latest_ok = [r for r in ok if "latest" in r[0]]
print(f"可用模型: {len(ok)}/{len(CANDIDATES)}")
if latest_ok:
    print(f"✅ latest 系列可用: {[r[0] for r in latest_ok]}")
else:
    print("⚠️ 该账号下没有可用的 *-latest 模型，建议用 qwen-plus / qwen-max / qwen-turbo")
