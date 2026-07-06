"""
对比各模型输出的 JSON 内容完整度

维度：
  1. 字段覆盖：顶层字段、各 section 是否齐全
  2. 条目内容：每条实习/项目/奖项的标题、日期、描述、highlights 是否非空
  3. 信息保真度：与 deepseek(当前生产) 对比内容相似度（文本块交集）
  4. 高亮质量：highlights 是否是完整句子、有无截断
  5. 字符总量：各 section 的总字符数（反映信息密度）

用法：
  .venv/bin/python -m backend.scripts.compare_bench_json
"""
import json
from pathlib import Path

MODELS = ["qwen-turbo", "qwen-plus", "qwen-plus-latest", "qwen-max", "qwen3.7-plus", "qwen3.7-max", "deepseek-v4-flash"]
BASELINE = "deepseek-v4-flash"  # 当前生产，作为对比基准


def load(model):
    # 兼容 safe_filename（. → _）和原始名两种
    candidates = [
        f"/tmp/bench_{model}.json",
        f"/tmp/bench_{model.replace('.', '_').replace('/', '_')}.json",
    ]
    if model == "deepseek-v4-flash":
        candidates.append("/tmp/bench_qwen_output.json")  # 旧文件名
    for p in candidates:
        pp = Path(p)
        if pp.exists():
            return json.loads(pp.read_text(encoding="utf-8"))
    return None


def section_items(data, field):
    """兼容字段名：internships/experience, openSource/open_source"""
    if not isinstance(data, dict):
        return []
    val = data.get(field)
    if isinstance(val, list):
        return val
    # 别名
    aliases = {"internships": ["experience"], "openSource": ["open_source", "opensource"]}
    for alias in aliases.get(field, []):
        val = data.get(alias)
        if isinstance(val, list):
            return val
    return []


def item_completeness(item):
    """单条目的完整度：检查 title/subtitle/date/highlights/description 非空"""
    if isinstance(item, str):
        return (1, 1) if item.strip() else (0, 1)
    if not isinstance(item, dict):
        return (0, 1)
    score = 0
    total = 0
    fields = ["title", "subtitle", "date", "highlights", "description", "items", "role", "issuer"]
    for f in fields:
        if f in item:
            total += 1
            val = item[f]
            if val and str(val).strip():
                score += 1
    return score, total


def text_of(item):
    """把条目所有文本拼成一段，用于相似度对比"""
    if isinstance(item, str):
        return item.strip()
    if not isinstance(item, dict):
        return str(item)
    parts = []
    for f in ["title", "subtitle", "date", "description", "role", "issuer"]:
        v = item.get(f)
        if isinstance(v, str) and v.strip():
            parts.append(v.strip())
    for f in ["highlights", "items"]:
        v = item.get(f)
        if isinstance(v, list):
            for h in v:
                if isinstance(h, str):
                    parts.append(h.strip())
                elif isinstance(h, dict):
                    parts.append(str(h))
    return " ".join(parts)


def char_count(data):
    """统计各 section 总字符量"""
    sections = {"internships": 0, "education": 0, "projects": 0, "awards": 0, "skills": 0, "openSource": 0}
    if not isinstance(data, dict):
        return sections
    for field in sections:
        items = section_items(data, field)
        for it in items:
            sections[field] += len(text_of(it))
    # summary/objective
    for f in ["summary", "objective"]:
        v = data.get(f)
        if isinstance(v, str):
            sections[f] = len(v)
    return sections


def tokens_set(text):
    """简单分词（中文按字、英文按词），用于交集计算"""
    import re
    # 英文词
    en = set(re.findall(r"[a-zA-Z]+", text.lower()))
    # 中文字（2-gram 更稳定，这里用单字+2gram）
    cn = re.sub(r"[^\u4e00-\u9fa5]", "", text)
    cn_2g = set(cn[i:i+2] for i in range(len(cn)-1))
    return en | cn_2g


def similarity(a, b):
    """文本相似度（Jaccard 近似）"""
    sa, sb = tokens_set(a), tokens_set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def main():
    all_data = {m: load(m) for m in MODELS}
    all_data = {m: d for m, d in all_data.items() if d is not None}
    if not all_data:
        print("❌ 没有找到任何 bench JSON，先运行 bench_import_pipeline")
        return

    baseline = all_data.get(BASELINE)
    print("=" * 90)
    print(f"各模型 JSON 内容完整度对比（基准：{BASELINE}）")
    print("=" * 90)

    # 1. 顶层字段覆盖
    print("\n【1】顶层字段覆盖")
    print(f"{'模型':<20} {'字段数':>5}  缺失字段")
    print("-" * 70)
    ref_keys = set(baseline.keys()) if baseline else set()
    for m, d in all_data.items():
        keys = set(d.keys())
        missing = ref_keys - keys if ref_keys else set()
        print(f"{m:<20} {len(keys):>5}  {missing if missing else '无'}")

    # 2. 各 section 条目数 + 完整度
    print(f"\n【2】各 section 条目内容完整度（非空字段 / 总字段）")
    for field in ["internships", "education", "projects", "awards", "skills", "openSource"]:
        print(f"\n  ── {field} ──")
        print(f"  {'模型':<20} {'条数':>4} {'平均完整率':>10} {'空字段数':>8} {'内容相似度':>10}")
        base_items = section_items(baseline, field) if baseline else []
        base_full_text = " ".join(text_of(it) for it in base_items)
        for m, d in all_data.items():
            items = section_items(d, field)
            if not items:
                if base_items:
                    print(f"  {m:<20} {'0':>4}  ❌ 该 section 缺失")
                continue
            total_score = 0
            total_fields = 0
            empty_fields = 0
            for it in items:
                s, t = item_completeness(it)
                total_score += s
                total_fields += t
                empty_fields += (t - s)
            avg_complete = total_score / total_fields if total_fields else 0
            # 与 baseline 该 section 整体文本相似度
            cur_full_text = " ".join(text_of(it) for it in items)
            sim = similarity(cur_full_text, base_full_text) * 100 if base_full_text else 0
            print(f"  {m:<20} {len(items):>4} {avg_complete*100:>9.1f}% {empty_fields:>8} {sim:>9.1f}%")

    # 3. 字符总量（信息密度）
    print(f"\n【3】各 section 字符总量（信息密度）")
    print(f"  {'模型':<20} {'实习':>6} {'教育':>6} {'项目':>6} {'奖项':>6} {'技能':>6} {'开源':>6} {'总计':>6}")
    print("  " + "-" * 68)
    for m, d in all_data.items():
        c = char_count(d)
        total = sum(c.values())
        print(f"  {m:<20} {c['internships']:>6} {c['education']:>6} {c['projects']:>6} {c['awards']:>6} {c['skills']:>6} {c['openSource']:>6} {total:>6}")

    # 4. highlights 质量抽查（第一段实习的 highlights）
    print(f"\n【4】第一段实习 highlights 抽查（看是否完整句子、有无截断）")
    for m, d in all_data.items():
        items = section_items(d, "internships")
        if not items:
            continue
        hl = items[0].get("highlights") or []
        company = items[0].get("subtitle") or items[0].get("title") or "?"
        print(f"\n  {m}（{company[:20]}）— {len(hl)} 条 highlights:")
        for i, h in enumerate(hl[:3], 1):
            text = h if isinstance(h, str) else json.dumps(h, ensure_ascii=False)
            truncated = "…" if len(text) > 90 else ""
            print(f"    {i}. {text[:90]}{truncated} ({len(text)}字)")

    # 5. 综合评分
    print(f"\n{'='*90}")
    print("【5】综合评估（内容完整度视角）")
    print("=" * 90)
    print(f"{'模型':<20} {'信息密度':>8} {'完整率':>8} {'与基线相似':>10} {'hlights':>8}  结论")
    print("-" * 90)
    for m, d in all_data.items():
        c = char_count(d)
        density = sum(c.values())
        # 平均完整率
        all_items = []
        for field in ["internships", "projects", "awards"]:
            all_items.extend(section_items(d, field))
        ts, tt = 0, 0
        for it in all_items:
            s, t = item_completeness(it)
            ts += s; tt += t
        avg_comp = ts / tt if tt else 0
        # highlights 数
        hl_total = sum(len(it.get("highlights") or []) for it in section_items(d, "internships") + section_items(d, "projects"))
        # 与 baseline 相似度（整体）
        if baseline and m != BASELINE:
            all_text = " ".join(text_of(it) for it in all_items)
            base_items_all = []
            for field in ["internships", "projects", "awards"]:
                base_items_all.extend(section_items(baseline, field))
            base_text = " ".join(text_of(it) for it in base_items_all)
            sim = similarity(all_text, base_text) * 100
        else:
            sim = 100.0
        verdict = "基准" if m == BASELINE else ("✓ 内容完整" if avg_comp > 0.85 and sim > 60 else "⚠ 可能丢内容")
        print(f"{m:<20} {density:>8} {avg_comp*100:>7.1f}% {sim:>9.1f}% {hl_total:>8}  {verdict}")


if __name__ == "__main__":
    main()
