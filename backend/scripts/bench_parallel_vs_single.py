"""
导入结构化：单次 vs 分段并行 质量+耗时对比

在同一段 glm-ocr Markdown 上对比三条路径：
  - baseline : assemble_resume_data(deepseek-v4-flash)   当前生产
  - single   : assemble_resume_data(qwen-plus-latest)     计划①（换模型，仍单次）
  - parallel : assemble_resume_data_fast(qwen-plus-latest) 计划②（分段并行）

用法：
  .venv/bin/python -m backend.scripts.bench_parallel_vs_single
  BENCH_SKIP_OCR=0 .venv/bin/python -m backend.scripts.bench_parallel_vs_single   # 重跑 OCR

复用 bench_import_pipeline 的 OCR 缓存与 eval_quality。
"""
import sys
import os
import time
import json
import asyncio
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
for p in [PROJECT_ROOT, str(PROJECT_ROOT / "backend")]:
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(PROJECT_ROOT / ".env"), override=True)
except Exception:
    pass

from backend.scripts.bench_import_pipeline import eval_quality, MD_CACHE

PDF_PATH = "测试样本/尹昕雨 3.pdf"
SKIP_OCR = os.getenv("BENCH_SKIP_OCR", "1") == "1"


def get_markdown() -> str:
    if SKIP_OCR and Path(MD_CACHE).exists():
        md = Path(MD_CACHE).read_text(encoding="utf-8")
        print(f"[skip] 用缓存 Markdown: {len(md)} 字符\n")
        return md
    from backend.services.zhipu_layout import recognize_with_ocr
    pdf_full = PROJECT_ROOT / PDF_PATH
    t0 = time.perf_counter()
    md = recognize_with_ocr(pdf_full.read_bytes())
    Path(MD_CACHE).write_text(md, encoding="utf-8")
    print(f"✅ glm-ocr {time.perf_counter()-t0:.2f}s, {len(md)} 字符\n")
    return md


def run_single(markdown: str, model: str) -> dict:
    import backend.services.resume_assembler as assembler
    from backend.services.resume_assembler import assemble_resume_data
    r = {"label": f"single/{model}", "ok": False, "elapsed": 0, "error": None, "metrics": {}}
    try:
        t0 = time.perf_counter()
        data = assemble_resume_data(raw_text="", layout={}, ocr_text=markdown, model=model)
        r["elapsed"] = time.perf_counter() - t0
        r["ok"] = True
        r["metrics"] = eval_quality(data)
        Path(f"/tmp/bench_pv_single_{assembler.resolve_assembler_model(model)}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        r["error"] = str(e)[:200]
    return r


async def run_parallel(markdown: str, model: str) -> dict:
    from backend.services.resume_assembler import assemble_resume_data_fast
    r = {"label": f"parallel/{model}", "ok": False, "elapsed": 0, "error": None, "metrics": {}}
    try:
        t0 = time.perf_counter()
        data = await assemble_resume_data_fast(markdown, model=model)
        r["elapsed"] = time.perf_counter() - t0
        r["ok"] = True
        r["metrics"] = eval_quality(data)
        Path("/tmp/bench_pv_parallel.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        import traceback
        r["error"] = str(e)[:200]
        traceback.print_exc()
    return r


def line(r: dict) -> str:
    m = r["metrics"]
    if not r["ok"]:
        return f"{r['label']:<26} ❌ {r['error']}"
    return (f"{r['label']:<26} {r['elapsed']:>6.2f}s  评分{m.get('quality_score',0):>2}/10  "
            f"姓名{'✓' if m.get('name_correct') else '✗'} email{'✓' if m.get('email_correct') else '✗'}  "
            f"实习{m.get('internships_n',0)} 教育{m.get('education_n',0)} 项目{m.get('projects_n',0)} "
            f"技能{m.get('skills_n',0)} 奖项{m.get('awards_n',0)} 高亮{m.get('total_highlights',0)}")


async def main():
    print("=" * 78)
    print("导入结构化：单次 vs 分段并行")
    print("=" * 78)
    print(f"KEY: ZHIPU={'✓' if os.getenv('ZHIPU_API_KEY') else '✗'} DASHSCOPE={'✓' if os.getenv('DASHSCOPE_API_KEY') else '✗'}\n")
    markdown = get_markdown()

    results = []
    print("[1/3] baseline deepseek-v4-flash（单次）...", flush=True)
    results.append(run_single(markdown, "deepseek-v4-flash"))
    print("      " + line(results[-1]) + "\n")

    print("[2/3] 计划① qwen-plus-latest（单次）...", flush=True)
    results.append(run_single(markdown, "qwen-plus-latest"))
    print("      " + line(results[-1]) + "\n")

    print("[3/3] 计划② qwen-plus-latest（分段并行）...", flush=True)
    results.append(await run_parallel(markdown, "qwen-plus-latest"))
    print("      " + line(results[-1]) + "\n")

    print("=" * 78)
    print("对比")
    print("=" * 78)
    for r in results:
        print(line(r))
    print()
    ok = [r for r in results if r["ok"]]
    if len(ok) >= 2:
        base = next((r for r in ok if "deepseek" in r["label"]), ok[0])
        par = next((r for r in ok if r["label"].startswith("parallel")), None)
        if par and base["elapsed"]:
            print(f"并行相对 baseline 提速: {base['elapsed']/par['elapsed']:.1f}x "
                  f"（{base['elapsed']:.1f}s → {par['elapsed']:.1f}s）")
        print("\n质量门槛：并行的 实习/教育/项目/技能 条目数与高亮数应 ≥ 单次 qwen，否则不采用并行为默认。")


if __name__ == "__main__":
    asyncio.run(main())
