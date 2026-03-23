"""Prompt helpers for simple edit fast-path acknowledgement."""

from __future__ import annotations

from typing import Any, Dict


def build_simple_edit_fast_path_message(payload: Dict[str, Any]) -> str:
    """Build deterministic two-line Thought/Response for simple edits."""
    field = str(payload.get("field") or "").strip().lower()
    path = str(payload.get("path") or "").strip().lower()
    value = str(payload.get("value") or "").strip()
    index = payload.get("index")

    is_name = field == "name" or path == "basic.name"
    is_company = field == "company" or ".company" in path

    if is_name:
        thought = f"我识别到你要把简历姓名改为“{value}”，将直接执行字段更新。"
    elif is_company and index is not None:
        thought = (
            f"我识别到你要修改第{int(index) + 1}段实习/工作公司的名称，"
            "将直接执行字段更新。"
        )
    else:
        thought = "我识别到你要做简历字段修改，将直接执行编辑并返回前后对比。"

    response = "收到，正在修改。完成后我会给你“修改前 / 修改后”的对比结果。"
    return f"Thought: {thought}\nResponse: {response}"
