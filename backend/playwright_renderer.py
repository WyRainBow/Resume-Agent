"""
Playwright PDF 渲染器
使用 HTML/CSS 生成 PDF，速度比 LaTeX 快 20 倍以上
"""
from typing import Dict, Any, List, Optional
from io import BytesIO
from playwright.async_api import async_playwright
import time
import asyncio

# HTML 模板
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            padding: 40px 50px;
        }
        
        /* 头部：姓名和联系方式 */
        .header {
            text-align: center;
            margin-bottom: 16px;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
        }
        
        .name {
            font-size: 22pt;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .contact {
            font-size: 10pt;
            color: #555;
        }
        
        .contact span {
            margin: 0 8px;
        }
        
        /* 章节 */
        .section {
            margin-bottom: 14px;
        }
        
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            border-bottom: 1px solid #ccc;
            padding-bottom: 4px;
            margin-bottom: 8px;
        }
        
        /* 条目 */
        .entry {
            margin-bottom: 10px;
        }
        
        .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 4px;
        }
        
        .entry-title {
            font-weight: bold;
            font-size: 10.5pt;
        }
        
        .entry-subtitle {
            color: #555;
            font-size: 10pt;
        }
        
        .entry-date {
            color: #666;
            font-size: 9pt;
            white-space: nowrap;
        }
        
        /* 列表 */
        .highlights {
            padding-left: 18px;
            margin-top: 4px;
        }
        
        .highlights li {
            margin-bottom: 2px;
            font-size: 9.5pt;
        }
        
        /* 技能 */
        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px 12px;
            list-style: none;
            padding: 0;
        }
        
        .skills-list li {
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 9.5pt;
        }
        
        /* 荣誉 */
        .awards-list {
            padding-left: 18px;
        }
        
        .awards-list li {
            margin-bottom: 2px;
            font-size: 9.5pt;
        }
        
        /* 个人总结 */
        .summary {
            font-size: 9.5pt;
            text-align: justify;
        }
    </style>
</head>
<body>
    {content}
</body>
</html>
"""


def generate_html_content(resume_data: Dict[str, Any], section_order: Optional[List[str]] = None) -> str:
    """将简历 JSON 转换为 HTML 内容"""
    
    # 默认顺序
    default_order = ['education', 'experience', 'internships', 'projects', 'skills', 'awards', 'summary']
    order = section_order if section_order else default_order
    
    html_parts = []
    
    # 头部：姓名和联系方式
    name = resume_data.get('name', '')
    contact = resume_data.get('contact', {})
    phone = contact.get('phone', '') if isinstance(contact, dict) else ''
    email = contact.get('email', '') if isinstance(contact, dict) else ''
    location = resume_data.get('location', '北京市')
    
    header_html = f'''
    <div class="header">
        <div class="name">{name}</div>
        <div class="contact">
            <span>{phone}</span> · <span>{email}</span> · <span>{location}</span>
        </div>
    </div>
    '''
    html_parts.append(header_html)
    
    # 按顺序生成各模块
    section_generators = {
        'education': generate_education_html,
        'experience': generate_experience_html,
        'internships': generate_internships_html,
        'projects': generate_projects_html,
        'skills': generate_skills_html,
        'awards': generate_awards_html,
        'summary': generate_summary_html,
        'opensource': generate_opensource_html,
    }
    
    for section_type in order:
        if section_type in section_generators:
            section_html = section_generators[section_type](resume_data)
            if section_html:
                html_parts.append(section_html)
    
    return '\n'.join(html_parts)


def generate_education_html(resume_data: Dict[str, Any]) -> str:
    """生成教育经历 HTML"""
    education = resume_data.get('education', [])
    if not education:
        return ''
    
    entries = []
    for edu in education:
        if isinstance(edu, dict):
            school = edu.get('school', '')
            major = edu.get('major', '')
            degree = edu.get('degree', '')
            date = edu.get('date', '')
            
            entry = f'''
            <div class="entry">
                <div class="entry-header">
                    <div>
                        <span class="entry-title">{school}</span>
                        <span class="entry-subtitle"> - {degree} · {major}</span>
                    </div>
                    <span class="entry-date">{date}</span>
                </div>
            </div>
            '''
            entries.append(entry)
    
    if not entries:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">教育经历</div>
        {''.join(entries)}
    </div>
    '''


def generate_experience_html(resume_data: Dict[str, Any]) -> str:
    """生成工作经历 HTML（使用 internships 数据）"""
    return generate_internships_html(resume_data)


def generate_internships_html(resume_data: Dict[str, Any]) -> str:
    """生成实习/工作经历 HTML"""
    internships = resume_data.get('internships', [])
    if not internships:
        return ''
    
    entries = []
    for intern in internships:
        if isinstance(intern, dict):
            title = intern.get('title', '')
            subtitle = intern.get('subtitle', '')
            date = intern.get('date', '')
            highlights = intern.get('highlights', [])
            
            highlights_html = ''
            if highlights:
                items = ''.join([f'<li>{h}</li>' for h in highlights if h])
                if items:
                    highlights_html = f'<ul class="highlights">{items}</ul>'
            
            entry = f'''
            <div class="entry">
                <div class="entry-header">
                    <div>
                        <span class="entry-title">{title}</span>
                        <span class="entry-subtitle"> - {subtitle}</span>
                    </div>
                    <span class="entry-date">{date}</span>
                </div>
                {highlights_html}
            </div>
            '''
            entries.append(entry)
    
    if not entries:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">工作经历</div>
        {''.join(entries)}
    </div>
    '''


def generate_projects_html(resume_data: Dict[str, Any]) -> str:
    """生成项目经历 HTML"""
    projects = resume_data.get('projects', [])
    if not projects:
        return ''
    
    entries = []
    for proj in projects:
        if isinstance(proj, dict):
            title = proj.get('title', '')
            subtitle = proj.get('subtitle', '')
            date = proj.get('date', '')
            highlights = proj.get('highlights', [])
            
            highlights_html = ''
            if highlights:
                items = ''.join([f'<li>{h}</li>' for h in highlights if h])
                if items:
                    highlights_html = f'<ul class="highlights">{items}</ul>'
            
            entry = f'''
            <div class="entry">
                <div class="entry-header">
                    <div>
                        <span class="entry-title">{title}</span>
                        <span class="entry-subtitle"> - {subtitle}</span>
                    </div>
                    <span class="entry-date">{date}</span>
                </div>
                {highlights_html}
            </div>
            '''
            entries.append(entry)
    
    if not entries:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">项目经历</div>
        {''.join(entries)}
    </div>
    '''


def generate_skills_html(resume_data: Dict[str, Any]) -> str:
    """生成专业技能 HTML"""
    skills = resume_data.get('skills', [])
    if not skills:
        return ''
    
    items = ''.join([f'<li>{s}</li>' for s in skills if s])
    if not items:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">专业技能</div>
        <ul class="skills-list">{items}</ul>
    </div>
    '''


def generate_awards_html(resume_data: Dict[str, Any]) -> str:
    """生成荣誉奖项 HTML"""
    awards = resume_data.get('awards', [])
    if not awards:
        return ''
    
    items = ''.join([f'<li>{a}</li>' for a in awards if a])
    if not items:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">荣誉奖项</div>
        <ul class="awards-list">{items}</ul>
    </div>
    '''


def generate_summary_html(resume_data: Dict[str, Any]) -> str:
    """生成个人总结 HTML"""
    summary = resume_data.get('summary', '')
    if not summary:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">个人总结</div>
        <p class="summary">{summary}</p>
    </div>
    '''


def generate_opensource_html(resume_data: Dict[str, Any]) -> str:
    """生成开源项目 HTML"""
    opensource = resume_data.get('openSource', [])
    if not opensource:
        return ''
    
    entries = []
    for proj in opensource:
        if isinstance(proj, dict):
            name = proj.get('name', '')
            url = proj.get('url', '')
            description = proj.get('description', '')
            
            entry = f'''
            <div class="entry">
                <div class="entry-header">
                    <span class="entry-title">{name}</span>
                    <span class="entry-subtitle">{url}</span>
                </div>
                <p style="font-size: 9.5pt; margin-top: 2px;">{description}</p>
            </div>
            '''
            entries.append(entry)
    
    if not entries:
        return ''
    
    return f'''
    <div class="section">
        <div class="section-title">开源项目</div>
        {''.join(entries)}
    </div>
    '''


# Playwright 浏览器实例（复用以提升性能）
_browser = None
_playwright_instance = None


async def get_browser_async():
    """获取或创建 Playwright 浏览器实例（异步）"""
    global _browser, _playwright_instance
    if _browser is None:
        _playwright_instance = await async_playwright().start()
        _browser = await _playwright_instance.chromium.launch(headless=True)
    return _browser


async def render_pdf_playwright_async(resume_data: Dict[str, Any], section_order: Optional[List[str]] = None) -> BytesIO:
    """
    使用 Playwright 渲染 PDF（异步版本）
    
    参数:
        resume_data: 简历数据字典
        section_order: 自定义 section 顺序列表
    
    返回:
        PDF 文件的 BytesIO 对象
    """
    total_start = time.time()
    
    # 生成 HTML
    html_start = time.time()
    content = generate_html_content(resume_data, section_order)
    html = HTML_TEMPLATE.replace('{content}', content)
    html_time = time.time() - html_start
    print(f"[Playwright] HTML 生成: {html_time*1000:.0f}ms")
    
    # 渲染 PDF
    render_start = time.time()
    browser = await get_browser_async()
    page = await browser.new_page()
    
    try:
        await page.set_content(html, wait_until='networkidle')
        pdf_bytes = await page.pdf(
            format='A4',
            margin={
                'top': '0',
                'right': '0',
                'bottom': '0',
                'left': '0'
            },
            print_background=True
        )
    finally:
        await page.close()
    
    render_time = time.time() - render_start
    print(f"[Playwright] PDF 渲染: {render_time*1000:.0f}ms")
    
    total_time = time.time() - total_start
    print(f"[Playwright] 总耗时: {total_time*1000:.0f}ms")
    
    pdf_io = BytesIO(pdf_bytes)
    pdf_io.seek(0)
    return pdf_io


async def cleanup_browser_async():
    """清理浏览器资源（异步）"""
    global _browser, _playwright_instance
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright_instance:
        await _playwright_instance.stop()
        _playwright_instance = None
