"""AI 味短语黑名单与替换映射

用于简历润色时去 AI 味——让生成的简历表述更像人写的，而不是 LLM 默认的
浮夸堆砌。

英文词表移植自 Resume-Matcher (Apache-2.0) 的 app/prompts/refinement.py，
中文词表为本项目自加（RM 是英文产品，没有中文黑名单）。

使用方式：
- 在润色 prompt 末尾追加 build_ai_phrase_rule_block() 的返回值，让 LLM 主动避开
- 或在后处理阶段用 replace_ai_phrases() 做本地替换（更可控但生硬）

来源标注：
- 英文 AI_PHRASE_BLACKLIST / AI_PHRASE_REPLACEMENTS：Resume-Matcher, Apache-2.0
  https://github.com/srbhr/resume-matcher/blob/main/apps/backend/app/prompts/refinement.py
- 中文部分：本项目自维护
"""
from __future__ import annotations

# ============================================================
# 英文 AI 味短语（移植自 Resume-Matcher, Apache-2.0）
# ============================================================

AI_PHRASE_BLACKLIST_EN: set[str] = {
    # Action verbs (overused in AI resume writing)
    "spearheaded", "orchestrated", "championed", "synergized", "leveraged",
    "revolutionized", "pioneered", "catalyzed", "operationalized", "architected",
    "envisioned", "effectuated", "endeavored", "facilitated", "utilized",
    # Corporate buzzwords
    "synergy", "synergies", "paradigm", "paradigm shift", "best-in-class",
    "world-class", "cutting-edge", "bleeding-edge", "game-changer",
    "game-changing", "disruptive", "disruptor", "holistic", "robust",
    "scalable", "actionable", "impactful", "proactive", "proactively",
    "stakeholder", "deliverables", "bandwidth", "circle back", "deep dive",
    "move the needle", "low-hanging fruit", "touch base", "value-add",
    # Filler phrases
    "in order to", "for the purpose of", "with a view to",
    "at the end of the day", "moving forward", "going forward",
    "on a daily basis", "on a regular basis", "in a timely manner",
    "at this point in time", "due to the fact that", "in the event that",
    "in light of the fact that",
    # Resume-cliché additions (2026-07-17)
    "passionate about", "results-oriented", "results oriented",
    "proven track record", "demonstrated ability to", "best practices",
    "data-driven", "actionable insights", "seamless", "innovative",
    "perfect fit", "north star",
}

# 英文替换映射（AI 味词 → 更朴素的说法）
AI_PHRASE_REPLACEMENTS_EN: dict[str, str] = {
    "spearheaded": "led",
    "orchestrated": "coordinated",
    "championed": "advocated for",
    "synergized": "collaborated",
    "leveraged": "used",
    "revolutionized": "transformed",
    "pioneered": "introduced",
    "catalyzed": "initiated",
    "operationalized": "implemented",
    "architected": "designed",
    "envisioned": "planned",
    "effectuated": "completed",
    "endeavored": "worked",
    "facilitated": "helped",
    "utilized": "used",
    "synergy": "collaboration",
    "synergies": "collaborations",
    "paradigm": "model",
    "best-in-class": "strong",
    "world-class": "strong",
    "cutting-edge": "modern",
    "bleeding-edge": "experimental",
    "game-changer": "improvement",
    "game-changing": "significant",
    "disruptive": "new",
    "holistic": "comprehensive",
    "robust": "reliable",
    "scalable": "growing",
    "actionable": "practical",
    "impactful": "meaningful",
    "proactive": "initiative",
    "stakeholder": "partner",
    "deliverables": "outputs",
    "in order to": "to",
    "for the purpose of": "for",
    "at the end of the day": "ultimately",
    "moving forward": "next",
    "going forward": "next",
    "on a daily basis": "daily",
    "on a regular basis": "regularly",
    "in a timely manner": "promptly",
    "at this point in time": "now",
    "due to the fact that": "because",
    "in the event that": "if",
}

# ============================================================
# 中文 AI 味短语（本项目自维护，RM 无此部分）
# ============================================================

AI_PHRASE_BLACKLIST_ZH: set[str] = {
    # 互联网黑话 / 大厂套话
    "赋能", "抓手", "闭环", "对标", "对齐", "打通", "沉淀", "复用",
    "链路", "矩阵", "盘活", "撬动", "反哺", "心智", "赛道", "势能",
    "护城河", "增长飞轮", "降本增效", "提效", "赋能业务", "协同",
    "拉通", "对焦", "梳理", "落地", "颗粒度", "全链路", "方法论",
    "组合拳", "形成闭环", "助力", "打造", "构建",
    # AI 常用的虚词堆砌
    "有效地", "高效地", "全面地", "深入地", "充分地",
    "进一步提升", "进一步完善", "进一步优化",  # "进一步"滥用
    "基于", "通过", "借助",  # 句首"基于/通过"开头泛滥（不是绝对禁，是警示）
    "致力于", "专注于", "深耕",
    # 形容词堆砌
    "强大的", "丰富的", "完善的", "先进的", "卓越的", "优秀的",
    "一站式", "全方位", "多维度", "立体化",
    # 无证据的简历套话 / AI 行文口癖（2026-07-17 补充）
    "值得注意的是", "总而言之", "综上所述", "以结果为导向", "充满热情",
    "良好的沟通能力", "团队协作精神", "较强的学习能力", "吃苦耐劳",
}

# 中文替换映射（部分词有明确替代；无明确替代的交给 LLM 重写）
AI_PHRASE_REPLACEMENTS_ZH: dict[str, str] = {
    "赋能": "支持",
    "抓手": "切入点",
    "闭环": "完整流程",
    "对标": "参考",
    "对齐": "统一",
    "打通": "连接",
    "沉淀": "积累",
    "复用": "复用（保留，但避免作为动词滥用）",
    "链路": "流程",
    "协同": "协作",
    "拉通": "协调",
    "对焦": "明确",
    "梳理": "整理",
    "落地": "实施",
    "助力": "帮助",
    "致力于": "负责",
    "专注于": "负责",
    "深耕": "从事",
    "有效地": "",
    "高效地": "",
    "全面地": "",
    "深入地": "",
    "充分地": "",
    "进一步提升": "提升",
    "进一步完善": "完善",
    "进一步优化": "优化",
    "强大的": "",
    "丰富的": "",
    "完善的": "",
    "先进的": "",
    "卓越的": "",
    "优秀的": "",
    "一站式": "统一",
    "全方位": "全面",
    "多维度": "多方面",
    "立体化": "具体",
}


# ============================================================
# 对外接口
# ============================================================

def get_ai_phrase_blacklist(locale: str = "zh") -> set[str]:
    """返回对应语言的 AI 味短语黑名单。locale='both' 返回中英合并。"""
    if locale == "zh":
        return AI_PHRASE_BLACKLIST_ZH
    if locale == "en":
        return AI_PHRASE_BLACKLIST_EN
    return AI_PHRASE_BLACKLIST_EN | AI_PHRASE_BLACKLIST_ZH


def get_ai_phrase_replacements(locale: str = "zh") -> dict[str, str]:
    """返回对应语言的 AI 味词→替换映射。"""
    if locale == "zh":
        return AI_PHRASE_REPLACEMENTS_ZH
    if locale == "en":
        return AI_PHRASE_REPLACEMENTS_EN
    return {**AI_PHRASE_REPLACEMENTS_EN, **AI_PHRASE_REPLACEMENTS_ZH}


def build_ai_phrase_rule_block(locale: str = "zh") -> str:
    """构造可拼接到润色 prompt 末尾的「避开 AI 味词」规则块。

    设计取舍：只列示范例词（~15 个最典型的），不把全表灌进 prompt——
    一来省 token，二来 LLM 对短列表更敏感，长列表反而会被忽略。
    让 LLM 把整类词风作为"风格基调"规避，比逐词查杀更自然。
    """
    if locale == "en":
        return (
            "\n\n【避开 AI 味词（必须遵守）】\n"
            "不要使用以下类型的浮夸/AI 味词汇，改用朴素、具体的表述：\n"
            "- 滥用的强动词：spearheaded / orchestrated / leveraged / pioneered / revolutionized\n"
            "- 企业黑话：synergy / paradigm / best-in-class / cutting-edge / holistic / robust / scalable\n"
            "- 空话套话：in order to / moving forward / at the end of the day\n"
            "- 简历套话：passionate about / results-oriented / proven track record\n"
            "- 否定排比：不要写 \"This isn't X. This is Y.\" / \"Not just X, but Y.\"——直接陈述正向主张\n"
            "原则：像一个真实的工程师在写自己的经历，而不是 LLM 在堆砌形容词。"
        )
    if locale == "both":
        return build_ai_phrase_rule_block("zh") + "\n" + build_ai_phrase_rule_block("en")
    # 默认中文
    return (
        "\n\n【避开 AI 味词（必须遵守）】\n"
        "不要使用以下类型的互联网黑话 / AI 套话，改用朴素、具体、人话的表述：\n"
        "- 互联网黑话：赋能 / 抓手 / 闭环 / 对标 / 对齐 / 打通 / 沉淀 / 链路 / 协同 / 落地 / 助力\n"
        "- 虚词堆砌：有效地 / 高效地 / 全面地 / 进一步提升 / 进一步完善\n"
        "- 形容词堆砌：强大的 / 丰富的 / 完善的 / 先进的 / 一站式 / 全方位\n"
        "- 滥用强动词：致力于 / 专注于 / 深耕 / 打造 / 构建\n"
        "- 行文口癖：值得注意的是 / 总而言之 / 综上所述\n"
        "- 否定排比句式：禁止「不是X，而是Y」「真正重要的不是…而是…」——删掉否定铺垫，"
        "直接说正向主张（这是 AI 文本最典型的破绽）\n"
        "原则：像一个真实的工程师在写自己的经历，而不是 LLM 在堆砌形容词。\n"
        "英文同理：避免 spearheaded / orchestrated / leveraged / synergy / paradigm 等词。"
    )


def build_ai_phrase_check_block() -> str:
    """构造可拼接到诊断/体检 prompt 的「套话浓度」检查块。

    与 build_ai_phrase_rule_block（生成时规避）相对：本块用于评估场景——
    简历原文命中套话时作为「表达质量」类问题的证据，并在结论/建议里给出具体改法。
    """
    return (
        "\n\n【套话浓度检查】\n"
        "简历原文出现以下类型的套话 / AI 味表达时，视为表达质量问题的证据，"
        "并给出更具体的改法（原则：具体优于抽象——「将 p95 延迟从 2.1 秒降到 380 毫秒」"
        "远好于「显著提升系统性能」）：\n"
        "- 互联网黑话：赋能 / 抓手 / 闭环 / 打通 / 沉淀 / 链路 / 落地 / 助力\n"
        "- 无证据的自我评价套话：良好的沟通能力 / 团队协作精神 / 较强的学习能力 / 吃苦耐劳 / 充满热情\n"
        "- 虚词与形容词堆砌：有效地 / 全面地 / 强大的 / 丰富的 / 一站式 / 全方位\n"
        "- 否定排比句式：「不是…而是…」先否定再主张，应直接写正向事实\n"
        "- 英文简历同理：passionate about / results-oriented / proven track record / leveraged / robust"
    )


def replace_ai_phrases(text: str, locale: str = "zh") -> str:
    """本地后处理：按替换映射做硬替换。

    注意：比让 LLM 主动规避更生硬，只作为兜底（例如用户手动粘贴一段 AI 味文本时）。
    日常润色走 prompt 即可，不需要调这个。
    """
    replacements = get_ai_phrase_replacements(locale)
    result = text
    # 长词优先（避免短词误伤，例如"对齐"在"对齐方式"里）
    for phrase in sorted(replacements.keys(), key=len, reverse=True):
        replacement = replacements[phrase]
        if replacement and replacement != text:
            result = result.replace(phrase, replacement)
    return result
