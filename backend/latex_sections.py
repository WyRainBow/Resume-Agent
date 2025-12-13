"""
LaTeX Section 生成器模块
提供各个简历模块的 LaTeX 代码生成函数
"""
from typing import Dict, Any, List
from .latex_utils import escape_latex


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
    """生成实习经历（包含公司、职位、日期和描述）"""
    content = []
    internships = resume_data.get('internships') or []
    title = (section_titles or {}).get('internships') or (section_titles or {}).get('experience', '实习经历')
    if isinstance(internships, list) and internships:
        content.append(f"\\section{{{escape_latex(title)}}}")
        for it in internships:
            company = escape_latex(it.get('title') or '')
            position = escape_latex(it.get('subtitle') or '')
            date = it.get('date') or ''
            """过滤无效时间"""
            if date and date.strip() in ['未提及', '未知', 'N/A', '-', '']:
                date = ''
            date = escape_latex(date)
            """格式：公司 - 职位    日期"""
            if position:
                line = f"\\textbf{{{company}}} - {position}"
            else:
                line = f"\\textbf{{{company}}}"
            content.append(f"\\datedsubsection{{{line}}}{{{date}}}")
            """渲染描述（details 或 highlights）"""
            details = it.get('details') or it.get('highlights') or []
            if isinstance(details, list) and details:
                content.append("\\begin{itemize}[parsep=0.25ex]")
                for d in details:
                    content.append(f"  \\item {escape_latex(str(d))}")
                content.append("\\end{itemize}")
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


def generate_section_projects(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """生成项目经历"""
    content = []
    projects = resume_data.get('projects') or []
    section_title = (section_titles or {}).get('projects', '项目经历')
    if isinstance(projects, list) and projects:
        content.append(f"\\section{{{escape_latex(section_title)}}}")
        for p in projects:
            """兼容多种字段名"""
            title = p.get('title') or p.get('name') or ''
            role = p.get('role') or p.get('subtitle') or ''
            date = p.get('date') or ''
            repo_url = p.get('repoUrl') or p.get('repo') or p.get('link') or ''
            
            """过滤无效时间（如“未提及”等）"""
            if date and date.strip() in ['未提及', '未知', 'N/A', '-', '']:
                date = ''
            date = escape_latex(date)
            
            """构建标题：项目名 - 角色"""
            if role:
                full_title = f"{title} - {role}"
            else:
                full_title = title
            
            if full_title:
                escaped_title = escape_latex(full_title)
                """添加仓库链接"""
                if repo_url and repo_url.startswith('http'):
                    escaped_url = escape_latex(repo_url)
                    content.append(f"\\datedsubsection{{\\textbf{{{escaped_title}}} \\href{{{escaped_url}}}{{\\faGithub}}}}{{{date}}}")
                else:
                    content.append(f"\\datedsubsection{{\\textbf{{{escaped_title}}}}}{{{date}}}")
                
                # 收集项目详情内容
                item_content = []
                if isinstance(p.get('items'), list) and p['items']:
                    for sub in p['items']:
                        sub_title = sub.get('title')
                        if sub_title:
                            escaped_sub_title = escape_latex(sub_title)
                            item_content.append(f"  \\item \\textbf{{{escaped_sub_title}}}")
                            details = sub.get('details') or []
                            if isinstance(details, list) and details:
                                item_content.append(r"    \begin{itemize}[label=\textbf{·},parsep=0.2ex]")
                                for detail in details:
                                    if isinstance(detail, str) and detail.strip():
                                        item_content.append(f"      \\item {escape_latex(detail.strip())}")
                                item_content.append(r"    \end{itemize}")
                if not (isinstance(p.get('items'), list) and p['items']):
                    highlights = p.get('highlights') or []
                    if isinstance(highlights, list) and highlights:
                        for h in highlights:
                            if isinstance(h, str) and h.strip():
                                """支持 > 前缀表示缩进"""
                                is_indented = h.startswith('>')
                                text = h[1:].strip() if is_indented else h.strip()
                                if is_indented:
                                    item_content.append(f"    \\item[] \\hspace{{1em}} {escape_latex(text)}")
                                else:
                                    item_content.append(f"  \\item {escape_latex(text)}")
                
                # 只有当有内容时才添加 itemize 环境
                if item_content:
                    content.append(r"\begin{itemize}[parsep=0.2ex]")
                    content.extend(item_content)
                    content.append(r"\end{itemize}")
                content.append("")
    return content


def generate_section_skills(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """生成专业技能"""
    content = []
    skills = resume_data.get('skills') or []
    title = (section_titles or {}).get('skills', '专业技能')
    if skills:
        content.append(f"\\section{{{escape_latex(title)}}}")
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


def generate_section_education(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """生成教育经历"""
    content = []
    edu = resume_data.get('education') or []
    section_title = (section_titles or {}).get('education', '教育经历')
    if isinstance(edu, list) and edu:
        content.append(f"\\section{{{escape_latex(section_title)}}}")
        for ed in edu:
            """兼容多种字段名：title=学校, subtitle=专业, degree=学位"""
            school = escape_latex(ed.get('title') or ed.get('school') or '')
            degree = escape_latex(ed.get('degree') or '')
            major = escape_latex(ed.get('subtitle') or ed.get('major') or '')
            duration = escape_latex(ed.get('date') or ed.get('duration') or '')
            
            """构建标题"""
            parts = [s for s in [school, degree, major] if s]
            title_str = " - ".join(parts) if parts else school
            
            if title_str:
                content.append(f"\\datedsubsection{{\\textbf{{{title_str}}}}}{{{duration}}}")
                
                """描述信息（GPA、排名等）"""
                details = ed.get('details') or []
                description = ed.get('description') or ''
                if isinstance(details, list) and details:
                    desc_text = '；'.join([escape_latex(d) for d in details if d])
                    if desc_text:
                        content.append(f"{desc_text}")
                elif description:
                    content.append(f"{escape_latex(description)}")
                
                """荣誉信息（兼容旧格式）"""
                honors = ed.get('honors')
                if honors:
                    escaped_honors = escape_latex(honors)
                    content.append(f" \\textbf{{荣誉:}} {escaped_honors}")
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
    """生成开源经历"""
    content = []
    """兼容 openSource 和 opensource 两种字段名"""
    open_source = resume_data.get('openSource') or resume_data.get('opensource') or []
    title = (section_titles or {}).get('openSource', '开源经历')
    if isinstance(open_source, list) and open_source:
        content.append(f"\\section{{{escape_latex(title)}}}")
        for os_item in open_source:
            item_title = escape_latex(os_item.get('title') or '')
            subtitle = escape_latex(os_item.get('subtitle') or '')
            repo_url = os_item.get('repoUrl') or os_item.get('repo') or os_item.get('link') or ''
            
            """构建标题，添加仓库链接"""
            if repo_url and repo_url.startswith('http'):
                escaped_url = escape_latex(repo_url)
                subsection_title = f"\\textbf{{{item_title}}} \\href{{{escaped_url}}}{{\\faGithub}}"
            else:
                subsection_title = f"\\textbf{{{item_title}}}"
            
            if subtitle:
                content.append(f"\\datedsubsection{{{subsection_title}}}{{{subtitle}}}")
            else:
                content.append(f"\\datedsubsection{{{subsection_title}}}{{}}")
            items = os_item.get('items') or []
            if isinstance(items, list) and items:
                content.append(r"\begin{itemize}[parsep=0.2ex]")
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
}

"""
默认 section 顺序（与前端可视化编辑器一致）
"""
DEFAULT_SECTION_ORDER = [
    'education', 'experience', 'internships', 'projects', 
    'skills', 'awards', 'summary', 'opensource'
]
