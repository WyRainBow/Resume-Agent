"""
PDF 渲染路由 - 使用 LaTeX 生成专业简历 PDF
"""
import json
from io import BytesIO
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import RenderPDFRequest

router = APIRouter(prefix="/api", tags=["PDF"])

ROOT = Path(__file__).resolve().parents[2]


@router.post("/pdf/render")
async def render_pdf(body: RenderPDFRequest):
    """
    将简历 JSON 渲染为 PDF 并返回
    使用 LaTeX (xelatex) 生成专业排版的简历
    """
    resume_data = body.resume
    
    # demo 模式
    if hasattr(body, 'demo') and getattr(body, 'demo', False):
        demo_file = ROOT / 'test_resume_demo.json'
        if demo_file.exists():
            with open(demo_file, 'r', encoding='utf-8') as f:
                resume_data = json.load(f)
    
    # 使用 LaTeX 渲染
    try:
        from latex_generator import render_pdf_from_resume_latex
        pdf_io = render_pdf_from_resume_latex(resume_data, body.section_order)
        return StreamingResponse(pdf_io, media_type='application/pdf', headers={
            'Content-Disposition': 'inline; filename="resume.pdf"'
        })
    except Exception as e:
        print(f"[错误] LaTeX 渲染失败: {e}")
        raise HTTPException(status_code=500, detail=f"PDF 渲染失败: {e}")
