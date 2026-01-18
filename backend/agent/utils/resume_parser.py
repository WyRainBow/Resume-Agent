"""
简历解析器 - 从 Markdown 格式的简历文件解析结构化数据
"""

import re
from typing import Dict, List, Optional


def parse_markdown_resume(file_path: str) -> Dict:
    """从 Markdown 文件解析简历数据

    Args:
        file_path: 简历文件路径

    Returns:
        简历数据字典
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return parse_markdown_content(content)


def parse_markdown_content(content: str) -> Dict:
    """从 Markdown 内容解析简历数据

    Args:
        content: Markdown 格式的简历内容

    Returns:
        简历数据字典
    """
    resume = {
        "basic": {},
        "education": [],
        "experience": [],
        "projects": [],
        "openSource": [],
        "skillContent": "",
        "awards": []
    }

    lines = content.split('\n')
    i = 0
    current_section = None

    # 提取姓名（从标题）
    if lines and lines[0].startswith('#'):
        name_match = re.search(r'#\s*(.+?)\s*(?:-|–|\(|个人简历)', lines[0])
        if name_match:
            resume["basic"]["name"] = name_match.group(1).strip()
        i += 1

    while i < len(lines):
        line = lines[i].strip()

        # 检测章节标题
        if line.startswith('##') or line.startswith('###'):
            section_title = re.sub(r'^#+\s*', '', line).strip()

            # 判断章节类型
            if any(keyword in section_title for keyword in ['基本信息', 'Basic', '个人']):
                current_section = 'basic'
                i += 1
                # 解析基本信息
                i = _parse_basic_info(lines, i, resume["basic"])

            elif any(keyword in section_title for keyword in ['教育', 'Education', '学历']):
                current_section = 'education'
                i += 1
                i = _parse_education(lines, i, resume["education"])

            elif any(keyword in section_title for keyword in ['实习', '工作', '经历', 'Experience', '实习经历']):
                current_section = 'experience'
                i += 1
                i = _parse_experience(lines, i, resume["experience"])

            elif any(keyword in section_title for keyword in ['项目', 'Project', '项目经验']):
                current_section = 'projects'
                i += 1
                i = _parse_projects(lines, i, resume["projects"])

            elif any(keyword in section_title for keyword in ['技能', 'Skills', '技术']):
                current_section = 'skills'
                i += 1
                i = _parse_skills(lines, i, resume)

            elif any(keyword in section_title for keyword in ['奖项', '荣誉', 'Awards', '证书']):
                current_section = 'awards'
                i += 1
                i = _parse_awards(lines, i, resume["awards"])

            else:
                i += 1
        else:
            i += 1

    # 从基本信息推断求职意向
    if "title" not in resume["basic"] and "basic" in resume:
        # 如果没有职位，可以从内容推断
        if "求职意向" in str(resume["basic"]):
            for key, value in resume["basic"].items():
                if "求职" in key or "意向" in key:
                    resume["basic"]["title"] = value
                    break
        else:
            resume["basic"]["title"] = "软件工程师"  # 默认值

    # 添加 menuSections，控制前端显示的模块
    resume["menuSections"] = [
        {"id": "basic", "title": "基本信息", "icon": "", "enabled": True, "order": 0},
        {"id": "education", "title": "教育经历", "icon": "", "enabled": True, "order": 1},
        {"id": "experience", "title": "工作经历", "icon": "", "enabled": True, "order": 2},
        {"id": "projects", "title": "项目经历", "icon": "", "enabled": True, "order": 3},
        {"id": "skills", "title": "专业技能", "icon": "", "enabled": True, "order": 4},
        {"id": "awards", "title": "荣誉奖项", "icon": "", "enabled": True, "order": 5},
    ]

    # 为每个教育经历添加 id
    for idx, edu in enumerate(resume.get("education", [])):
        if "id" not in edu:
            edu["id"] = f"edu-{idx}"

    # 为每个工作经历添加 id
    for idx, exp in enumerate(resume.get("experience", [])):
        if "id" not in exp:
            exp["id"] = f"exp-{idx}"

    # 为每个项目添加 id
    for idx, proj in enumerate(resume.get("projects", [])):
        if "id" not in proj:
            proj["id"] = f"proj-{idx}"

    # 为每个奖项添加 id
    for idx, award in enumerate(resume.get("awards", [])):
        if "id" not in award:
            award["id"] = f"award-{idx}"

    return resume


def _parse_basic_info(lines: List[str], start_idx: int, basic: Dict) -> int:
    """解析基本信息"""
    i = start_idx
    while i < len(lines):
        line = lines[i].strip()

        # 遇到新的章节标题则停止
        if line.startswith('##') or line.startswith('###'):
            break

        # 跳过空行
        if not line:
            i += 1
            continue

        # 去除列表标记
        if line.startswith('-') or line.startswith('*'):
            line = line[1:].strip()

        # 尝试匹配 "**键**: 值" 或 "键: 值" 格式
        match = re.match(r'\*{0,2}([^*:：]+)\*{0,2}[:：]\s*(.+)', line)
        if match:
            key = match.group(1).strip().strip('*').strip()
            value = match.group(2).strip()

            # 标准化键名
            key_map = {
                '电话': 'phone',
                '手机': 'phone',
                '邮箱': 'email',
                'Email': 'email',
                '年龄': 'age',
                '求职意向': 'title',
                '现居地': 'location',
                '地址': 'location',
                '姓名': 'name',
                'Name': 'name'
            }

            normalized_key = key_map.get(key, key)
            # 只保留标准的基本信息字段
            if normalized_key in key_map.values() or key in key_map:
                basic[normalized_key] = value

        i += 1

    return i


def _get_degree_level(degree: str) -> str:
    """获取学历层次

    Returns:
        "博士", "硕士", "本科", "专科", "其他"
    """
    if not degree:
        return "其他"
    if any(kw in degree for kw in ['博士', 'PhD', 'Doctor']):
        return "博士"
    elif any(kw in degree for kw in ['硕士', 'Master', '研究生']):
        return "硕士"
    elif any(kw in degree for kw in ['本科', '学士', 'Bachelor']):
        return "本科"
    elif any(kw in degree for kw in ['专科', '高职', '大专']):
        return "专科"
    return "其他"


def _parse_education(lines: List[str], start_idx: int, education: List) -> int:
    """解析教育经历"""
    i = start_idx
    current_edu = None

    while i < len(lines):
        line = lines[i].strip()

        # 遇到顶级章节标题则停止
        if line.startswith('##') and not line.startswith('###'):
            if current_edu:
                education.append(current_edu)
            break

        # 检测新的教育经历（### 开头明确标记新的子章节）
        if line.startswith('###'):
            # 保存上一个教育经历
            if current_edu:
                # 只有当有有效数据时才添加
                if current_edu.get("school") or current_edu.get("degree"):
                    education.append(current_edu)

            # 解析学校行：### 后面跟着学校信息
            school_line = re.sub(r'^#+\s*', '', line).strip()
            parts = re.split(r'[|｜]', school_line)

            current_edu = {
                "school": parts[0].strip().replace('*', '').strip() if parts else "",
                "degree": "",
                "major": "",
                "startDate": "",
                "endDate": "",
                "description": ""
            }

            # 解析后续的学位和专业信息
            if len(parts) > 1:
                for part in parts[1:]:
                    part = part.strip().replace('*', '')
                    if any(kw in part for kw in ['本科', '硕士', '博士', '学士', 'Bachelor', 'Master', 'PhD', '专升本', '专科']):
                        current_edu["degree"] = part
                    elif any(kw in part for kw in ['专业', '级', 'class']) or '专业' in part:
                        current_edu["major"] = part
                    else:
                        # 如果没有明确的学位/专业标记，根据内容推断
                        if not current_edu["major"]:
                            current_edu["major"] = part

        # 检测非 ### 开头的学校行（如 **广东药科大学** | 本科 | 计算机科学与技术专业）
        elif current_edu is None and (line.startswith('**') or '|' in line) and any(keyword in line for keyword in ['大学', '学院', 'School', 'University']):
            # 解析学校行
            school_line = line.replace('**', '').strip()
            parts = re.split(r'[|｜]', school_line)

            current_edu = {
                "school": parts[0].strip() if parts else "",
                "degree": parts[1].strip() if len(parts) > 1 else "",
                "major": parts[2].strip().replace('专业', '').strip() if len(parts) > 2 else "",
                "startDate": "",
                "endDate": "",
                "description": ""
            }

        elif current_edu:
            # 解析教育经历的详细信息
            # 去除列表标记
            original_line = line
            if line.startswith('-') or line.startswith('*'):
                line = line[1:].strip()

            # 时间信息（优先检查，避免误判）
            time_match = re.search(r'(\d{4})[年\-./](\d{1,2})[月\-./]?[^\d]*(\d{4})?[年\-./]?(\d{1,2})?', original_line)
            if time_match:
                current_edu["startDate"] = f"{time_match.group(1)}-{time_match.group(2).zfill(2)}"
                if time_match.group(3):
                    current_edu["endDate"] = f"{time_match.group(3)}-{time_match.group(4).zfill(2)}"
                # 已经处理了时间行，跳过后续处理
                i += 1
                continue

            # 跳过已经处理过的学校信息行（避免重复）
            if any(keyword in line for keyword in ['大学', '学院', 'School', 'University']):
                # 这行可能是学校信息，但不是以 ### 开头的，跳过避免重复
                pass
            # 其他描述信息
            elif line and not line.startswith('#'):
                if current_edu["description"]:
                    current_edu["description"] += "\n" + line
                else:
                    current_edu["description"] = line

        i += 1

    # 保存最后一个教育经历
    if current_edu and (current_edu.get("school") or current_edu.get("degree")):
        education.append(current_edu)

    # 去重：同一学校 + 同一学历层次只保留一条
    seen = set()
    unique_education = []
    for edu in education:
        school = edu.get("school", "")
        degree = edu.get("degree", "")
        level = _get_degree_level(degree)
        # 创建唯一标识：学校 + 学历层次
        key = f"{school}_{level}"
        if key not in seen and school:
            seen.add(key)
            unique_education.append(edu)

    # 清空原列表并添加去重后的结果
    education.clear()
    education.extend(unique_education)

    return i


def _parse_experience(lines: List[str], start_idx: int, experience: List) -> int:
    """解析工作/实习经历"""
    i = start_idx
    current_exp = None

    while i < len(lines):
        line = lines[i].strip()

        # 遇到顶级章节标题则停止
        if line.startswith('##') and not line.startswith('###'):
            if current_exp:
                experience.append(current_exp)
                current_exp = None  # 防止重复添加
            break

        # 检测新的经历（### 开头或包含公司名格式）
        if line.startswith('###') or (line and not line.startswith('-') and re.search(r'[|｜].*[|｜]', line)):
            if current_exp:
                experience.append(current_exp)

            # 解析公司行：格式如 "### 腾讯云 - 后端开发实习生" 或 "腾讯云 | 后端开发实习生"
            parts = re.split(r'[|｜]|[-—–]', line.lstrip('#').strip())

            current_exp = {
                "company": parts[0].strip() if parts else "",
                "position": parts[1].strip() if len(parts) > 1 else "",
                "date": "",
                "details": ""
            }

        elif current_exp:
            # 解析经历的详细信息
            if line.startswith('-') or line.startswith('*'):
                line = line[1:].strip()

            # 时间信息
            time_match = re.search(r'(\d{4})[年\-./](\d{1,2})[月\-./]?[^\d]*(\d{4})?[年\-./]?(\d{1,2})?', line)
            if time_match:
                current_exp["date"] = line
            # 地点信息（单独一行）
            elif len(line) < 10 and any(city in line for city in ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉']):
                current_exp["location"] = line
            # 工作内容
            elif line and not line.startswith('#'):
                if current_exp["details"]:
                    current_exp["details"] += "\n" + line
                else:
                    current_exp["details"] = line

        i += 1

    if current_exp:
        experience.append(current_exp)

    return i


def _parse_projects(lines: List[str], start_idx: int, projects: List) -> int:
    """解析项目经验"""
    i = start_idx
    current_proj = None

    while i < len(lines):
        line = lines[i].strip()

        # 遇到顶级章节标题则停止
        if line.startswith('##') and not line.startswith('###'):
            if current_proj:
                projects.append(current_proj)
                current_proj = None  # 防止重复添加
            break

        # 检测新项目
        if line.startswith('###') or (line and not line.startswith('-') and '（' in line):
            if current_proj:
                projects.append(current_proj)

            # 解析项目名：格式如 "### 项目名（时间）"
            proj_name = re.sub(r'^#+\s*', '', line).split('（')[0].split('(')[0].strip()
            time_match = re.search(r'(\d{4})[年\-./](\d{1,2})', line)

            current_proj = {
                "name": proj_name,
                "role": "",
                "date": time_match.group(0) if time_match else "",
                "description": "",
                "link": ""
            }

        elif current_proj:
            # 解析项目详细信息
            if line.startswith('-') or line.startswith('*'):
                line = line[1:].strip()

            if line and not line.startswith('#'):
                if current_proj["description"]:
                    current_proj["description"] += "\n" + line
                else:
                    current_proj["description"] = line

        i += 1

    if current_proj:
        projects.append(current_proj)

    return i


def _parse_skills(lines: List[str], start_idx: int, resume: Dict) -> int:
    """解析技能"""
    i = start_idx
    skills_html = ""

    while i < len(lines):
        line = lines[i].strip()

        # 遇到新章节则停止
        if line.startswith('##') or line.startswith('###'):
            break

        if line and not line.startswith('#'):
            skills_html += line + "\n"

        i += 1

    resume["skillContent"] = skills_html.strip()
    return i


def _parse_awards(lines: List[str], start_idx: int, awards: List) -> int:
    """解析奖项荣誉"""
    i = start_idx

    while i < len(lines):
        line = lines[i].strip()

        # 遇到新章节则停止
        if line.startswith('##') or line.startswith('###'):
            break

        # 解析奖项列表
        if line.startswith('-') or line.startswith('*'):
            line = line[1:].strip()
            if line:
                awards.append({"title": line, "issuer": "", "date": ""})
        elif line and not line.startswith('#'):
            awards.append({"title": line, "issuer": "", "date": ""})

        i += 1

    return i
