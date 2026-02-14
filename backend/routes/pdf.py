"""
PDF 渲染路由 - 使用 LaTeX 生成专业简历 PDF
"""
import time
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

try:
    from models import RenderPDFRequest
except ImportError:
    from backend.models import RenderPDFRequest

router = APIRouter(prefix="/api", tags=["PDF"])

def _resume_brief(resume_data):
    if not isinstance(resume_data, dict):
        return {"type": type(resume_data).__name__}
    return {
        "keys": list(resume_data.keys())[:20],
        "name": resume_data.get("name"),
        "has_basic": "basic" in resume_data,
        "has_experience": "experience" in resume_data,
        "has_projects": "projects" in resume_data,
    }

class CompileLatexRequest(BaseModel):
    """LaTeX 编译请求"""
    latex_content: str

@router.post("/pdf/render")
async def render_pdf(body: RenderPDFRequest, request: Request):
    """
    将简历 JSON 渲染为 PDF 并返回
    使用 LaTeX (xelatex) 生成专业排版的简历
    直接渲染 PDF（不使用缓存）
    """
    start_time = time.time()
    resume_data = body.resume
    trace_id = request.headers.get("X-PDF-Trace-Id") or f"backend-{int(start_time * 1000)}"
    trace_source = request.headers.get("X-PDF-Trace-Source") or "-"
    trace_trigger = request.headers.get("X-PDF-Trace-Trigger") or "-"
    client = request.client.host if request.client else "-"
    print(
        f"[PDF TRACE][render:request] trace_id={trace_id} source={trace_source} trigger={trace_trigger} "
        f"session_id={request.headers.get('X-Agent-Session-Id') or '-'} "
        f"resume_id={request.headers.get('X-Agent-Resume-Id') or '-'} client={client} "
        f"origin={request.headers.get('origin') or '-'} referer={request.headers.get('referer') or '-'} "
        f"section_order={body.section_order} resume_brief={_resume_brief(resume_data)}"
    )

    try:
        try:
            from backend.latex_generator import render_pdf_from_resume_latex
        except ImportError:
            from latex_generator import render_pdf_from_resume_latex
        pdf_io = render_pdf_from_resume_latex(resume_data, body.section_order)

        render_time = time.time() - start_time
        print(
            f"[PDF TRACE][render:done] trace_id={trace_id} elapsed={render_time:.2f}s "
            f"bytes={len(pdf_io.getvalue())}"
        )

        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'inline; filename="resume.pdf"',
                "X-Render-Time": str(render_time),
                "X-PDF-Trace-Id": trace_id,
            },
        )
    except Exception as e:
        print(f"[PDF TRACE][render:error] trace_id={trace_id} error={e}")
        raise HTTPException(status_code=500, detail=f"PDF 渲染失败: {e}")


@router.post("/pdf/render/stream")
async def render_pdf_stream(body: RenderPDFRequest, request: Request):
    """
    流式渲染PDF，提供实时进度反馈
    """

    session_id = request.headers.get("X-Agent-Session-Id")
    resume_id = request.headers.get("X-Agent-Resume-Id")
    trace_id = request.headers.get("X-PDF-Trace-Id") or f"backend-s-{int(time.time() * 1000)}"
    trace_source = request.headers.get("X-PDF-Trace-Source") or "-"
    trace_trigger = request.headers.get("X-PDF-Trace-Trigger") or "-"
    client = request.client.host if request.client else "-"

    async def generate_pdf():
        resume_data = body.resume
        print(
            f"[PDF TRACE][stream:request] trace_id={trace_id} source={trace_source} trigger={trace_trigger} "
            f"session_id={session_id or '-'} resume_id={resume_id or '-'} client={client} "
            f"origin={request.headers.get('origin') or '-'} referer={request.headers.get('referer') or '-'} "
            f"section_order={body.section_order} resume_brief={_resume_brief(resume_data)}"
        )

        try:
            # 发送开始事件
            print(f"[PDF TRACE][stream:start] trace_id={trace_id}")
            yield dict(event="start", data="开始生成PDF...")

            # 转换为 LaTeX
            try:
                from backend.latex_generator import json_to_latex, compile_latex_to_pdf
            except ImportError:
                from latex_generator import json_to_latex, compile_latex_to_pdf

            latex_start = time.time()
            yield dict(event="progress", data="正在生成LaTeX代码...")

            # 获取模板目录
            current_dir = Path(__file__).resolve().parent
            root_dir = current_dir.parents[1]  # Go up two levels to reach project root
            template_dir = root_dir / "latex-resume-template"

            # 生成 LaTeX
            latex_content = json_to_latex(resume_data, body.section_order)
            latex_time = time.time() - latex_start
            print(
                f"[PDF TRACE][stream:latex-ready] trace_id={trace_id} "
                f"elapsed={latex_time:.2f}s latex_chars={len(latex_content)}"
            )
            yield dict(event="progress", data=f"LaTeX代码生成完成 ({latex_time:.1f}s)")

            # 编译PDF
            compile_start = time.time()
            yield dict(event="progress", data="正在编译PDF（可能需要几秒）...")

            try:
                pdf_io = compile_latex_to_pdf(latex_content, template_dir, resume_data=resume_data)
                compile_time = time.time() - compile_start
                pdf_bytes = pdf_io.getvalue()
                print(
                    f"[PDF TRACE][stream:compile-done] trace_id={trace_id} "
                    f"elapsed={compile_time:.2f}s pdf_bytes={len(pdf_bytes)}"
                )
                yield dict(event="progress", data=f"PDF编译完成 ({compile_time:.1f}s)")

                # 发送PDF
                pdf_hex = pdf_bytes.hex()

                yield dict(event="pdf", data=pdf_hex)
                print(
                    f"[PDF TRACE][stream:done] trace_id={trace_id} session_id={session_id or '-'} "
                    f"resume_id={resume_id or '-'} size={len(pdf_hex)/2} bytes"
                )

            except Exception as e:
                import traceback
                error_msg = f"LaTeX编译错误: {str(e)}\n{traceback.format_exc()}"
                print(f"[PDF TRACE][stream:compile-error] trace_id={trace_id} detail={error_msg}")
                # 发送完整的错误信息（最多5000字符，避免过长）
                error_data = str(e) if len(str(e)) <= 5000 else str(e)[:5000] + "...(错误信息过长，已截断)"
                yield dict(event="error", data=error_data)

        except Exception as e:
            import traceback
            error_msg = f"PDF生成失败: {str(e)}\n{traceback.format_exc()}"
            print(f"[PDF TRACE][stream:error] trace_id={trace_id} detail={error_msg}")
            # 发送完整的错误信息（最多5000字符）
            error_data = str(e) if len(str(e)) <= 5000 else str(e)[:5000] + "...(错误信息过长，已截断)"
            yield dict(event="error", data=error_data)

    return EventSourceResponse(generate_pdf())


@router.post("/pdf/compile-latex")
async def compile_latex(body: CompileLatexRequest):
    """
    直接编译 LaTeX 源代码为 PDF
    使用 slager 原版样式（与 slager.link 完全一致）
    """
    start_time = time.time()
    
    try:
        try:
            from backend.latex_compiler import compile_latex_raw
        except ImportError:
            from latex_compiler import compile_latex_raw
        pdf_io = compile_latex_raw(body.latex_content)
        
        render_time = time.time() - start_time
        print(f"[LaTeX 编译] 完成，耗时: {render_time:.2f}秒")
        
        return StreamingResponse(pdf_io, media_type='application/pdf', headers={
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'X-Render-Time': str(render_time)
        })
    except Exception as e:
        import traceback
        error_msg = f"LaTeX 编译失败: {str(e)}"
        print(f"[错误] {error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/pdf/compile-latex/stream")
async def compile_latex_stream(body: CompileLatexRequest):
    """
    流式编译 LaTeX 源代码为 PDF，提供实时进度反馈
    """
    async def generate():
        try:
            yield dict(event="start", data="开始编译 LaTeX...")
            yield dict(event="progress", data="正在准备编译环境...")
            
            compile_start = time.time()
            
            try:
                from backend.latex_compiler import compile_latex_raw
            except ImportError:
                from latex_compiler import compile_latex_raw
            yield dict(event="progress", data="正在编译 PDF（可能需要几秒）...")
            
            pdf_io = compile_latex_raw(body.latex_content)
            compile_time = time.time() - compile_start
            
            yield dict(event="progress", data=f"PDF 编译完成 ({compile_time:.1f}s)")
            
            # 发送 PDF 数据
            pdf_hex = pdf_io.getvalue().hex()
            yield dict(event="pdf", data=pdf_hex)
            print(f"[LaTeX 编译] 成功，大小: {len(pdf_hex)/2} 字节")
            
        except Exception as e:
            import traceback
            error_msg = f"LaTeX 编译错误: {str(e)}"
            print(f"[错误] {error_msg}\n{traceback.format_exc()}")
            # 发送完整的错误信息（最多5000字符）
            error_data = str(e) if len(str(e)) <= 5000 else str(e)[:5000] + "...(错误信息过长，已截断)"
            yield dict(event="error", data=error_data)
    
    return EventSourceResponse(generate())
