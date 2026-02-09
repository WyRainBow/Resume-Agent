"""
简历组装服务
根据 MinerU文本 + OCR文本 融合生成结构化 Resume JSON
使用 DeepSeek 作为文本模型，Prompt 模板来自 agent/prompt/pdf_parser.py

数据流（简化版）：
1. MinerU：PDF → Markdown（基础文本结构）
2. glm-ocr：PDF → Markdown（高质量 OCR + 结构识别）
3. DeepSeek：融合两路数据 → 结构化 JSON

说明：glm-ocr 的 Markdown 输出已包含完整的结构信息（标题层级、列表格式、
嵌套结构如 "## · xxx专项"、技能分类如 "后端：xxx"），DeepSeek 可从文本
直接推断格式特征，无需额外的布局骨架。
"""
from __future__ import annotations

import json
import os
import re
from typing import Dict, Any, Optional

from openai import OpenAI

try:
    from backend.agent.prompt.pdf_parser import (
        SYSTEM_PROMPT,
        OUTPUT_SCHEMA,
        DATA_FUSION_RULES,
        SECTION_MAPPING_RULES,
        HIGHLIGHTS_RULES,
        NESTED_RULES,
        SKILLS_RULES,
        FORMAT_RULES,
        ASSEMBLER_PROMPT,
    )
except ImportError:
    from agent.prompt.pdf_parser import (
        SYSTEM_PROMPT,
        OUTPUT_SCHEMA,
        DATA_FUSION_RULES,
        SECTION_MAPPING_RULES,
        HIGHLIGHTS_RULES,
        NESTED_RULES,
        SKILLS_RULES,
        FORMAT_RULES,
        ASSEMBLER_PROMPT,
    )


DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

_deepseek_client: Optional[OpenAI] = None
_last_key: Optional[str] = None


def _get_client() -> OpenAI:
    """仅从根目录 .env 读取 DEEPSEEK_API_KEY（main 启动时已 load_dotenv）"""
    global _deepseek_client, _last_key
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise ValueError("DEEPSEEK_API_KEY 未配置")
    if _deepseek_client is None or _last_key != key:
        _deepseek_client = OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)
        _last_key = key
    return _deepseek_client


def _strip_json_block(text: str) -> str:
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
    return cleaned.strip()


def _parse_json(text: str) -> Dict[str, Any]:
    cleaned = _strip_json_block(text)
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def _split_text_by_headings(text: str) -> Dict[str, str]:
    """
    按常见简历标题切分文本，减少跨模块混入
    """
    headings = [
        ("experience", ["实习经历", "工作经历", "工作经验"]),
        ("projects", ["项目经验", "项目经历"]),
        ("openSource", ["开源经历", "开源项目", "开源"]),
        ("skills", ["专业技能", "技能"]),
        ("education", ["教育经历", "教育背景"]),
        ("awards", ["获奖", "奖项", "荣誉"]),
    ]

    positions: Dict[str, tuple[int, str]] = {}
    for key, keywords in headings:
        for kw in keywords:
            idx = text.find(kw)
            if idx != -1:
                if key not in positions or idx < positions[key][0]:
                    positions[key] = (idx, kw)

    if not positions:
        return {}

    ordered = sorted(((idx, key, kw) for key, (idx, kw) in positions.items()), key=lambda x: x[0])
    segments: Dict[str, str] = {}
    for i, (start_idx, key, kw) in enumerate(ordered):
        end_idx = ordered[i + 1][0] if i + 1 < len(ordered) else len(text)
        segments[key] = text[start_idx:end_idx].strip()
    return segments


def _split_list_text(text: str) -> list[str]:
    if not isinstance(text, str):
        return []
    stripped = text.strip()
    if not stripped:
        return []
    if "<li" in stripped or "<ul" in stripped or "<ol" in stripped:
        return [stripped]
    lines = [line.strip() for line in stripped.splitlines() if line.strip()]
    if len(lines) > 1:
        return lines
    parts = [p.strip() for p in re.split(r"\s*(?:\d+[\.\、]|[•\-])\s+", stripped) if p.strip()]
    if len(parts) > 1:
        return parts
    return [stripped]


def _normalize_highlights(data: Dict[str, Any]) -> Dict[str, Any]:
    for section in ("internships", "projects"):
        items = data.get(section)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            highlights = item.get("highlights")
            if isinstance(highlights, str):
                item["highlights"] = _split_list_text(highlights)
            elif isinstance(highlights, list):
                normalized: list[str] = []
                for h in highlights:
                    if isinstance(h, str):
                        normalized.extend(_split_list_text(h))
                    elif h:
                        normalized.append(h)
                item["highlights"] = normalized
    open_source = data.get("openSource")
    if isinstance(open_source, list):
        for item in open_source:
            if not isinstance(item, dict):
                continue
            items = item.get("items")
            if isinstance(items, str):
                item["items"] = _split_list_text(items)
            elif isinstance(items, list):
                normalized_items: list[str] = []
                for it in items:
                    if isinstance(it, str):
                        normalized_items.extend(_split_list_text(it))
                    elif it:
                        normalized_items.append(it)
                item["items"] = normalized_items
    return data


def _extract_format_info(layout: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    从布局骨架中提取各section的格式信息
    """
    format_info = {}
    sections = layout.get("sections", [])
    for section in sections:
        section_type = section.get("type", "")
        section_format = section.get("format", {})
        if section_type:
            format_info[section_type] = {
                "list_style": section_format.get("list_style", "bullet"),
                "has_category": section_format.get("has_category", False),
                "has_nested_groups": section_format.get("has_nested_groups", False),
            }
            # 提取每个条目的嵌套结构信息
            items = section.get("items", [])
            nested_items = []
            for item in items:
                if isinstance(item, dict) and item.get("nested_structure"):
                    nested_items.append({
                        "name": item.get("name", ""),
                        "nested_structure": item.get("nested_structure", [])
                    })
            if nested_items:
                format_info[section_type]["nested_items"] = nested_items
    return format_info


def _build_data_sources_desc(raw_text: str, ocr_text: str, has_layout: bool) -> str:
    """构建多源数据说明"""
    lines = ["你有以下多个数据源（按精确度从高到低排列）："]
    idx = 0
    if ocr_text:
        idx += 1
        lines.append(f"{idx}. 【OCR文本】（glm-ocr 从 PDF 直接提取，格式最精确，内容最完整）")
    if raw_text:
        idx += 1
        lines.append(f"{idx}. 【MinerU文本】（Markdown 格式，保留了列表结构）")
    if has_layout:
        idx += 1
        lines.append(f"{idx}. 【布局骨架】（glm-4.6v 视觉识别，提供模块顺序和格式特征）")
    return "\n".join(lines)


def _build_data_content(
    raw_text: str,
    ocr_text: str,
    layout: Dict[str, Any],
    has_layout: bool,
    section_text: Dict[str, str],
) -> str:
    """
    构建各数据源的实际内容块
    
    数据源优先级：
    1. OCR文本（glm-ocr）：最精确，包含完整结构信息
    2. MinerU文本：快速提取，作为补充和校验
    3. 分区文本：辅助定位
    
    注意：布局骨架（glm-4.6v）已移除，DeepSeek 从文本直接推断结构
    """
    is_markdown = "##" in raw_text or "- " in raw_text or "* " in raw_text
    parts = []

    # 布局骨架（保留兼容性，但通常为空）
    if has_layout:
        parts.append(f"布局骨架（可选）：\n{json.dumps(layout, ensure_ascii=False)}")

    # OCR文本：主要数据源，包含结构信息如 "## · xxx专项"、"后端：xxx" 等
    if ocr_text:
        parts.append(f"OCR文本（glm-ocr，主要数据源，已包含结构信息）：\n{ocr_text}")

    # MinerU文本：补充数据源
    if raw_text:
        label = "MinerU文本（Markdown 格式，补充）" if is_markdown else "MinerU文本（纯文本，补充）"
        parts.append(f"{label}：\n{raw_text}")

    # 分区文本：辅助定位
    parts.append(f"分区文本（按标题切分，辅助定位）：\n{json.dumps(section_text, ensure_ascii=False)}")

    return "\n\n".join(parts)


def assemble_resume_data(
    raw_text: str,
    layout: Dict[str, Any],
    ocr_text: str = "",
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    混合增强组装：根据 MinerU文本 + OCR文本 生成简历 JSON

    使用 PromptTemplate 模板系统构建 prompt，确保：
    - system/user 角色分离
    - 规则模块化（独立的模板片段，便于维护）
    - 变量验证（缺少变量时快速报错）
    
    数据源优先级：OCR文本(最精确，含结构信息) > MinerU Markdown
    
    注意：layout 参数保留以兼容旧调用，但通常为空字典。
    DeepSeek 从 OCR/MinerU 的 Markdown 文本直接推断格式特征。
    """
    if not raw_text and not ocr_text:
        raise ValueError("原始文本为空（MinerU 和 OCR 均无输出）")
    
    # 布局骨架可以为空（降级处理）
    has_layout = layout and "sections" in layout and len(layout.get("sections", [])) > 0

    # 提取格式信息
    format_info = _extract_format_info(layout) if has_layout else {}

    # ---- 使用模板系统构建 prompt ----

    # 1) 数据源说明
    data_sources_desc = _build_data_sources_desc(raw_text, ocr_text, has_layout)

    # 2) 数据融合规则
    data_fusion_rules = DATA_FUSION_RULES.format()

    # 3) 模块归属规则
    layout_hint = (
        "布局骨架定义了模块顺序和条目顺序，必须严格保持。"
        if has_layout
        else "没有布局骨架，请根据文本内容自行判断模块划分。"
    )
    section_mapping_rules = SECTION_MAPPING_RULES.format(has_layout_hint=layout_hint)

    # 4) Highlights 规则
    highlights_rules = HIGHLIGHTS_RULES.format()

    # 5) 嵌套规则
    nested_rules = NESTED_RULES.format()

    # 6) 技能规则
    skills_rules = SKILLS_RULES.format()

    # 7) 格式保留规则
    format_hint = (
        f"- 参考布局骨架中的 format 信息：{json.dumps(format_info, ensure_ascii=False)}"
        if format_info
        else "- 请根据文本内容自行判断格式特征"
    )
    format_rules = FORMAT_RULES.format(format_info_hint=format_hint)

    # 8) 数据内容
    primary_text = ocr_text if ocr_text else raw_text
    section_text = _split_text_by_headings(primary_text)
    data_content = _build_data_content(raw_text, ocr_text, layout, has_layout, section_text)

    # 9) 组装最终 prompt
    user_prompt = ASSEMBLER_PROMPT.format(
        data_sources_desc=data_sources_desc,
        data_fusion_rules=data_fusion_rules,
        section_mapping_rules=section_mapping_rules,
        highlights_rules=highlights_rules,
        nested_rules=nested_rules,
        skills_rules=skills_rules,
        format_rules=format_rules,
        data_content=data_content,
        schema=OUTPUT_SCHEMA,
    )

    # ---- 调用 DeepSeek ----
    system_msg = SYSTEM_PROMPT.format()

    client = _get_client()
    response = client.chat.completions.create(
        model=model or DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=8000
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("DeepSeek 未返回简历 JSON")
    parsed = _parse_json(content)
    if isinstance(parsed, dict):
        parsed = _normalize_highlights(parsed)
        # 确保 format 字段存在
        if "format" not in parsed:
            parsed["format"] = format_info
    return parsed
