"""
PDF 解析服务 - 使用 pdfminer 提取 PDF 文本
"""
from __future__ import annotations

import io
from pdfminer.high_level import extract_text


def extract_markdown_from_pdf(pdf_bytes: bytes) -> str:
    """
    从 PDF 字节流中提取文本内容
    
    Args:
        pdf_bytes: PDF 文件的字节内容
        
    Returns:
        提取的文本内容
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        text = extract_text(pdf_file)
        return text.strip() if text else ""
    except Exception as e:
        raise RuntimeError(f"PDF 文本提取失败: {e}")
