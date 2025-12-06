"""
LaTeX 简历生成模块
将简历 JSON 转换为 LaTeX 代码，并编译为 PDF
"""
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, List
from io import BytesIO


def escape_latex(text: str) -> str:
    """
    转义 LaTeX 特殊字符
    """
    if not isinstance(text, str):
        text = str(text)
    
    """LaTeX 特殊字符转义"""
    replacements = {
        '\\': r'\textbackslash{}',
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '^': r'\textasciicircum{}',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
    }
    
    result = text
    for char, replacement in replacements.items():
        result = result.replace(char, replacement)
    
    return result


def json_to_latex(resume_data: Dict[str, Any]) -> str:
    """
    将简历 JSON 转换为 LaTeX 代码
    
    参数:
        resume_data: 简历数据字典
    
    返回:
        LaTeX 代码字符串
    """
    """获取 LaTeX 模板目录路径"""
    current_dir = Path(__file__).resolve().parent
    root_dir = current_dir.parent
    latex_template_dir = root_dir / "Latex 简历演示"
    
    """构建 LaTeX 文档"""
    latex_content = []
    
    """文档头部"""
    latex_content.append(r"% !TEX TS-program = xelatex")
    latex_content.append(r"% !TEX encoding = UTF-8 Unicode")
    latex_content.append(r"% !Mode:: ""TeX:UTF-8""")
    latex_content.append("")
    latex_content.append(r"\documentclass{resume}")
    """使用中文字体配置"""
    latex_content.append(r"\usepackage{zh_CN-Adobefonts_external}")
    latex_content.append(r"\usepackage{linespacing_fix}")
    latex_content.append(r"\usepackage{cite}")
    """确保中文字体正确加载和 Unicode 支持"""
    latex_content.append(r"\XeTeXlinebreaklocale ""zh""")
    latex_content.append(r"\XeTeXlinebreakskip = 0pt plus 1pt")
    """强制使用 Unicode 编码"""
    latex_content.append(r"\XeTeXinputencoding ""utf8""")
    latex_content.append("")
    latex_content.append(r"\begin{document}")
    latex_content.append(r"\pagenumbering{gobble}")
    latex_content.append("")
    
    """姓名"""
    name = resume_data.get('name') or '姓名'
    latex_content.append(f"\\name{{{escape_latex(name)}}}")
    latex_content.append("")
    
    """联系信息"""
    contact = resume_data.get('contact') or {}
    phone = escape_latex(contact.get('phone') or '')
    email = escape_latex(contact.get('email') or '')
    role = escape_latex(contact.get('role') or '')
    location = escape_latex(contact.get('location') or '')
    
    """contactInfo 格式: {phone}{email}{homepage}{role}"""
    latex_content.append(f"\\contactInfo{{{phone}}}{{{email}}}{{{location}}}{{{role}}}")
    latex_content.append("")
    
    """个人简介"""
    summary = resume_data.get('summary')
    if isinstance(summary, str) and summary.strip():
        latex_content.append(r"\section{个人简介}")
        latex_content.append(escape_latex(summary.strip()))
        latex_content.append("")
    
    """实习经历"""
    internships = resume_data.get('internships') or []
    if isinstance(internships, list) and internships:
        latex_content.append(r"\section{实习经历}")
        for it in internships:
            title = escape_latex(it.get('title') or '')
            subtitle = escape_latex(it.get('subtitle') or '')
            date = escape_latex(it.get('date') or '')
            
            if subtitle:
                subsection_title = f"\\textbf{{{title}}} - {subtitle}"
            else:
                subsection_title = f"\\textbf{{{title}}}"
            
            latex_content.append(f"\\datedsubsection{{{subsection_title}}}{{{date}}}")
            latex_content.append("")
    
    """工作经历"""
    exp = resume_data.get('experience') or []
    if isinstance(exp, list) and exp:
        latex_content.append(r"\section{工作经历}")
        for e in exp:
            company = escape_latex(e.get('company') or '')
            position = escape_latex(e.get('position') or '')
            duration = escape_latex(e.get('duration') or '')
            location = escape_latex(e.get('location') or '')
            
            if position and company:
                subsection_title = f"\\textbf{{{position}}} - {company}"
            elif company:
                subsection_title = f"\\textbf{{{company}}}"
            else:
                subsection_title = position or company
            
            latex_content.append(f"\\datedsubsection{{{subsection_title}}}{{{duration}}}")
            
            """成就列表"""
            achievements = e.get('achievements') or []
            if isinstance(achievements, list) and achievements:
                latex_content.append(r"\begin{itemize}[parsep=0.2ex]")
                for ach in achievements:
                    if isinstance(ach, str) and ach.strip():
                        latex_content.append(f"  \\item {escape_latex(ach.strip())}")
                latex_content.append(r"\end{itemize}")
            latex_content.append("")
    
    """项目经历"""
    projects = resume_data.get('projects') or []
    if isinstance(projects, list) and projects:
        latex_content.append(r"\section{项目经验}")
        for p in projects:
            """新结构优先"""
            title = p.get('title') or " - ".join([v for v in [p.get('name'), p.get('role')] if v])
            if title:
                escaped_title = escape_latex(title)
                latex_content.append(f"\\datedsubsection{{\\textbf{{{escaped_title}}}}}{{}}")
                latex_content.append(r"\begin{itemize}[parsep=0.2ex]")
                
                """处理新结构: items"""
                if isinstance(p.get('items'), list) and p['items']:
                    for sub in p['items']:
                        sub_title = sub.get('title')
                        if sub_title:
                            escaped_sub_title = escape_latex(sub_title)
                            latex_content.append(f"  \\item \\textbf{{{escaped_sub_title}}}")
                            details = sub.get('details') or []
                            if isinstance(details, list) and details:
                                latex_content.append(r"    \begin{itemize}[label=\textbf{·},parsep=0.2ex]")
                                for detail in details:
                                    if isinstance(detail, str) and detail.strip():
                                        latex_content.append(f"      \\item {escape_latex(detail.strip())}")
                                latex_content.append(r"    \end{itemize}")
                
                """处理旧结构: highlights"""
                if not (isinstance(p.get('items'), list) and p['items']):
                    highlights = p.get('highlights') or []
                    if isinstance(highlights, list) and highlights:
                        for h in highlights:
                            if isinstance(h, str) and h.strip():
                                latex_content.append(f"  \\item {escape_latex(h.strip())}")
                
                latex_content.append(r"\end{itemize}")
                latex_content.append("")
    
    """开源经历"""
    open_source = resume_data.get('openSource') or []
    if isinstance(open_source, list) and open_source:
        latex_content.append(r"\section{开源经历}")
        for os_item in open_source:
            title = escape_latex(os_item.get('title') or '')
            subtitle = escape_latex(os_item.get('subtitle') or '')
            
            if subtitle:
                subsection_title = f"\\textbf{{{title}}}"
                latex_content.append(f"\\datedsubsection{{{subsection_title}}}{{{subtitle}}}")
            else:
                latex_content.append(f"\\datedsubsection{{\\textbf{{{title}}}}}{{}}")
            
            items = os_item.get('items') or []
            if isinstance(items, list) and items:
                latex_content.append(r"\begin{itemize}[parsep=0.2ex]")
                for item in items:
                    if isinstance(item, str) and item.strip():
                        latex_content.append(f"  \\item {escape_latex(item.strip())}")
                latex_content.append(r"\end{itemize}")
            latex_content.append("")
    
    """专业技能"""
    skills = resume_data.get('skills') or []
    if skills:
        latex_content.append(r"\section{专业技能}")
        latex_content.append(r"\begin{itemize}[parsep=0.2ex]")
        
        """旧结构: 字符串列表"""
        if all(isinstance(s, str) for s in skills):
            for s in skills:
                if s.strip():
                    latex_content.append(f"  \\item {escape_latex(s.strip())}")
        
        """新结构: 对象列表"""
        if not all(isinstance(s, str) for s in skills):
            for s in skills:
                if isinstance(s, dict):
                    category = escape_latex(s.get('category') or '')
                    details = escape_latex(s.get('details') or '')
                    if category and details:
                        latex_content.append(f"  \\item \\textbf{{{category}}}: {details}")
                    elif category:
                        latex_content.append(f"  \\item \\textbf{{{category}}}")
                    elif details:
                        latex_content.append(f"  \\item {details}")
        
        latex_content.append(r"\end{itemize}")
        latex_content.append("")
    
    """教育经历"""
    edu = resume_data.get('education') or []
    if isinstance(edu, list) and edu:
        latex_content.append(r"\section{教育经历}")
        for ed in edu:
            """新结构优先"""
            title = ed.get('title')
            if title:
                date = escape_latex(ed.get('date') or '')
                escaped_title = escape_latex(title)
                latex_content.append(f"\\datedsubsection{{\\textbf{{{escaped_title}}}}}{{{date}}}")
                honors = ed.get('honors')
                if honors:
                    escaped_honors = escape_latex(honors)
                    latex_content.append(f" \\textbf{{荣誉:}} {escaped_honors}")
            else:
                """旧结构"""
                school = escape_latex(ed.get('school') or '')
                degree = escape_latex(ed.get('degree') or '')
                major = escape_latex(ed.get('major') or '')
                duration = escape_latex(ed.get('duration') or '')
                
                parts = [s for s in [school, degree, major] if s]
                title_str = " - ".join(parts) if parts else school or degree or major
                if title_str:
                    latex_content.append(f"\\datedsubsection{{\\textbf{{{title_str}}} -  \\textit{{本科}}}}{{{duration}}}")
            
            latex_content.append("")
    
    """奖项"""
    awards = resume_data.get('awards') or []
    if isinstance(awards, list) and awards:
        latex_content.append(r"\section{奖项}")
        for a in awards:
            title = escape_latex(a.get('title') or '')
            issuer = escape_latex(a.get('issuer') or '')
            date = escape_latex(a.get('date') or '')
            
            parts = [s for s in [title, issuer] if s]
            subsection_title = " - ".join(parts) if parts else title or issuer
            if subsection_title:
                latex_content.append(f"\\datedsubsection{{\\textbf{{{subsection_title}}}}}{{{date}}}")
        latex_content.append("")
    
    """文档结尾"""
    latex_content.append(r"\end{document}")
    
    return "\n".join(latex_content)


def compile_latex_to_pdf(latex_content: str, template_dir: Path) -> BytesIO:
    """
    编译 LaTeX 代码为 PDF
    
    参数:
        latex_content: LaTeX 代码字符串
        template_dir: LaTeX 模板目录（包含 resume.cls 等文件）
    
    返回:
        PDF 文件的 BytesIO 对象
    """
    """创建临时目录"""
    temp_dir = tempfile.mkdtemp()
    
    try:
        """将模板文件复制到临时目录"""
        template_files = ['resume.cls', 'fontawesome.sty', 'linespacing_fix.sty', 
                         'zh_CN-Adobefonts_external.sty', 'zh_CN-Adobefonts_internal.sty']
        
        for file_name in template_files:
            src_file = template_dir / file_name
            if src_file.exists():
                shutil.copy2(src_file, temp_dir)
        
        """复制字体目录"""
        fonts_dir = template_dir / 'fonts'
        if fonts_dir.exists():
            shutil.copytree(fonts_dir, Path(temp_dir) / 'fonts', dirs_exist_ok=True)
        
        """写入 LaTeX 文件"""
        tex_file = Path(temp_dir) / 'resume.tex'
        tex_file.write_text(latex_content, encoding='utf-8')
        
        """编译 LaTeX 为 PDF"""
        """使用 xelatex 编译，确保字体嵌入"""
        compile_cmd = [
            'xelatex',
            '-interaction=nonstopmode',
            '-output-directory', temp_dir,
            '-synctex=0',  # 禁用 synctex 加快编译
            str(tex_file)
        ]
        
        """执行编译（运行两次以确保交叉引用正确）"""
        for _ in range(2):
            result = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                """如果第一次编译失败，尝试查看错误"""
                error_msg = result.stderr or result.stdout
                raise RuntimeError(f"LaTeX 编译失败: {error_msg}")
        
        """读取生成的 PDF"""
        pdf_file = Path(temp_dir) / 'resume.pdf'
        if not pdf_file.exists():
            raise RuntimeError("PDF 文件未生成")
        
        pdf_bytes = pdf_file.read_bytes()
        pdf_io = BytesIO(pdf_bytes)
        pdf_io.seek(0)
        
        return pdf_io
        
    finally:
        """清理临时目录"""
        shutil.rmtree(temp_dir, ignore_errors=True)


def render_pdf_from_resume_latex(resume_data: Dict[str, Any]) -> BytesIO:
    """
    将简历 JSON 渲染为 PDF（使用 LaTeX）
    
    参数:
        resume_data: 简历数据字典
    
    返回:
        PDF 文件的 BytesIO 对象
    """
    """获取模板目录"""
    current_dir = Path(__file__).resolve().parent
    root_dir = current_dir.parent
    template_dir = root_dir / "Latex 简历演示"
    
    if not template_dir.exists():
        raise RuntimeError(f"LaTeX 模板目录不存在: {template_dir}")
    
    """转换为 LaTeX"""
    latex_content = json_to_latex(resume_data)
    
    """编译为 PDF"""
    pdf_io = compile_latex_to_pdf(latex_content, template_dir)
    
    return pdf_io

