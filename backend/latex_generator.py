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


def normalize_resume_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    标准化简历数据字段名
    支持中文和英文字段名，统一转换为英文
    
    参数:
        data: 原始简历数据
    
    返回:
        标准化后的简历数据（英文字段名）
    """
    """
    字段名映射表：中文 -> 英文
    """
    """
    字段名映射表：中文 -> 英文
    """
    field_mapping = {
   
        '姓名': 'name',
        '联系方式': 'phone',
        '邮箱': 'email',
        '电话': 'phone',
        '手机': 'phone',
        '地址': 'location',
        '所在地': 'location',
        
    
        '求职方向': 'summary',
        '个人简介': 'summary',
        '自我评价': 'summary',
        
  
        '实习经历': 'internships',
        '工作经历': 'experience',
        '项目经验': 'projects',
        '项目经历': 'projects',
        '项目': 'projects',
        
  
        '开源经历': 'opensource',
        '开源贡献': 'opensource',
        '开源': 'opensource',
        '专业技能': 'skills',
        '技能': 'skills',
        '教育经历': 'education',
        '教育': 'education',
        '获奖荣誉': 'awards',
        '荣誉': 'awards',
        '证书': 'certifications',
        '资格证书': 'certifications',
        '论文': 'publications',
        '论文发表': 'publications',
        '竞赛经历': 'competitions',
        '竞赛': 'competitions',
    }
    
    normalized = {}
    contact_info = {}
    
    for key, value in data.items():
        """
        如果是中文字段名，转换为英文
        """
        english_key = field_mapping.get(key, key)
        
        """
        特殊处理：联系信息字段
        """
        if english_key in ['phone', 'email', 'location']:
            contact_info[english_key] = value
        else:
            """
            处理嵌套结构
            """
            if isinstance(value, list):
                normalized[english_key] = [normalize_item(item, field_mapping) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, dict) and key != 'contact':
                normalized[english_key] = normalize_item(value, field_mapping)
            else:
                normalized[english_key] = value
    
    """
    合并 contact 信息
    """
    if contact_info:
        if 'contact' not in normalized:
            normalized['contact'] = {}
        """
        如果 contact 是字符串，转换为字典
        """
        if isinstance(normalized.get('contact'), str):
            """假设字符串是电话号"""
            contact_info['phone'] = normalized['contact']
            normalized['contact'] = contact_info
        elif isinstance(normalized.get('contact'), dict):
            normalized['contact'].update(contact_info)
        else:
            normalized['contact'] = contact_info
    
    return normalized


def normalize_item(item: Dict[str, Any], field_mapping: Dict[str, str]) -> Dict[str, Any]:
    """
    标准化单个项目的字段名
    """
    """
    项目/经历项的字段映射
    """
    item_field_mapping = {
        '公司': 'company',
        '职位': 'position',
        '时间': 'duration',
        '地点': 'location',
        '项目名称': 'name',
        '角色': 'role',
        '技术栈': 'stack',
        '亮点': 'highlights',
        '描述': 'description',
        '职责': 'achievements',
        '成就': 'achievements',
    }
    
    normalized_item = {}
    for k, v in item.items():
        english_key = item_field_mapping.get(k, field_mapping.get(k, k))
        """
        递归处理嵌套结构
        """
        if isinstance(v, dict):
            normalized_item[english_key] = normalize_item(v, field_mapping)
        elif isinstance(v, list):
            normalized_item[english_key] = [normalize_item(sub, field_mapping) if isinstance(sub, dict) else sub for sub in v]
        else:
            normalized_item[english_key] = v
    
    return normalized_item


def generate_section_summary(resume_data: Dict[str, Any]) -> List[str]:
    """生成个人总结"""
    content = []
    summary = resume_data.get('summary')
    if isinstance(summary, str) and summary.strip():
        content.append(r"\section{个人总结}")
        content.append(escape_latex(summary.strip()))
        content.append("")
    return content

def generate_section_internships(resume_data: Dict[str, Any]) -> List[str]:
    """生成实习经历"""
    content = []
    internships = resume_data.get('internships') or []
    if isinstance(internships, list) and internships:
        content.append(r"\section{实习经历}")
        for it in internships:
            title = escape_latex(it.get('title') or '')
            subtitle = escape_latex(it.get('subtitle') or '')
            date = escape_latex(it.get('date') or '')
            if subtitle:
                subsection_title = f"\\textbf{{{title}}} - {subtitle}"
            else:
                subsection_title = f"\\textbf{{{title}}}"
            content.append(f"\\datedsubsection{{{subsection_title}}}{{{date}}}")
            highlights = it.get('highlights') or it.get('details') or []
            if isinstance(highlights, list) and highlights:
                content.append(r"\begin{itemize}[parsep=0.2ex]")
                for h in highlights:
                    if isinstance(h, str) and h.strip():
                        content.append(f"  \\item {escape_latex(h.strip())}")
                content.append(r"\end{itemize}")
            content.append("")
    return content

def generate_section_experience(resume_data: Dict[str, Any]) -> List[str]:
    """生成工作经历"""
    content = []
    exp = resume_data.get('experience') or []
    if isinstance(exp, list) and exp:
        content.append(r"\section{工作经历}")
        for e in exp:
            company = escape_latex(e.get('company') or '')
            position = escape_latex(e.get('position') or '')
            duration = escape_latex(e.get('duration') or '')
            if position and company:
                subsection_title = f"\\textbf{{{position}}} - {company}"
            elif company:
                subsection_title = f"\\textbf{{{company}}}"
            else:
                subsection_title = position or company
            content.append(f"\\datedsubsection{{{subsection_title}}}{{{duration}}}")
            achievements = e.get('achievements') or []
            if isinstance(achievements, list) and achievements:
                content.append(r"\begin{itemize}[parsep=0.2ex]")
                for ach in achievements:
                    if isinstance(ach, str) and ach.strip():
                        content.append(f"  \\item {escape_latex(ach.strip())}")
                content.append(r"\end{itemize}")
            content.append("")
    return content

def generate_section_projects(resume_data: Dict[str, Any]) -> List[str]:
    """生成项目经历"""
    content = []
    projects = resume_data.get('projects') or []
    if isinstance(projects, list) and projects:
        content.append(r"\section{项目经历}")
        for p in projects:
            title = p.get('title') or " - ".join([v for v in [p.get('name'), p.get('role')] if v])
            if title:
                escaped_title = escape_latex(title)
                content.append(f"\\datedsubsection{{\\textbf{{{escaped_title}}}}}{{}}")
                content.append(r"\begin{itemize}[parsep=0.2ex]")
                if isinstance(p.get('items'), list) and p['items']:
                    for sub in p['items']:
                        sub_title = sub.get('title')
                        if sub_title:
                            escaped_sub_title = escape_latex(sub_title)
                            content.append(f"  \\item \\textbf{{{escaped_sub_title}}}")
                            details = sub.get('details') or []
                            if isinstance(details, list) and details:
                                content.append(r"    \begin{itemize}[label=\textbf{·},parsep=0.2ex]")
                                for detail in details:
                                    if isinstance(detail, str) and detail.strip():
                                        content.append(f"      \\item {escape_latex(detail.strip())}")
                                content.append(r"    \end{itemize}")
                if not (isinstance(p.get('items'), list) and p['items']):
                    highlights = p.get('highlights') or []
                    if isinstance(highlights, list) and highlights:
                        for h in highlights:
                            if isinstance(h, str) and h.strip():
                                content.append(f"  \\item {escape_latex(h.strip())}")
                content.append(r"\end{itemize}")
                content.append("")
    return content

def generate_section_skills(resume_data: Dict[str, Any]) -> List[str]:
    """生成专业技能"""
    content = []
    skills = resume_data.get('skills') or []
    if skills:
        content.append(r"\section{专业技能}")
        content.append(r"\begin{itemize}[parsep=0.2ex]")
        if all(isinstance(s, str) for s in skills):
            for s in skills:
                if s.strip():
                    content.append(f"  \\item {escape_latex(s.strip())}")
        else:
            for s in skills:
                if isinstance(s, dict):
                    category = escape_latex(s.get('category') or '')
                    details = escape_latex(s.get('details') or '')
                    if category and details:
                        content.append(f"  \\item \\textbf{{{category}}}: {details}")
                    elif category:
                        content.append(f"  \\item \\textbf{{{category}}}")
                    elif details:
                        content.append(f"  \\item {details}")
        content.append(r"\end{itemize}")
        content.append("")
    return content

def generate_section_education(resume_data: Dict[str, Any]) -> List[str]:
    """生成教育经历"""
    content = []
    edu = resume_data.get('education') or []
    if isinstance(edu, list) and edu:
        content.append(r"\section{教育经历}")
        for ed in edu:
            title = ed.get('title')
            if title:
                date = escape_latex(ed.get('date') or '')
                escaped_title = escape_latex(title)
                content.append(f"\\datedsubsection{{\\textbf{{{escaped_title}}}}}{{{date}}}")
                honors = ed.get('honors')
                if honors:
                    escaped_honors = escape_latex(honors)
                    content.append(f" \\textbf{{荣誉:}} {escaped_honors}")
            else:
                school = escape_latex(ed.get('school') or '')
                degree = escape_latex(ed.get('degree') or '')
                major = escape_latex(ed.get('major') or '')
                duration = escape_latex(ed.get('duration') or '')
                parts = [s for s in [school, degree, major] if s]
                title_str = " - ".join(parts) if parts else school or degree or major
                if title_str:
                    content.append(f"\\datedsubsection{{\\textbf{{{title_str}}} -  \\textit{{本科}}}}{{{duration}}}")
            content.append("")
    return content

def generate_section_awards(resume_data: Dict[str, Any]) -> List[str]:
    """生成奖项"""
    content = []
    awards = resume_data.get('awards') or []
    if isinstance(awards, list) and awards:
        content.append(r"\section{奖项}")
        content.append(r"\begin{itemize}[parsep=0.2ex]")
        for a in awards:
            if isinstance(a, str):
                if a.strip():
                    content.append(f"  \\item {escape_latex(a.strip())}")
                continue
            title = escape_latex(a.get('title') or '')
            issuer = escape_latex(a.get('issuer') or '')
            date = escape_latex(a.get('date') or '')
            parts = [s for s in [title, issuer] if s]
            subsection_title = " - ".join(parts) if parts else title or issuer
            if subsection_title:
                content.append(f"  \\item {subsection_title}" + (f" ({date})" if date else ""))
        content.append(r"\end{itemize}")
        content.append("")
    return content

def generate_section_opensource(resume_data: Dict[str, Any]) -> List[str]:
    """生成开源经历"""
    content = []
    open_source = resume_data.get('openSource') or []
    if isinstance(open_source, list) and open_source:
        content.append(r"\section{开源经历}")
        for os_item in open_source:
            title = escape_latex(os_item.get('title') or '')
            subtitle = escape_latex(os_item.get('subtitle') or '')
            if subtitle:
                subsection_title = f"\\textbf{{{title}}}"
                content.append(f"\\datedsubsection{{{subsection_title}}}{{{subtitle}}}")
            else:
                content.append(f"\\datedsubsection{{\\textbf{{{title}}}}}{{}}")
            items = os_item.get('items') or []
            if isinstance(items, list) and items:
                content.append(r"\begin{itemize}[parsep=0.2ex]")
                for item in items:
                    if isinstance(item, str) and item.strip():
                        content.append(f"  \\item {escape_latex(item.strip())}")
                content.append(r"\end{itemize}")
            content.append("")
    return content

# Section 生成器映射
SECTION_GENERATORS = {
    'contact': None,  # 联系信息在头部特殊处理
    'summary': generate_section_summary,
    'education': generate_section_education,
    'experience': generate_section_experience,
    'internships': generate_section_internships,
    'projects': generate_section_projects,
    'skills': generate_section_skills,
    'awards': generate_section_awards,
    'opensource': generate_section_opensource,
}

# 默认 section 顺序（与前端可视化编辑器一致）
# 前端顺序: contact → education → experience → projects → skills → awards → summary
DEFAULT_SECTION_ORDER = [
    'education', 'experience', 'internships', 'projects', 
    'skills', 'awards', 'summary', 'opensource'
]


def json_to_latex(resume_data: Dict[str, Any], section_order: List[str] = None) -> str:
    """
    将简历 JSON 转换为 LaTeX 代码
    支持中文和英文字段名，支持自定义 section 顺序
    
    参数:
        resume_data: 简历数据字典（中文或英文字段名）
        section_order: 自定义 section 顺序列表
    
    返回:
        LaTeX 代码字符串
    """
    """
    标准化 JSON：先尝试通用方法，失败则降级到固定映射
    """
    try:
        from backend.json_normalizer import normalize_resume_json
        resume_data = normalize_resume_json(resume_data)
        print("[通用标准化] 成功")
    except Exception as e:
        print(f"[通用标准化] 失败: {e}，降级到固定映射")
        resume_data = normalize_resume_data(resume_data)
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
    
    """按顺序生成各 section"""
    order = section_order if section_order else DEFAULT_SECTION_ORDER
    for section_id in order:
        generator = SECTION_GENERATORS.get(section_id)
        if generator:
            latex_content.extend(generator(resume_data))
    
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


# PDF 缓存（内存缓存，最多保留 50 个）
_pdf_cache: Dict[str, bytes] = {}
_pdf_cache_order: List[str] = []
_PDF_CACHE_MAX_SIZE = 50

def _get_cache_key(resume_data: Dict[str, Any], section_order: List[str] = None) -> str:
    """生成缓存键"""
    import hashlib
    import json
    content = json.dumps(resume_data, sort_keys=True, ensure_ascii=False) + str(section_order or [])
    return hashlib.md5(content.encode()).hexdigest()

def render_pdf_from_resume_latex(resume_data: Dict[str, Any], section_order: List[str] = None) -> BytesIO:
    """
    将简历 JSON 渲染为 PDF（使用 LaTeX）
    支持内容缓存，相同内容直接返回缓存
    
    参数:
        resume_data: 简历数据字典
        section_order: 自定义 section 顺序列表
    
    返回:
        PDF 文件的 BytesIO 对象
    """
    import time
    total_start = time.time()
    
    # 检查缓存
    cache_key = _get_cache_key(resume_data, section_order)
    if cache_key in _pdf_cache:
        cache_time = time.time() - total_start
        print(f"[性能] 缓存命中! 耗时: {cache_time*1000:.0f}ms")
        return BytesIO(_pdf_cache[cache_key])
    
    """获取模板目录"""
    current_dir = Path(__file__).resolve().parent
    root_dir = current_dir.parent
    template_dir = root_dir / "Latex 简历演示"
    
    if not template_dir.exists():
        raise RuntimeError(f"LaTeX 模板目录不存在: {template_dir}")
    
    """转换为 LaTeX"""
    latex_start = time.time()
    latex_content = json_to_latex(resume_data, section_order)
    latex_time = time.time() - latex_start
    print(f"[性能] JSON 转 LaTeX: {latex_time*1000:.0f}ms")
    
    """编译为 PDF"""
    compile_start = time.time()
    pdf_io = compile_latex_to_pdf(latex_content, template_dir)
    compile_time = time.time() - compile_start
    print(f"[性能] LaTeX 编译 PDF: {compile_time*1000:.0f}ms")
    
    # 写入缓存
    pdf_bytes = pdf_io.getvalue()
    if len(_pdf_cache) >= _PDF_CACHE_MAX_SIZE:
        # 删除最旧的缓存
        oldest_key = _pdf_cache_order.pop(0)
        _pdf_cache.pop(oldest_key, None)
    _pdf_cache[cache_key] = pdf_bytes
    _pdf_cache_order.append(cache_key)
    print(f"[性能] 已缓存 PDF (缓存数: {len(_pdf_cache)})")
    
    total_time = time.time() - total_start
    print(f"[性能] PDF 生成总耗时: {total_time*1000:.0f}ms")
    
    return pdf_io

