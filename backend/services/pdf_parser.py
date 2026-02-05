"""
PDF 解析服务 - 优先使用 MinerU，失败时降级到 pdfminer
"""
from __future__ import annotations

import io
import os
import tempfile
import shutil
from typing import Optional

from pdfminer.high_level import extract_text

try:
    from mineru.cli.common import do_parse
    MINERU_AVAILABLE = True
except Exception:
    MINERU_AVAILABLE = False


def _extract_with_pdfminer(pdf_bytes: bytes) -> str:
    pdf_file = io.BytesIO(pdf_bytes)
    text = extract_text(pdf_file)
    return text.strip() if text else ""


def _extract_with_mineru(pdf_bytes: bytes) -> str:
    output_dir = tempfile.mkdtemp(prefix="mineru-output-")
    pdf_name = "resume"
    backend = os.getenv("MINERU_BACKEND", "hybrid-auto-engine")
    parse_method = os.getenv("MINERU_PARSE_METHOD", "auto")
    lang = os.getenv("MINERU_LANG", "ch")

    try:
        do_parse(
            output_dir=output_dir,
            pdf_file_names=[pdf_name],
            pdf_bytes_list=[pdf_bytes],
            p_lang_list=[lang],
            backend=backend,
            parse_method=parse_method,
            formula_enable=True,
            table_enable=True,
            f_draw_layout_bbox=False,
            f_draw_span_bbox=False,
            f_dump_md=True,
            f_dump_middle_json=False,
            f_dump_model_output=False,
            f_dump_orig_pdf=False,
            f_dump_content_list=False,
        )

        if backend.startswith("hybrid-"):
            md_dir = os.path.join(output_dir, pdf_name, f"hybrid_{parse_method}")
        elif backend.startswith("vlm-"):
            md_dir = os.path.join(output_dir, pdf_name, "vlm")
        else:
            md_dir = os.path.join(output_dir, pdf_name, parse_method)

        md_path = os.path.join(md_dir, f"{pdf_name}.md")
        if not os.path.exists(md_path):
            raise RuntimeError("MinerU 未生成 Markdown 结果")

        with open(md_path, "r", encoding="utf-8") as fp:
            return fp.read().strip()
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


def extract_markdown_from_pdf(pdf_bytes: bytes, use_mineru: bool = True) -> str:
    """
    从 PDF 字节流中提取文本内容

    Args:
        pdf_bytes: PDF 文件字节流
        use_mineru: 是否使用 MinerU（默认 True，优先保持高质量解析）

    说明：默认优先使用 MinerU，失败时降级为 pdfminer。
    """
    if use_mineru and MINERU_AVAILABLE:
        try:
            text = _extract_with_mineru(pdf_bytes)
            if text:
                return text
        except Exception:
            pass
    return _extract_with_pdfminer(pdf_bytes)
