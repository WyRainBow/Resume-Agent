"""将 LLM 输出的 Markdown/纯文本规范为简历富文本 HTML（无序列表 + strong）。"""

from __future__ import annotations

import re
from typing import List, Optional

# cv_editor 写回的叶子字段
RICH_TEXT_FIELD_SUFFIXES = (
    "details",
    "description",
    "skillContent",
    "selfEvaluation",
    "summary",
    "highlights",
    "content",
)

_ORDERED_LINE_RE = re.compile(r"^\d+\.\s+")
_BULLET_LINE_RE = re.compile(r"^[-•*]\s+")
_BOLD_TITLE_RE = re.compile(r"^\*\*(.+?)\*\*$")
_MAX_TITLE_LEN = 48


def is_richtext_path(path: str) -> bool:
    if not path:
        return False
    leaf = path.split(".")[-1].split("[")[0]
    return leaf in RICH_TEXT_FIELD_SUFFIXES


def _inline_markup(text: str) -> str:
    s = text.strip()
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", s)
    # 去掉标题里残留的序号，如 <strong>1. 高风险SQL</strong>
    s = re.sub(
        r"(<strong>)(\d+\.\s*)",
        r"\1",
        s,
    )
    return s


def _strip_list_prefix(line: str) -> str:
    s = line.strip()
    s = _ORDERED_LINE_RE.sub("", s)
    s = _BULLET_LINE_RE.sub("", s)
    return s.strip()


def _is_list_item_title(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if _ORDERED_LINE_RE.match(s):
        inner = _ORDERED_LINE_RE.sub("", s).strip()
        return len(inner) <= _MAX_TITLE_LEN
    if _BULLET_LINE_RE.match(s):
        return False
    m = _BOLD_TITLE_RE.match(s)
    if m:
        title = m.group(1).strip()
        return len(title) <= _MAX_TITLE_LEN
    return False


def _merge_title_body(title_line: str, body_lines: List[str]) -> str:
    title = _inline_markup(_strip_list_prefix(title_line))
    body = " ".join(x.strip() for x in body_lines if x.strip())
    body = _inline_markup(body) if body else ""
    if body:
        # 标题与正文同一 li，用冒号衔接（与前端技能条一致）
        if title.startswith("<strong>") and title.endswith("</strong>"):
            return f"<li><p>{title}：{body}</p></li>"
        return f"<li><p><strong>{title}</strong>：{body}</p></li>"
    return f"<li><p>{title}</p></li>"


def _expand_inline_numbered_items(text: str) -> str:
    """把同一行里内嵌的「1. 2. 3.」「· 子项」拆成多行，避免合并成单个 li。"""
    if not text:
        return text
    s = text.replace("\r\n", "\n")
    s = re.sub(r"([：:])\s*(\d+\.\s+)", r"\1\n\2", s)
    s = re.sub(r"([。；;])\s*(\d+\.\s+)", r"\1\n\2", s)
    s = re.sub(r"(?<!\n)(\d+\.\s+)", r"\n\1", s)
    s = re.sub(r"\s*·\s+", r"\n- ", s)
    s = re.sub(r"\s+[-•]\s+", r"\n- ", s)
    return _expand_semicolon_items(s)


def _expand_semicolon_items(text: str) -> str:
    """把「A；B；C」式长句拆成多行列表项（常见于 LLM 一段写满）。"""
    if not text or text.count("；") < 2:
        return text
    parts = [p.strip() for p in text.split("；") if p.strip()]
    if len(parts) < 2:
        return text
    if not all(len(p) >= 6 for p in parts):
        return text
    # 首段若是引导语（如「核心成果如下」），保留为独立行
    lines: List[str] = []
    for i, part in enumerate(parts):
        if i == 0 and re.search(r"(如下|包括|主要有|分别为)\s*$", part):
            lines.append(part)
            continue
        lines.append(f"- {part}")
    return "\n".join(lines)


def html_to_context_text(html: str) -> str:
    """HTML 富文本 → 多行纯文本（保留列表结构，供 Hybrid 读取注入）。"""
    if not html or not isinstance(html, str):
        return ""
    if not re.search(r"<[a-z][^>]*>", html, re.I):
        return html.strip()

    text = html
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"</div>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>\s*<p[^>]*>", "\n- ", text, flags=re.I)
    text = re.sub(r"</p>\s*</li>", "", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "\n- ", text, flags=re.I)
    text = re.sub(r"</li>", "", text, flags=re.I)
    text = re.sub(r"</ul>|</ol>", "\n", text, flags=re.I)
    text = re.sub(r"<strong[^>]*>", "**", text, flags=re.I)
    text = re.sub(r"</strong>", "**", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = text.replace("&lt;", "<").replace("&gt;", ">")

    lines: List[str] = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]{2,}", " ", line).strip()
        if not line:
            continue
        if lines and lines[-1] == line:
            continue
        lines.append(line)
    return "\n".join(lines)


def plain_text_to_resume_html(text: str) -> str:
    """Markdown/纯文本 → 简历 HTML（无序列表 custom-list，禁止有序列表）。"""
    if not text or not isinstance(text, str):
        return text

    raw = _expand_inline_numbered_items(text.strip())
    if not raw:
        return raw

    # 已是带 custom-list 的 HTML，仅做 ** → strong 兜底
    if re.search(r"<ul[^>]*class=[\"'][^\"']*custom-list", raw, re.I):
        return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", raw)

    # 已有 HTML 结构：保留标签，转换残留 Markdown
    if re.search(r"</?(?:p|ul|ol|li|strong|em)\b", raw, re.I):
        converted = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", raw)
        converted = re.sub(r"<ol\b", "<ul class=\"custom-list\"", converted, flags=re.I)
        converted = re.sub(r"</ol>", "</ul>", converted, flags=re.I)
        return converted

    lines = raw.split("\n")
    html_parts: List[str] = []
    list_items: List[str] = []
    intro_lines: List[str] = []
    i = 0

    def flush_list() -> None:
        nonlocal list_items
        if list_items:
            html_parts.append(
                '<ul class="custom-list">' + "".join(list_items) + "</ul>"
            )
            list_items = []

    def flush_intro() -> None:
        nonlocal intro_lines
        if intro_lines:
            para = _inline_markup(" ".join(intro_lines))
            html_parts.append(f"<p>{para}</p>")
            intro_lines = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # 无序/有序行 → 列表项（统一用 ul）
        if _ORDERED_LINE_RE.match(stripped) or _BULLET_LINE_RE.match(stripped):
            flush_intro()
            content = _inline_markup(_strip_list_prefix(stripped))
            list_items.append(f"<li><p>{content}</p></li>")
            i += 1
            continue

        # **小标题** 单独一行 + 后续正文
        if _is_list_item_title(stripped):
            flush_intro()
            body: List[str] = []
            j = i + 1
            while j < len(lines):
                nxt = lines[j].strip()
                if not nxt:
                    j += 1
                    continue
                if _is_list_item_title(nxt) or _ORDERED_LINE_RE.match(
                    nxt
                ) or _BULLET_LINE_RE.match(nxt):
                    break
                body.append(nxt)
                j += 1
            list_items.append(_merge_title_body(stripped, body))
            i = j
            continue

        # 列表项续行（正文未与标题合并时兜底）
        if list_items:
            cont = _inline_markup(stripped)
            last = list_items[-1]
            if last.endswith("</p></li>"):
                list_items[-1] = last.replace(
                    "</p></li>",
                    f"{cont}</p></li>",
                    1,
                )
            else:
                list_items[-1] = last + f"<p>{cont}</p>"
            i += 1
            continue

        intro_lines.append(stripped)
        i += 1

    flush_intro()
    flush_list()

    if not html_parts:
        return f"<p>{_inline_markup(raw)}</p>"

    return "".join(html_parts)


def normalize_editor_value(value: object, path: str = "") -> object:
    """写回前规范化富文本；非字符串或非富文本路径则原样返回。"""
    if not isinstance(value, str):
        return value
    if path and not is_richtext_path(path):
        return value
    if not path and "<" not in value and "**" not in value:
        return value
    return plain_text_to_resume_html(value)
