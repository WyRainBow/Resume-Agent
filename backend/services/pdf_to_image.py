"""
PDF 转图片服务
将 PDF 页面渲染为 PNG 图片字节流
"""
from __future__ import annotations

import io

import fitz  # PyMuPDF


def pdf_first_page_to_png_bytes(pdf_bytes: bytes, dpi: int = 150) -> bytes:
    """
    将 PDF 首页转为 PNG 图片字节流
    """
    if not pdf_bytes:
        raise ValueError("PDF 内容为空")

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        if doc.page_count == 0:
            raise ValueError("PDF 无可用页面")
        page = doc.load_page(0)
        zoom = dpi / 72
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        return pix.tobytes("png")


def pdf_pages_to_png_bytes(
    pdf_bytes: bytes,
    dpi: int = 150,
    max_pages: int | None = None,
) -> list[bytes]:
    """
    将 PDF 多页转为 PNG 图片字节流列表（按页顺序）
    """
    if not pdf_bytes:
        raise ValueError("PDF 内容为空")

    images: list[bytes] = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        if doc.page_count == 0:
            raise ValueError("PDF 无可用页面")
        page_count = doc.page_count if max_pages is None else min(doc.page_count, max_pages)
        zoom = dpi / 72
        matrix = fitz.Matrix(zoom, zoom)
        for page_index in range(page_count):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            images.append(pix.tobytes("png"))
    return images
