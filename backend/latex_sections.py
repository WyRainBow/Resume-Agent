"""
LaTeX Section 生成器模块
提供各个简历模块的 LaTeX 代码生成函数
与 slager.link (wy.tex) 格式保持一致
"""
from typing import Dict, Any, List
from .latex_utils import escape_latex
from .html_to_latex import html_to_latex
import json, time, re  # debug logging

# region agent log helper
def _agent_log(hypothesis_id: str, location: str, message: str, data=None, run_id: str = "run1"):
    """Lightweight NDJSON logger for debug mode (writes to .cursor/debug.log)."""
    try:
        payload = {
            "sessionId": "debug-session",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
        }
        with open("/Users/wy770/AI 简历/.cursor/debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        # Do not raise during debug logging
        pass
# endregion


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
    生成实习经历/工作经历 - 与 wy.tex 格式一致
    支持 Markdown 加粗（**text**），自动组合 company 和 position
    格式：{company} - {position}
    支持列表类型：none（无列表）、unordered（无序列表）、ordered（有序列表）
    """
    content = []
    internships = resume_data.get('internships') or []
    title = (section_titles or {}).get('internships') or (section_titles or {}).get('experience', '实习经历')
    
    # 获取列表类型，默认为 'none'
    global_settings = resume_data.get('globalSettings') or {}
    list_type = global_settings.get('experienceListType', 'none')
    
    if isinstance(internships, list) and internships:
        _agent_log("H2", "latex_sections.py:generate_section_internships", "enter internships", {
            "count": len(internships),
            "list_type": list_type,
        })
        content.append(f"\\section{{{escape_latex(title)}}}")
        
        # 始终使用 \datedsubsection 保持与教育经历一致的字号/对齐
        for idx, it in enumerate(internships):
            company = escape_latex(it.get('title') or '')
            position = escape_latex(it.get('subtitle') or '')
            date = it.get('date') or ''
            if date and date.strip() in ['未提及', '未知', 'N/A', '-', '']:
                date = ''
            date = escape_latex(date)
            
            if company and position:
                title_text = f"{company}\\hspace{{0.2em}}\\textendash\\hspace{{0.2em}}{position}"
            elif company:
                title_text = company
            elif position:
                title_text = position
            else:
                title_text = '未命名公司'
            
            # 使用 \normalsize 字体，确保与教育经历一致
            latex_line = f"\\datedsubsection{{\\normalsize {title_text}}}{{\\normalsize {date}}}"
            content.append(latex_line)
            content.append("")
            _agent_log("H2", "latex_sections.py:generate_section_internships", "item computed (datedsubsection-forced)", {
                "idx": idx,
                "company": company,
                "position": position,
                "date": date,
                "title_text": title_text,
                "render_mode": "datedsubsection_forced",
                "latex_line": latex_line,
            })
        # 不再开启列表环境，避免额外缩进和字号差异
        content.append("")
    return content


def generate_section_experience(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成工作经历
    支持 Markdown 加粗（**text**），自动组合 company 和 position
    格式：{company} - {position}
    """
    content = []
    exp = resume_data.get('experience') or []
    title = (section_titles or {}).get('experience', '工作经历')
    if isinstance(exp, list) and exp:
        content.append(f"\\section{{{escape_latex(title)}}}")
        for e in exp:
            # escape_latex 会自动处理 **text** -> \textbf{text}
            company = escape_latex(e.get('company') or '')
            position = escape_latex(e.get('position') or '')
            duration = escape_latex(e.get('duration') or e.get('date') or '')
            
            # 自动组合：{company} – {position}（使用 \textendash 并显式空隙让破折号居中）
            if company and position:
                subsection_title = f"{company}\\hspace{{0.2em}}\\textendash\\hspace{{0.2em}}{position}"
            elif company:
                subsection_title = company
            elif position:
                subsection_title = position
            else:
                subsection_title = '未命名公司'
            
            content.append(f"\\datedsubsection{{{subsection_title}}}{{{duration}}}")
            achievements = e.get('achievements') or []
            if isinstance(achievements, list) and achievements:
                content.append(r"\begin{itemize}[label={},parsep=0.2ex]")
                for ach in achievements:
                    if isinstance(ach, str) and ach.strip():
                        content.append(f"  \\item {escape_latex(ach.strip())}")
                content.append(r"\end{itemize}")
            content.append("")
    return content


def _convert_markdown_bold(text: str) -> str:
    """将 **text** 转换为 \\textbf{text}"""
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
    \\datedsubsection{\\textbf{项目名}}{}
    \\begin{itemize}[parsep=0.2ex]
      \\item \\textbf{子项目标题}
        \\begin{itemize}[label=\\textbf{·},parsep=0.2ex]
          \\item 详情1
          \\item 详情2
        \\end{itemize}
    \\end{itemize}
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
                    # 有子项目结构 - 不带圆点的列表
                    content.append(r"\begin{itemize}[label={},parsep=0.2ex,itemsep=0ex]")
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
                    # #region agent log
                    try:
                        with open("/Users/wy770/AI 简历/.cursor/debug.log", "a", encoding="utf-8") as _f:
                            _f.write(json.dumps({
                                "sessionId": "debug-session",
                                "runId": "run-pre-fix",
                                "hypothesisId": "H1",
                                "location": "latex_sections.py:highlights",
                                "message": "enter highlights",
                                "data": {"title": full_title, "count": len(highlights)},
                                "timestamp": int(time.time() * 1000)
                            }) + "\n")
                    except Exception:
                        pass
                    # #endregion agent log
                    
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
                                    # 正确的正则：\[ 和 \] 在原始字符串中匹配普通方括号
                                    # 保留圆点标记，适度缩进 0.5cm
                                    converted = re.sub(
                                        r'\\begin\{itemize\}(\[[^\]]*\])?',
                                        r'\\begin{itemize}[label=$\\bullet$,parsep=0.05ex,itemsep=0ex,leftmargin=0.8cm,labelsep=0.5em,topsep=0ex,partopsep=0ex]',
                                        converted
                                    )
                                    converted = re.sub(
                                        r'\\begin\{enumerate\}(\[[^\]]*\])?',
                                        r'\\begin{enumerate}[leftmargin=0.8cm,labelsep=0.5em,topsep=0ex,partopsep=0ex]',
                                        converted
                                    )
                                    content.append(converted)
                                    # #region agent log
                                    try:
                                        with open("/Users/wy770/AI 简历/.cursor/debug.log", "a", encoding="utf-8") as _f:
                                            _f.write(json.dumps({
                                                "sessionId": "debug-session",
                                                "runId": "run-pre-fix",
                                                "hypothesisId": "H2",
                                                "location": "latex_sections.py:highlights",
                                                "message": "html passthrough list",
                                                "data": {"snippet": converted[:120]},
                                                "timestamp": int(time.time() * 1000)
                                            }) + "\n")
                                    except Exception:
                                        pass
                                    # #endregion agent log
                                else:
                                    # 否则包装成列表项（保留圆点，适度缩进）
                                    if not has_list_wrapper:
                                        content.append(r"\begin{itemize}[label=$\bullet$,parsep=0.2ex,itemsep=0ex,leftmargin=2cm,labelsep=0.5em]")
                                        has_list_wrapper = True
                                    content.append(f"  \\item {converted}")
                                    # #region agent log
                                    try:
                                        with open("/Users/wy770/AI 简历/.cursor/debug.log", "a", encoding="utf-8") as _f:
                                            _f.write(json.dumps({
                                                "sessionId": "debug-session",
                                                "runId": "run-pre-fix",
                                                "hypothesisId": "H3",
                                                "location": "latex_sections.py:highlights",
                                                "message": "html wrapped item",
                                                "data": {"snippet": converted[:120]},
                                                "timestamp": int(time.time() * 1000)
                                            }) + "\n")
                                    except Exception:
                                        pass
                                    # #endregion agent log
                        elif h.startswith('**') and '**' in h[2:]:
                            # Markdown 加粗格式（保留圆点，适度缩进）
                            if not has_list_wrapper:
                                content.append(r"\begin{itemize}[label=$\bullet$,parsep=0.2ex,itemsep=0ex,leftmargin=2cm,labelsep=0.5em]")
                                has_list_wrapper = True
                            converted = _convert_markdown_bold(h)
                            converted = escape_latex(converted.replace('\\textbf{', '<<<TEXTBF>>>').replace('}', '<<<ENDBF>>>')).replace('<<<TEXTBF>>>', '\\textbf{').replace('<<<ENDBF>>>', '}')
                            content.append(f"  \\item {converted}")
                            # #region agent log
                            try:
                                with open("/Users/wy770/AI 简历/.cursor/debug.log", "a", encoding="utf-8") as _f:
                                    _f.write(json.dumps({
                                        "sessionId": "debug-session",
                                        "runId": "run-pre-fix",
                                        "hypothesisId": "H4",
                                        "location": "latex_sections.py:highlights",
                                        "message": "markdown item",
                                        "data": {"snippet": converted[:120]},
                                        "timestamp": int(time.time() * 1000)
                                    }) + "\n")
                            except Exception:
                                pass
                            # #endregion agent log
                        else:
                            # 普通文本（保留圆点，适度缩进）
                            if not has_list_wrapper:
                                content.append(r"\begin{itemize}[label=$\bullet$,parsep=0.2ex,itemsep=0ex,leftmargin=2cm,labelsep=0.5em]")
                                has_list_wrapper = True
                            content.append(f"  \\item {escape_latex(h)}")
                            # #region agent log
                            try:
                                with open("/Users/wy770/AI 简历/.cursor/debug.log", "a", encoding="utf-8") as _f:
                                    _f.write(json.dumps({
                                        "sessionId": "debug-session",
                                        "runId": "run-pre-fix",
                                        "hypothesisId": "H5",
                                        "location": "latex_sections.py:highlights",
                                        "message": "plain item",
                                        "data": {"snippet": h[:120]},
                                        "timestamp": int(time.time() * 1000)
                                    }) + "\n")
                            except Exception:
                                pass
                            # #endregion agent log
                    
                    if has_list_wrapper:
                        content.append(r"\end{itemize}")
                
                content.append("")
                content.append("")
    return content


def generate_section_skills(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成专业技能 - 支持 HTML 编辑器内容
    如果 skillContent 存在，直接转换 HTML 为 LaTeX
    否则使用旧的 skills 数组格式
    """
    content = []
    title = (section_titles or {}).get('skills', '专业技能')
    
    # 优先使用 skillContent（HTML 格式）
    skill_content = resume_data.get('skillContent') or resume_data.get('skill_content') or ''
    if skill_content and skill_content.strip():
        content.append(f"\\section{{{escape_latex(title)}}}")
        # 检查 HTML 是否包含列表结构
        has_list = '<ul>' in skill_content or '<ol>' in skill_content
        
        if has_list:
            # 用户已使用工具栏添加了列表，直接转换（会保留圆点）
            latex_content = html_to_latex(skill_content.strip())
            content.append(latex_content)
        else:
            # 如果没有列表结构，按段落或换行分割成列表项（无圆点）
            latex_content = html_to_latex(skill_content.strip())
            # 按段落或换行分割
            if '\\par' in latex_content:
                paragraphs = latex_content.split('\\par')
            elif '\n\n' in latex_content:
                paragraphs = latex_content.split('\n\n')
            else:
                paragraphs = [latex_content]

            # 先收集有效的段落
            paragraph_items = []
            for para in paragraphs:
                para = para.strip()
                if para:
                    paragraph_items.append(f"  \\item {para}")

            # 只有在有内容时才添加itemize
            if paragraph_items:
                content.append(r"\begin{itemize}[label={},parsep=0.2ex]")
                content.extend(paragraph_items)
                content.append(r"\end{itemize}")
        content.append("")
        return content
    
    # 兼容旧的 skills 数组格式
    skills = resume_data.get('skills') or []
    if skills:
        # 先收集有效的技能项
        skill_items = []
        for s in skills:
            if isinstance(s, str):
                if s.strip():
                    if ':' in s or '：' in s:
                        parts = s.replace('：', ':').split(':', 1)
                        category = parts[0].strip()
                        details = parts[1].strip() if len(parts) > 1 else ''
                        if category and details:
                            skill_items.append(f"  \\item \\textbf{{{escape_latex(category)}:}} {escape_latex(details)}")
                        else:
                            skill_items.append(f"  \\item {escape_latex(s.strip())}")
                    else:
                        skill_items.append(f"  \\item {escape_latex(s.strip())}")
            elif isinstance(s, dict):
                category = escape_latex(s.get('category') or '').strip()
                details = s.get('details') or ''
                # 检查 details 是否是 HTML
                if '<' in details and '>' in details:
                    details = html_to_latex(details)
                else:
                    details = escape_latex(details)
                # 如果 category 为空，只输出 details
                if not category:
                    if details:
                        skill_items.append(f"  \\item {details}")
                elif details:
                    skill_items.append(f"  \\item \\textbf{{{category}:}} {details}")
                elif category:
                    skill_items.append(f"  \\item \\textbf{{{category}}}")

        # 只有在有内容时才创建section和itemize
        if skill_items:
            content.append(f"\\section{{{escape_latex(title)}}}")
            content.append(r"\begin{itemize}[label={},parsep=0.2ex]")
            content.extend(skill_items)
            content.append(r"\end{itemize}")
            content.append("")
    return content


def generate_section_education(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成教育经历 - 与 wy.tex 格式一致
    格式: \\datedsubsection{学校 - 专业 - 学位}{日期}
    \\ \\textbf{荣誉:} 荣誉内容
    """
    content = []
    edu = resume_data.get('education') or []
    section_title = (section_titles or {}).get('education', '教育经历')
    if isinstance(edu, list) and edu:
        _agent_log("H1", "latex_sections.py:generate_section_education", "enter education", {
            "count": len(edu),
        })
        content.append(f"\\section{{{escape_latex(section_title)}}}")
        for idx, ed in enumerate(edu):
            # 兼容多种字段名
            school = escape_latex(ed.get('title') or ed.get('school') or '')
            degree = escape_latex(ed.get('degree') or '')
            major = escape_latex(ed.get('subtitle') or ed.get('major') or '')
            duration = escape_latex(ed.get('date') or ed.get('duration') or '')
            
            # 构建标题：学校 - 专业 - 学位（学校和学位默认不加粗）
            title_parts = []
            if school:
                title_parts.append(school)
            if major:
                title_parts.append(major)
            if degree:
                title_parts.append(degree)
            
            title_str = " - ".join(title_parts) if title_parts else school
            
            if title_str:
                # 使用 \normalsize 字体，确保与实习经历一致
                latex_line = f"\\datedsubsection{{\\normalsize {title_str}}}{{\\normalsize {duration}}}"
                content.append(latex_line)
                _agent_log("H1", "latex_sections.py:generate_section_education", "item computed", {
                    "idx": idx,
                    "title_str": title_str,
                    "duration": duration,
                    "latex_line": latex_line,
                })
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
        # 先收集有效的奖项内容
        award_items = []
        for a in awards:
            if isinstance(a, str):
                if a.strip():
                    award_items.append(f"  \\item {escape_latex(a.strip())}")
                continue
            title = escape_latex(a.get('title') or '')
            issuer = escape_latex(a.get('issuer') or '')
            date = escape_latex(a.get('date') or '')
            parts = [s for s in [title, issuer] if s]
            subsection_title = " - ".join(parts) if parts else title or issuer
            if subsection_title:
                award_items.append(f"  \\item {subsection_title}" + (f" ({date})" if date else ""))

        # 只有在有内容时才创建section和itemize
        if award_items:
            content.append(f"\\section{{{escape_latex(section_title)}}}")
            content.append(r"\begin{itemize}[label={},parsep=0.2ex]")
            content.extend(award_items)
            content.append(r"\end{itemize}")
            content.append("")
    return content


def generate_section_opensource(resume_data: Dict[str, Any], section_titles: Dict[str, str] = None) -> List[str]:
    """
    生成开源经历 - 与 wy.tex 格式一致
    格式:
    \\datedsubsection{\\textbf{项目名}}{角色}
    \\begin{itemize}[parsep=0.2ex]
      \\item 仓库: \\textit{url}
      \\item 贡献描述
    \\end{itemize}

    支持两种字段格式：
    1. AI返回格式: title, subtitle, items, repoUrl/date
    2. 编辑器格式: name, role, description, repo/date
    """
    content = []
    # 兼容 openSource、opensource、open_source 三种字段名
    open_source = resume_data.get('openSource') or resume_data.get('opensource') or resume_data.get('open_source') or []
    title = (section_titles or {}).get('openSource', '开源经历')
    if isinstance(open_source, list) and open_source:
        content.append(f"\\section{{{escape_latex(title)}}}")
        for os_item in open_source:
            # 兼容两种字段名
            item_title = escape_latex(
                os_item.get('title') or os_item.get('name') or ''
            )
            subtitle = escape_latex(
                os_item.get('subtitle') or os_item.get('role') or ''
            )
            # 兼容多种字段名获取仓库链接
            repo_url = (os_item.get('repo') or  # 前端使用 repo
                       os_item.get('repoUrl') or
                       os_item.get('link') or
                       os_item.get('url') or '')

            # 获取日期（如果有）
            date = os_item.get('date') or ''
            if date:
                subtitle = f"{subtitle} ({date})" if subtitle else date

            subsection_title = f"\\textbf{{{item_title}}}"
            content.append(f"\\datedsubsection{{{subsection_title}}}{{{subtitle}}}")

            # 处理贡献描述 - description 是 HTML 格式
            description = os_item.get('description') or ''

            # 准备要显示的内容
            item_contents = []

            if repo_url:
                escaped_url = escape_latex(repo_url)
                item_contents.append(f"仓库: \\textit{{{escaped_url}}}")

            if description:
                # description 是 HTML 格式，需要转换
                from .html_to_latex import html_to_latex
                converted_desc = html_to_latex(description)
                if converted_desc.strip():
                    # 如果转换后的内容包含列表标签，直接添加
                    if '\\begin{itemize}' in converted_desc or '\\begin{enumerate}' in converted_desc:
                        item_contents.append(converted_desc)
                    else:
                        # 否则作为普通文本，按行拆分
                        if '\n' in converted_desc:
                            for desc in converted_desc.split('\n'):
                                if desc.strip():
                                    item_contents.append(escape_latex(desc.strip()))
                        else:
                            if converted_desc.strip():
                                item_contents.append(escape_latex(converted_desc.strip()))

            # 如果有内容，生成itemize（除非已经包含列表）
            if item_contents:
                # 检查是否已经包含列表结构
                has_list = any('\\begin{itemize}' in item or '\\begin{enumerate}' in item for item in item_contents)
                if not has_list:
                    content.append(r"\begin{itemize}[label={},parsep=0.2ex]")
                    for item in item_contents:
                        content.append(f"  \\item {item}")
                    content.append(r"\end{itemize}")
                else:
                    # 已经包含列表结构，直接添加
                    for item in item_contents:
                        content.append(item)

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
    'openSource': generate_section_opensource,  # 前端使用的字段名
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
