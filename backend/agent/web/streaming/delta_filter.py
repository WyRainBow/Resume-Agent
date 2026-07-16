"""流式 delta 出口的协议标记滤波（Wave A-4 / P0-2）。

delta 流把 LLM 原文逐段推给前端，[[MODULE_DONE:...]] / %%SUGGESTIONS%%...
这类内部协议标记会在打字机上闪现（跨 chunk 切开时甚至以残片形式出现，
Codex review P1-3）。post-loop 的 complete 有 strip，但那是"事后撤回"，
流式过程中用户已经看到了。

设计为**纯函数**：每次对"累积正文"全量重算——
- 已完整出现的标记直接删除；
- 尾部未闭合的标记（或标记锚被 chunk 切开后的前缀）截断扣住，
  下一个 chunk 到达后全量重算，标记闭合则删除。

**单调性契约**（Codex 终轮 review P1）：本函数的输出序列必须是前缀扩展
（每次输出都以上一次输出为前缀）——前端 appendChunk 无法撤回已显示
文本，任何"先放行后回缩"都会把协议残片留在气泡里直到 complete。因此
未闭合锚**一律扣住、没有超长放行**：协议字面量在正文中本就不该出现，
病态超长未闭合标记被扣的尾部由 post-loop 净化 complete（整体替换语义）
兜底，好于闪现残片。误扣的普通文本（正文恰好以 "[" / "%" 结尾）同理，
流式期最多延迟 1-2 字符显示，complete 补全。
"""

import re

# 完整标记：出现即删（与 optimize_progress._MODULE_DONE_RE / 前端
# stripInternalMarkers 的口径对齐，MODULE_DONE 大小写不敏感）
_COMPLETE_MARKERS = [
    re.compile(
        r"\[\[\s*MODULE_DONE\s*:\s*[A-Za-z]+\s*(?::\s*skip\s*)?\]\]",
        re.IGNORECASE,
    ),
    re.compile(r"%%SUGGESTIONS%%[\s\S]*?%%END%%"),
]

# 未闭合标记：文本中出现锚、但其后直到结尾都没有闭合符 → 从锚处截断扣住
_OPEN_ANCHORS = [
    (re.compile(r"\[\[\s*MODULE_DONE", re.IGNORECASE), "]]"),
    (re.compile(r"%%SUGGESTIONS%%"), "%%END%%"),
]

# 锚字面量（归一化形态）：尾部若是锚被 chunk 切开后的前缀也扣住。
# 归一化 = 去空白 + 大写，覆盖 "[[ module_done" / "[[ MODULE" 等合法变体
# （完整正则允许 [[ 后空白且大小写不敏感，前缀检测必须同口径，
# 否则 "[[ MODULE" 先放行、闭合后回缩——Codex 终轮 review P1-2）。
_ANCHOR_NORMALIZED = ["[[MODULE_DONE", "%%SUGGESTIONS%%"]
# 尾部回看窗口：锚字面 + 允许的少量空白
_TAIL_WINDOW = 24


def _tail_holdback_len(text: str) -> int:
    """返回尾部应扣住的字符数（0 = 无需扣）。

    从尾部窗口内每个可能的起点检查：该起点到结尾的子串，归一化（去空白+
    大写）后是否为某个锚字面量的非空前缀。取最靠前的命中（扣得最多）。
    """
    window_start = max(0, len(text) - _TAIL_WINDOW)
    for start in range(window_start, len(text)):
        ch = text[start]
        if ch not in "[%":
            continue
        candidate = re.sub(r"\s+", "", text[start:]).upper()
        if not candidate:
            continue
        for literal in _ANCHOR_NORMALIZED:
            if len(candidate) < len(literal) and literal.startswith(candidate):
                return len(text) - start
    return 0


def filter_streaming_markers(text: str) -> str:
    """对累积流式正文做协议标记滤波。纯函数、幂等、输出单调（前缀扩展）。"""
    if not text:
        return text

    for pattern in _COMPLETE_MARKERS:
        text = pattern.sub("", text)

    # 尾部未闭合锚：截断扣住（取最后一次出现；无超长放行,见模块 docstring）
    for anchor_re, closer in _OPEN_ANCHORS:
        last = None
        for last in anchor_re.finditer(text):
            pass
        if last is None:
            continue
        if closer not in text[last.start():]:
            text = text[: last.start()]

    # 尾部是锚字面被切开后的前缀（跨 chunk："…[[ modu" 等下一段）
    holdback = _tail_holdback_len(text)
    if holdback:
        return text[: len(text) - holdback]

    return text
