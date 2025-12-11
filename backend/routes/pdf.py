"""
PDF 渲染路由
"""
import json
from io import BytesIO
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem

from models import RenderPDFRequest

router = APIRouter(prefix="/api", tags=["PDF"])

ROOT = Path(__file__).resolve().parents[2]


def render_pdf_from_resume_reportlab(resume_data: Dict[str, Any]) -> BytesIO:
    """使用 ReportLab 渲染 PDF（兼容旧/新两种结构）"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(name='Title', parent=styles['Title'], fontSize=20, spaceAfter=8)
    h_style = ParagraphStyle(name='Heading', parent=styles['Heading2'], textColor=colors.HexColor('#333333'), spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle(name='Body', parent=styles['BodyText'], leading=16)

    story: List[Any] = []

    # 姓名
    name = (resume_data.get('name') or '姓名')
    story.append(Paragraph(str(name), title_style))

    # 联系方式
    contact = resume_data.get('contact') or {}
    contact_line_parts: List[str] = []
    for k in ['email', 'phone', 'location', 'role']:
        v = contact.get(k)
        if isinstance(v, str) and v.strip():
            contact_line_parts.append(v.strip())
    contact_line = " · ".join(contact_line_parts)
    if contact_line:
        story.append(Paragraph(contact_line, body_style))
        story.append(Spacer(1, 8))

    # 个人简介
    summary = resume_data.get('summary')
    if isinstance(summary, str) and summary.strip():
        story.append(Paragraph('个人简介', h_style))
        story.append(Paragraph(summary.strip(), body_style))

    # 实习经历
    internships = resume_data.get('internships') or []
    if isinstance(internships, list) and internships:
        story.append(Paragraph('实习经历', h_style))
        for it in internships:
            title = it.get('title') or ''
            subtitle = it.get('subtitle') or ''
            date = it.get('date') or ''
            header = " - ".join([s for s in [title, subtitle] if s])
            if header:
                story.append(Paragraph(header, body_style))
            if date:
                story.append(Paragraph(str(date), body_style))
            details = it.get('details') or it.get('highlights') or []
            if isinstance(details, list) and details:
                items = [ListItem(Paragraph(str(d), body_style)) for d in details]
                story.append(ListFlowable(items, bulletType='bullet', start='circle'))

    # 工作经历
    exp = resume_data.get('experience') or []
    if isinstance(exp, list) and exp:
        story.append(Paragraph('工作经历', h_style))
        for e in exp:
            header = " - ".join([v for v in [e.get('company'), e.get('position'), e.get('duration')] if v])
            if header:
                story.append(Paragraph(header, body_style))
            ach = e.get('achievements') or []
            if isinstance(ach, list) and ach:
                items = [ListItem(Paragraph(str(a), body_style)) for a in ach]
                story.append(ListFlowable(items, bulletType='bullet', start='circle'))

    # 项目经历
    projects = resume_data.get('projects') or []
    if isinstance(projects, list) and projects:
        story.append(Paragraph('项目经历', h_style))
        for p in projects:
            header = p.get('title') or " - ".join([v for v in [p.get('name'), p.get('role')] if v])
            if header:
                story.append(Paragraph(str(header), body_style))

            if isinstance(p.get('items'), list) and p['items']:
                for sub in p['items']:
                    st = sub.get('title')
                    if st:
                        story.append(Paragraph(str(st), body_style))
                    details = sub.get('details') or []
                    if isinstance(details, list) and details:
                        items = [ListItem(Paragraph(str(d), body_style)) for d in details]
                        story.append(ListFlowable(items, bulletType='bullet'))
            else:
                highlights = p.get('highlights') or []
                if isinstance(highlights, list) and highlights:
                    items = [ListItem(Paragraph(str(h), body_style)) for h in highlights]
                    story.append(ListFlowable(items, bulletType='bullet'))

    # 技能
    skills = resume_data.get('skills') or []
    if skills:
        story.append(Paragraph('专业技能', h_style))
        if all(isinstance(s, str) for s in skills):
            story.append(Paragraph("、".join(skills), body_style))
        else:
            for s in skills:
                if isinstance(s, dict):
                    cat = s.get('category') or ''
                    det = s.get('details') or ''
                    line = (f"{cat}: {det}").strip(': ')
                    if line:
                        story.append(Paragraph(line, body_style))

    # 教育经历
    edu = resume_data.get('education') or []
    if isinstance(edu, list) and edu:
        story.append(Paragraph('教育经历', h_style))
        for ed in edu:
            header = ed.get('title') or " - ".join([v for v in [ed.get('school'), ed.get('degree'), ed.get('duration')] if v])
            if header:
                story.append(Paragraph(str(header), body_style))
            extra = ed.get('honors') or ed.get('major')
            if extra:
                story.append(Paragraph(str(extra), body_style))

    # 奖项
    awards = resume_data.get('awards') or []
    if isinstance(awards, list) and awards:
        story.append(Paragraph('奖项', h_style))
        for a in awards:
            if isinstance(a, str):
                story.append(Paragraph(a, body_style))
            elif isinstance(a, dict):
                header = " - ".join([v for v in [a.get('title'), a.get('issuer'), a.get('date')] if v])
                if header:
                    story.append(Paragraph(str(header), body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer


@router.post("/pdf/render")
async def render_pdf(body: RenderPDFRequest):
    """将简历 JSON 渲染为 PDF 并返回"""
    resume_data = body.resume
    
    # demo 模式
    if hasattr(body, 'demo') and getattr(body, 'demo', False):
        demo_file = ROOT / 'test_resume_demo.json'
        if demo_file.exists():
            with open(demo_file, 'r', encoding='utf-8') as f:
                resume_data = json.load(f)
    
    engine = getattr(body, 'engine', 'playwright') or 'playwright'
    
    # Playwright 渲染
    if engine == 'playwright':
        try:
            from playwright_renderer import render_pdf_playwright_async
            pdf_io = await render_pdf_playwright_async(resume_data, body.section_order)
            return StreamingResponse(pdf_io, media_type='application/pdf', headers={
                'Content-Disposition': 'inline; filename="resume.pdf"'
            })
        except Exception as e:
            print(f"[警告] Playwright 渲染失败，回退到 LaTeX: {e}")
            engine = 'latex'
    
    # LaTeX 渲染
    if engine == 'latex':
        try:
            from latex_generator import render_pdf_from_resume_latex
            pdf_io = render_pdf_from_resume_latex(resume_data, body.section_order)
            return StreamingResponse(pdf_io, media_type='application/pdf', headers={
                'Content-Disposition': 'inline; filename="resume.pdf"'
            })
        except Exception as e:
            # 回退到 ReportLab
            try:
                pdf_io = render_pdf_from_resume_reportlab(body.resume)
                return StreamingResponse(pdf_io, media_type='application/pdf', headers={
                    'Content-Disposition': 'inline; filename="resume.pdf"'
                })
            except Exception as fallback_error:
                raise HTTPException(status_code=500, detail=f"PDF 渲染失败: {e}")
    
    raise HTTPException(status_code=400, detail=f"不支持的渲染引擎: {engine}")
