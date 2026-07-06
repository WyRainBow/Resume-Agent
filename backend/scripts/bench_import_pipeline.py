"""
简历导入：结构化模型批量基准测试

测试同一段 Markdown（来自 glm-ocr）在不同模型下转 JSON 的：
  - 耗时
  - 成功率
  - 质量指标（提取出的字段数、各 section 条目数、姓名是否正确）

用法：
  # 测单个模型（默认 qwen-plus）
  .venv/bin/python -m backend.scripts.bench_import_pipeline

  # 测多个模型，自动对比
  .venv/bin/python -m backend.scripts.bench_import_pipeline qwen-turbo qwen-plus qwen-max qwen3.7-plus qwen3.7-max deepseek-v4-flash

  # 重新跑 glm-ocr（默认用 /tmp 缓存）
  BENCH_SKIP_OCR=0 .venv/bin/python -m backend.scripts.bench_import_pipeline qwen-plus

输出：
  - 每个模型单独保存 JSON 到 /tmp/bench_<model>.json
  - 最后打印对比表
"""
import sys
import os
import time
import json
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

PDF_PATH = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("qwen") and sys.argv[1] != "deepseek-v4-flash" else "测试样本/尹昕雨 3.pdf"
# 命令行后续参数都是模型名
CLI_MODELS = [a for a in sys.argv[1:] if a.startswith("qwen") or a.startswith("deepseek")]
DEFAULT_MODELS = ["qwen-turbo", "qwen-plus", "qwen-max", "qwen3.7-plus", "qwen3.7-max", "deepseek-v4-flash"]
MODELS = CLI_MODELS if CLI_MODELS else DEFAULT_MODELS
SKIP_OCR = os.getenv("BENCH_SKIP_OCR", "1") == "1"
MD_CACHE = "/tmp/bench_glm_ocr_output.md"
RESULT_DIR = "/tmp"

# 已知正确答案（用于质量评估，基于该样本人工核对）
EXPECTED = {
    "name": "尹昕雨",
    "internships_count_min": 4,   # 至少 4 段实习
    "education_count_min": 1,
    "has_email": "2943793993@qq.com",
}


def run_glm_ocr(pdf_bytes: bytes) -> str:
    from backend.services.zhipu_layout import recognize_with_ocr
    print("=" * 70)
    print("步骤 1：glm-ocr 把 PDF 转 Markdown")
    print("=" * 70)
    t0 = time.perf_counter()
    markdown = recognize_with_ocr(pdf_bytes)
    elapsed = time.perf_counter() - t0
    Path(MD_CACHE).write_text(markdown, encoding="utf-8")
    print(f"✅ glm-ocr 完成，耗时: {elapsed:.2f}s，Markdown {len(markdown)} 字符，已缓存\n")
    return markdown


def safe_filename(model: str) -> str:
    return model.replace("/", "_").replace(".", "_")


def eval_quality(data: dict) -> dict:
    """评估提取质量，返回指标 dict"""
    if not isinstance(data, dict):
        return {"valid_json": False}
    metrics = {"valid_json": True}
    metrics["top_keys"] = len(data.keys())
    metrics["name"] = data.get("name") or (data.get("basic") or {}).get("name") or ""
    metrics["name_correct"] = metrics["name"] == EXPECTED["name"]
    for field in ["internships", "education", "projects", "awards", "skills", "experience", "openSource"]:
        val = data.get(field)
        if isinstance(val, list) and val:
            metrics[f"{field}_n"] = len(val)
    # email
    contact = data.get("contact") or {}
    email = contact.get("email") or (data.get("basic") or {}).get("email") or ""
    metrics["email"] = email
    metrics["email_correct"] = EXPECTED["has_email"] in str(email) if email else False
    # 综合评分：姓名对+email对+各section条目数达标
    score = 0
    if metrics["name_correct"]: score += 3
    if metrics["email_correct"]: score += 2
    if metrics.get("internships_n", 0) >= EXPECTED["internships_count_min"]: score += 3
    if metrics.get("education_n", 0) >= EXPECTED["education_count_min"]: score += 1
    # 高亮条数（质量信号）
    total_highlights = 0
    for field in ["internships", "projects"]:
        for item in (data.get(field) or []):
            hl = item.get("highlights") or item.get("items") or []
            if isinstance(hl, list):
                total_highlights += len(hl)
    metrics["total_highlights"] = total_highlights
    if total_highlights >= 8: score += 1
    metrics["quality_score"] = score
    return metrics


def run_model(model: str, markdown: str) -> dict:
    """单模型测试，返回 {model, elapsed, ok, metrics, error}"""
    import backend.services.resume_assembler as assembler
    from backend.services.resume_assembler import assemble_resume_data

    original = assembler.DEEPSEEK_MODEL
    assembler.DEEPSEEK_MODEL = model  # 绕过强转
    result = {"model": model, "ok": False, "elapsed": 0, "error": None, "metrics": {}}
    try:
        t0 = time.perf_counter()
        data = assemble_resume_data(raw_text="", layout={}, ocr_text=markdown, model=model)
        result["elapsed"] = time.perf_counter() - t0
        result["ok"] = True
        result["metrics"] = eval_quality(data)
        # 保存 JSON
        out = f"{RESULT_DIR}/bench_{safe_filename(model)}.json"
        Path(out).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        result["output"] = out
    except Exception as e:
        result["error"] = str(e)[:200]
    finally:
        assembler.DEEPSEEK_MODEL = original
    return result


def main():
    pdf_full = PROJECT_ROOT / PDF_PATH if not os.path.isabs(PDF_PATH) else Path(PDF_PATH)
    if not pdf_full.exists():
        print(f"❌ 文件不存在: {pdf_full}"); sys.exit(1)
    pdf_bytes = pdf_full.read_bytes()

    print("=" * 70)
    print("简历导入 · 结构化模型批量基准测试")
    print("=" * 70)
    print(f"样本 PDF : {pdf_full.name} ({len(pdf_bytes)/1024:.1f} KB)")
    print(f"待测模型 : {MODELS}")
    print(f"OCR 缓存 : {'用缓存' if SKIP_OCR and Path(MD_CACHE).exists() else '重跑 glm-ocr'}")
    print(f"KEY      : ZHIPU={'✓' if os.getenv('ZHIPU_API_KEY') else '✗'} DASHSCOPE={'✓' if os.getenv('DASHSCOPE_API_KEY') else '✗'}")
    print()

    # 步骤 1：OCR（单次）
    if SKIP_OCR and Path(MD_CACHE).exists():
        markdown = Path(MD_CACHE).read_text(encoding="utf-8")
        print(f"[skip] 用缓存 Markdown: {len(markdown)} 字符\n")
    else:
        markdown = run_glm_ocr(pdf_bytes)

    # 步骤 2：逐模型测试
    results = []
    for i, model in enumerate(MODELS, 1):
        print(f"[{i}/{len(MODELS)}] 测试 {model} ...", flush=True)
        r = run_model(model, markdown)
        results.append(r)
        if r["ok"]:
            m = r["metrics"]
            print(f"  ✅ {r['elapsed']:.2f}s | 姓名:{m.get('name','')[:8]}({'✓' if m.get('name_correct') else '✗'}) "
                  f"实习:{m.get('internships_n',0)} 高亮:{m.get('total_highlights',0)} 评分:{m.get('quality_score',0)}/10")
        else:
            print(f"  ❌ 失败: {r['error']}")
        print()

    # 对比表
    print("=" * 70)
    print("对比汇总")
    print("=" * 70)
    ok_results = [r for r in results if r["ok"]]
    ok_results.sort(key=lambda x: x["elapsed"])
    print(f"{'模型':<22} {'耗时':>8} {'评分':>5} {'姓名':>5} {'email':>6} {'实习':>4} {'项目':>4} {'奖项':>4} {'高亮':>4}")
    print("-" * 70)
    for r in ok_results:
        m = r["metrics"]
        print(f"{r['model']:<22} {r['elapsed']:>7.2f}s {m.get('quality_score',0):>4}/10 "
              f"{'✓' if m.get('name_correct') else '✗':>5} "
              f"{'✓' if m.get('email_correct') else '✗':>6} "
              f"{m.get('internships_n',0):>4} {m.get('projects_n',0):>4} "
              f"{m.get('awards_n',0):>4} {m.get('total_highlights',0):>4}")
    failed = [r for r in results if not r["ok"]]
    if failed:
        print("-" * 70)
        print("失败模型:")
        for r in failed:
            print(f"  {r['model']}: {r['error']}")

    print("=" * 70)
    if ok_results:
        fastest = ok_results[0]
        best_q = max(ok_results, key=lambda x: x["metrics"].get("quality_score", 0))
        print(f"🏆 最快: {fastest['model']} ({fastest['elapsed']:.2f}s, 评分 {fastest['metrics'].get('quality_score',0)}/10)")
        print(f"⭐ 质量最高: {best_q['model']} (评分 {best_q['metrics'].get('quality_score',0)}/10, {best_q['elapsed']:.2f}s)")
    print()
    print("提示: 单样本结论有限，建议再用多页/英文/表格密集样本验证质量稳定性")


if __name__ == "__main__":
    main()
