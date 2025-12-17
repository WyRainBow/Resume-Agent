"""
LaTeX Section 生成器模块
提供各个简历模块的 LaTeX 代码生成函数
与 slager.link (wy.tex) 格式保持一致
"""
from typing import Dict, Any, List
from .latex_utils import escape_latex
from .html_to_latex import html_to_latex


def generate_section_summary(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """生成个人总结"""
    content = []
    summary = resume_data.get('summary')
    title = (section_titles or {}).get('summary', '个人总结')
    if isinstance(summary, str) and summary.strip():
        content.append(f"\\section{{{escape_latex(title)}}}")
        content.append(escape_latex(summary.strip()))
        content.append("")
    return content


def generate_section_internships(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成实习经历 - 与 wy.tex 格式一致
    格式: \datedsubsection{\textbf{公司} - 职位(语言)}{日期}
    不带 itemize，简洁风格
    """
    content = []
    internships = resume_data.get('internships') or []
    title = (section_titles or {}).get('internships') or (section_titles or {}).get('experience', '实习经历')
    if isinstance(internships, list) and internships:
        content.append(f"\\section{{{escape_latex(title)}}}")
        for it in internships:
            company = escape_latex(it.get('title') or '')
            position = escape_latex(it.get('subtitle') or '')
            date = it.get('date') or ''
            # 过滤无效时间
            if date and date.strip() in ['未提及', '未知', 'N/A', '-', '']:
                date = ''
            date = escape_latex(date)
            # 格式：\datedsubsection{\textbf{公司} - 职位}{日期}
            if position:
                line = f"\\textbf{{{company}}} - {position}"
            else:
                line = f"\\textbf{{{company}}}"
            content.append(f"\\datedsubsection{{{line}}}{{{date}}}")
            content.append("")
        content.append("")
    return content


def generate_section_experience(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """生成工作经历"""
    content = []
    exp = resume_data.get('experience') or []
    title = (section_titles or {}).get('experience', '工作经历')
    if isinstance(exp, list) and exp:
        content.append(f"\\section{{{escape_latex(title)}}}")
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


def _convert_markdown_bold(text: str) -> str:
    """将 **text** 转换为 \textbf{text}"""
    import re
    # 匹配 **text** 或 **text**: 格式
    pattern = r'\*\*([^*]+)\*\*'
    return re.sub(pattern, r'\\textbf{\1}', text)


def generate_section_projects(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成项目经历 - 与 wy.tex 格式一致
    支持两种格式：
    1. items 结构：嵌套的子项目
    2. highlights 结构：支持 **bold** 和 > 缩进语法
    
    格式:
    \datedsubsection{\textbf{项目名}}{}
    \begin{itemize}[parsep=0.2ex]
      \item \textbf{子项目标题}
        \begin{itemize}[label=\textbf{·},parsep=0.2ex]
          \item 详情1
          \item 详情2
        \end{itemize}
    \end{itemize}
    """
    content = []
    projects = resume_data.get('projects') or []
    section_title = (section_titles or {}).get('projects', '项目经验')
    if isinstance(projects, list) and projects:
        content.append(f"\\section{{{escape_latex(section_title)}}}")
        content.append("")
        content.append("")
        
        for p in projects:
            # 兼容多种字段名
            title = p.get('title') or p.get('name') or ''
            role = p.get('role') or p.get('subtitle') or ''
            date = p.get('date') or ''
            
            # 过滤无效时间
            if date and date.strip() in ['未提及', '未知', 'N/A', '-', '']:
                date = ''
            date = escape_latex(date)
            
            # 构建标题 - 不显示日期，与 wy.tex 一致
            full_title = escape_latex(title)
            
            if full_title:
                content.append(f"\\datedsubsection{{\\textbf{{{full_title}}}}}{{}}")
                
                # 检查是否有 items（子项目结构）
                items = p.get('items') or []
                highlights = p.get('highlights') or []
                
                if isinstance(items, list) and items:
                    # 有子项目结构 - 与 wy.tex 一致
                    content.append(r"\begin{itemize}[parsep=0.2ex]")
                    for sub in items:
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
                            content.append("")
                    content.append(r"\end{itemize}")
                elif isinstance(highlights, list) and highlights:
                    # highlights 结构 - 支持 HTML 和 Markdown 格式
                    has_list_wrapper = False
                    
                        for h in highlights:
                        if not isinstance(h, str) or not h.strip():
                            continue
                        
                        h = h.strip()
                        
                        # 检查是否是 HTML 格式
                        if '<' in h and '>' in h:
                            # HTML 格式，使用 html_to_latex 转换
                            converted = html_to_latex(h)
                            if converted.strip():
                                # 如果 HTML 已包含列表结构，直接添加
                                if '\\begin{itemize}' in converted or '\\begin{enumerate}' in converted:
                                    content.append(converted)
                                else:
                                    # 否则包装成列表项
                                    if not has_list_wrapper:
                                        content.append(r"\begin{itemize}[parsep=0.2ex]")
                                        has_list_wrapper = True
                                    content.append(f"  \\item {converted}")
                        elif h.startswith('**') and '**' in h[2:]:
                            # Markdown 加粗格式
                            if not has_list_wrapper:
                                content.append(r"\begin{itemize}[parsep=0.2ex]")
                                has_list_wrapper = True
                            converted = _convert_markdown_bold(h)
                            converted = escape_latex(converted.replace('\\textbf{', '<<<TEXTBF>>>').replace('}', '<<<ENDBF>>>')).replace('<<<TEXTBF>>>', '\\textbf{').replace('<<<ENDBF>>>', '}')
                            content.append(f"  \\item {converted}")
                        else:
                            # 普通文本
                            if not has_list_wrapper:
                    content.append(r"\begin{itemize}[parsep=0.2ex]")
                                has_list_wrapper = True
                            content.append(f"  \\item {escape_latex(h)}")
                    
                    if has_list_wrapper:
                    content.append(r"\end{itemize}")
                
                content.append("")
                content.append("")
    return content


def generate_section_skills(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成专业技能 - 与 wy.tex 格式一致
    格式: \\item \\textbf{类别:} 详情
    """
    content = []
    skills = resume_data.get('skills') or []
    title = (section_titles or {}).get('skills', '专业技能')
    if skills:
        content.append(f"\\section{{{escape_latex(title)}}}")
        content.append(r"\begin{itemize}[parsep=0.2ex]")
            for s in skills:
            if isinstance(s, str):
                if s.strip():
                    if ':' in s or '：' in s:
                        parts = s.replace('：', ':').split(':', 1)
                        category = parts[0].strip()
                        details = parts[1].strip() if len(parts) > 1 else ''
                        if category and details:
                            content.append(f"  \\item \\textbf{{{escape_latex(category)}:}} {escape_latex(details)}")
                        else:
                    content.append(f"  \\item {escape_latex(s.strip())}")
        else:
                        content.append(f"  \\item {escape_latex(s.strip())}")
            elif isinstance(s, dict):
                    category = escape_latex(s.get('category') or '')
                details = s.get('details') or ''
                # 检查 details 是否是 HTML
                if '<' in details and '>' in details:
                    details = html_to_latex(details)
                else:
                    details = escape_latex(details)
                    if category and details:
                    content.append(f"  \\item \\textbf{{{category}:}} {details}")
                    elif category:
                        content.append(f"  \\item \\textbf{{{category}}}")
                    elif details:
                        content.append(f"  \\item {details}")
        content.append(r"\end{itemize}")
        content.append("")
    return content


def generate_section_education(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成教育经历 - 与 wy.tex 格式一致
    格式: \datedsubsection{\textbf{学校} - 专业 - \textit{学位}}{日期}
    \ \textbf{荣誉:} 荣誉内容
    """
    content = []
    edu = resume_data.get('education') or []
    section_title = (section_titles or {}).get('education', '教育经历')
    if isinstance(edu, list) and edu:
        content.append(f"\\section{{{escape_latex(section_title)}}}")
        for ed in edu:
            # 兼容多种字段名
            school = escape_latex(ed.get('title') or ed.get('school') or '')
            degree = escape_latex(ed.get('degree') or '')
            major = escape_latex(ed.get('subtitle') or ed.get('major') or '')
            duration = escape_latex(ed.get('date') or ed.get('duration') or '')
            
            # 构建标题：\textbf{学校} - 专业 - \textit{学位}
            title_parts = []
            if school:
                title_parts.append(f"\\textbf{{{school}}}")
            if major:
                title_parts.append(major)
            if degree:
                title_parts.append(f"\\textit{{{degree}}}")
            
            title_str = " - ".join(title_parts) if title_parts else f"\\textbf{{{school}}}"
            
            if title_str:
                content.append(f"\\datedsubsection{{{title_str}}}{{{duration}}}")
                
                # 荣誉信息 - 与 wy.tex 格式一致
                honors = ed.get('honors')
                if honors:
                    escaped_honors = escape_latex(honors)
                    content.append(f"\\ \\textbf{{荣誉:}} {escaped_honors}")
            content.append("")
    return content


def generate_section_awards(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """生成奖项"""
    content = []
    awards = resume_data.get('awards') or []
    section_title = (section_titles or {}).get('awards', '荣誉奖项')
    if isinstance(awards, list) and awards:
        content.append(f"\\section{{{escape_latex(section_title)}}}")
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


def generate_section_opensource(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成开源经历 - 与 wy.tex 格式一致
    格式:
    \datedsubsection{\textbf{项目名}}{描述}
    \begin{itemize}[parsep=0.2ex]
      \item 仓库: \textit{url}
      \item 其他内容
    \end{itemize}
    """
    content = []
    # 兼容 openSource、opensource、open_source 三种字段名
    open_source = resume_data.get('openSource') or resume_data.get('opensource') or resume_data.get('open_source') or []
    title = (section_titles or {}).get('openSource', '开源经历')
    if isinstance(open_source, list) and open_source:
        content.append(f"\\section{{{escape_latex(title)}}}")
        for os_item in open_source:
            item_title = escape_latex(os_item.get('title') or '')
            subtitle = escape_latex(os_item.get('subtitle') or '')
            repo_url = os_item.get('repoUrl') or os_item.get('repo') or os_item.get('link') or ''
            
                subsection_title = f"\\textbf{{{item_title}}}"
            content.append(f"\\datedsubsection{{{subsection_title}}}{{{subtitle}}}")
            
            items = os_item.get('items') or []
            
            if repo_url or (isinstance(items, list) and items):
                content.append(r"\begin{itemize}[parsep=0.2ex]")
                
                if repo_url:
                    escaped_url = escape_latex(repo_url)
                    content.append(f"  \\item 仓库: \\textit{{{escaped_url}}}")
                
                if isinstance(items, list) and items:
                for item in items:
                    if isinstance(item, str) and item.strip():
                        content.append(f"  \\item {escape_latex(item.strip())}")
                
                content.append(r"\end{itemize}")
            
            content.append("")
    return content


"""
Section 生成器映射
"""
SECTION_GENERATORS = {
    'contact': None,
    'summary': generate_section_summary,
    'education': generate_section_education,
    'experience': generate_section_experience,
    'internships': generate_section_internships,
    'projects': generate_section_projects,
    'skills': generate_section_skills,
    'awards': generate_section_awards,
    'opensource': generate_section_opensource,
    'open_source': generate_section_opensource,  # 别名
}

"""
默认 section 顺序 - 与 wy.tex 一致
"""
DEFAULT_SECTION_ORDER = [
    'internships', 'projects', 'opensource', 'skills', 'education',
    'awards', 'summary'
]
