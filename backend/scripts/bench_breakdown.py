"""
拆解 Markdown→JSON 的耗时来源

把 assemble_resume_data 的一次 LLM 调用拆成：
  1. prompt 构建（本地，应 <0.1s）
  2. 网络/排队延迟（从发请求到首 token）
  3. token 生成（首 token 到完成）
  4. 总耗时 vs 实际输出 token 数 → 算 tokens/s

对比 qwen-plus / qwen-plus-latest / deepseek-v4-flash，看差距来自哪。
"""
import os, sys, time, json
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

from openai import OpenAI

BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

# 用之前 OCR 出的真实 Markdown 作为输入
MD = Path("/tmp/bench_glm_ocr_output.md").read_text(encoding="utf-8") if Path("/tmp/bench_glm_ocr_output.md").exists() else "测试简历"

# 复用项目的真实 prompt（确保测的是真实场景）
import backend.services.resume_assembler as assembler
# 取 assemble_resume_data 里的 prompt 构建逻辑产物
from backend.services.resume_assembler import (
    SYSTEM_PROMPT, ASSEMBLER_PROMPT, OUTPUT_SCHEMA, DATA_FUSION_RULES,
    SECTION_MAPPING_RULES, HIGHLIGHTS_RULES, NESTED_RULES, SKILLS_RULES, FORMAT_RULES,
    _build_data_sources_desc, _build_data_content, _split_text_by_headings,
)

def build_real_prompt(markdown):
    has_layout = False
    data_sources_desc = _build_data_sources_desc(markdown, markdown, has_layout)
    layout_hint = "没有布局骨架，请根据文本内容自行判断模块划分。"
    section_mapping_rules = SECTION_MAPPING_RULES.format(has_layout_hint=layout_hint)
    format_rules = FORMAT_RULES.format(format_info_hint="- 请根据文本内容自行判断格式特征")
    primary_text = markdown
    section_text = _split_text_by_headings(primary_text)
    data_content = _build_data_content(markdown, markdown, {}, has_layout, section_text)
    user_prompt = ASSEMBLER_PROMPT.format(
        data_sources_desc=data_sources_desc,
        data_fusion_rules=DATA_FUSION_RULES.format(),
        section_mapping_rules=section_mapping_rules,
        highlights_rules=HIGHLIGHTS_RULES.format(),
        nested_rules=NESTED_RULES.format(),
        skills_rules=SKILLS_RULES.format(),
        format_rules=format_rules,
        data_content=data_content,
        schema=OUTPUT_SCHEMA,
    )
    system_msg = SYSTEM_PROMPT.format()
    return system_msg, user_prompt

system_msg, user_prompt = build_real_prompt(MD)
print(f"输入 Markdown: {len(MD)} 字符")
print(f"system prompt: {len(system_msg)} 字符")
print(f"user prompt: {len(user_prompt)} 字符")
print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
print()

MODELS = ["qwen-plus", "qwen-plus-latest", "deepseek-v4-flash"]

print(f"{'模型':<22} {'总耗时':>8} {'输出token':>10} {'tokens/s':>10} {'输出字节':>10}")
print("-" * 65)

for model in MODELS:
    t0 = time.perf_counter()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=8000,
        )
        elapsed = time.perf_counter() - t0
        content = resp.choices[0].message.content or ""
        usage = resp.usage
        completion_tokens = usage.completion_tokens if usage else len(content)
        tps = completion_tokens / elapsed if elapsed > 0 else 0
        print(f"{model:<22} {elapsed:>7.2f}s {completion_tokens:>10} {tps:>9.1f} {len(content.encode('utf-8')):>10}")
    except Exception as e:
        elapsed = time.perf_counter() - t0
        print(f"{model:<22} {elapsed:>7.2f}s  ❌ {str(e)[:60]}")

print()
print("=" * 65)
print("结论：看 tokens/s 列——数字越大生成越快。")
print("如果总耗时差距大但 tokens/s 接近，说明是输出长度差异；")
print("如果 tokens/s 差距大，说明是模型本身的生成速度差异。")
