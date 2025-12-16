"""
PDF 渲染路由 - 使用 LaTeX 生成专业简历 PDF
"""
import json
import time
from io import BytesIO
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from ..models import RenderPDFRequest

router = APIRouter(prefix="/api", tags=["PDF"])

ROOT = Path(__file__).resolve().parents[2]


@router.post("/pdf/render")
async def render_pdf(body: RenderPDFRequest):
    """
    将简历 JSON 渲染为 PDF 并返回
    使用 LaTeX (xelatex) 生成专业排版的简历
    优化版本：快速渲染，使用缓存
    """
    import time
    start_time = time.time()

    resume_data = body.resume

    # 使用 LaTeX 渲染
    try:
        from ..latex_generator import render_pdf_from_resume_latex
        pdf_io = render_pdf_from_resume_latex(resume_data, body.section_order)

        render_time = time.time() - start_time
        print(f"[性能] PDF渲染完成，耗时: {render_time:.2f}秒")

        return StreamingResponse(pdf_io, media_type='application/pdf', headers={
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'X-Render-Time': str(render_time)
        })
    except Exception as e:
        print(f"[错误] LaTeX 渲染失败: {e}")
        raise HTTPException(status_code=500, detail=f"PDF 渲染失败: {e}")


@router.post("/pdf/render/stream")
async def render_pdf_stream(body: RenderPDFRequest):
    """
    流式渲染PDF，提供实时进度反馈
    """
    async def generate_pdf():
        resume_data = body.resume

        try:
            # 发送开始事件
            yield dict(event="start", data="开始生成PDF...")

            # 转换为 LaTeX
            from ..latex_generator import json_to_latex, compile_latex_to_pdf

            latex_start = time.time()
            yield dict(event="progress", data="正在生成LaTeX代码...")

            # 获取模板目录
            current_dir = Path(__file__).resolve().parent
            root_dir = current_dir.parents[1]  # Go up two levels to reach project root
            template_dir = root_dir / "LATEX"

            # 生成 LaTeX
            latex_content = json_to_latex(resume_data, body.section_order)
            latex_time = time.time() - latex_start
            yield dict(event="progress", data=f"LaTeX代码生成完成 ({latex_time:.1f}s)")

            # 编译PDF
            compile_start = time.time()
            yield dict(event="progress", data="正在编译PDF（可能需要几秒）...")

            try:
                pdf_io = compile_latex_to_pdf(latex_content, template_dir)
                compile_time = time.time() - compile_start
                yield dict(event="progress", data=f"PDF编译完成 ({compile_time:.1f}s)")

                # 发送PDF
                pdf_hex = pdf_io.getvalue().hex()
                yield dict(event="pdf", data=pdf_hex)
                print(f"[PDF] 成功生成PDF，大小: {len(pdf_hex)/2} 字节")

            except Exception as e:
                import traceback
                error_msg = f"LaTeX编译错误: {str(e)}\n{traceback.format_exc()}"
                print(f"[PDF错误] {error_msg}")
                yield dict(event="error", data=str(e))

        except Exception as e:
            yield dict(event="error", data=f"PDF生成失败: {str(e)}")

    return EventSourceResponse(generate_pdf())
