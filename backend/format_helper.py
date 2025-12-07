"""
简历文本格式化助手（模块化版本）

将复杂的解析逻辑拆分到 parsers/ 目录下的独立模块：
- json_parser.py: JSON 修复和正则提取
- contact_parser.py: 联系方式和姓名
- internship_parser.py: 实习经历
- project_parser.py: 项目经验
- skill_parser.py: 专业技能
- education_parser.py: 教育经历
- opensource_parser.py: 开源经历

更新日志：
- 2025-12-07: 模块化重构，提升可维护性和解析速度
"""

from typing import Dict, Any, Optional, Tuple

"""导入各个解析器"""
from backend.parsers import (
    try_json_repair,
    try_regex_extract,
    parse_name,
    parse_contact,
    parse_internships,
    parse_projects,
    parse_skills,
    parse_education,
    parse_opensource,
)


def try_smart_parse(text: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    智能解析（调用各个独立解析器）
    
    解析顺序：
    1. 姓名和联系方式
    2. 按段落解析：实习、项目、开源、技能、教育
    """
    try:
        result = {}
        lines = text.split('\n')
        clean_lines = [line.strip() for line in lines]
        
        if not any(clean_lines):
            return None, "文本为空"
        
        """1. 解析姓名"""
        name = parse_name(clean_lines)
        if name:
            result['name'] = name
        
        """2. 解析联系方式"""
        contact = parse_contact(text)
        if contact:
            result['contact'] = contact
        
        """3. 按段落解析"""
        i = 0
        while i < len(clean_lines):
            line = clean_lines[i]
            
            """实习经历"""
            if '实习经历' in line and not any(c in line for c in ['一', '二', '三', '四', '五']):
                internships, i = parse_internships(clean_lines, i + 1)
                if internships:
                    result['internships'] = internships
                continue
            
            """项目经验"""
            if '项目经验' in line or '项目经历' in line:
                projects, i = parse_projects(clean_lines, i + 1)
                if projects:
                    result['projects'] = projects
                continue
            
            """开源经历"""
            if '开源经历' in line or '开源贡献' in line:
                opensource, i = parse_opensource(clean_lines, i + 1)
                if opensource:
                    result['openSource'] = opensource
                continue
            
            """专业技能"""
            if '专业技能' in line:
                skills, i = parse_skills(clean_lines, i + 1)
                if skills:
                    result['skills'] = skills
                continue
            
            """教育经历"""
            if '教育经历' in line or '教育背景' in line:
                education, i = parse_education(clean_lines, i + 1)
                if education:
                    result['education'] = education
                continue
            
            i += 1
        
        return result, None if result else (None, "无法提取任何信息")
        
    except Exception as e:
        return None, f"智能解析异常: {str(e)}"


def _is_result_complete(data: Dict[str, Any]) -> bool:
    """判断解析结果是否完整"""
    has_basic = bool(data.get('name') or data.get('contact'))
    has_content = bool(
        data.get('experience') or 
        data.get('projects') or 
        data.get('skills') or 
        data.get('education') or
        data.get('internships') or
        data.get('openSource')
    )
    return has_basic and has_content


def format_resume_text(text: str, use_ai: bool = True, ai_callback=None) -> Dict[str, Any]:
    """
    多层降级的简历格式化
    
    策略：
    1. json-repair: 尝试修复 JSON（最快）
    2. regex: 提取 JSON 片段
    3. smart: 智能解析纯文本（快速，无需 AI）
    4. ai: 调用 AI 解析（慢，最后手段）
    """
    
    """第1层：json-repair"""
    data, error = try_json_repair(text)
    if data:
        return {"success": True, "data": data, "method": "json-repair", "error": None}
    
    """第2层：正则提取"""
    data, error = try_regex_extract(text)
    if data:
        return {"success": True, "data": data, "method": "regex", "error": None}
    
    """第3层：智能解析（快速路径）"""
    smart_data, error = try_smart_parse(text)
    
    if smart_data and _is_result_complete(smart_data):
        return {"success": True, "data": smart_data, "method": "smart", "error": None}
    
    """第4层：AI 解析（仅在 smart 失败时）"""
    if use_ai and ai_callback:
        try:
            ai_data = ai_callback(text)
            if smart_data:
                merged = {**smart_data, **ai_data}
                if smart_data.get('contact') and ai_data.get('contact'):
                    merged['contact'] = {**smart_data['contact'], **ai_data['contact']}
                return {"success": True, "data": merged, "method": "ai", "error": None}
            return {"success": True, "data": ai_data, "method": "ai", "error": None}
        except Exception as e:
            if smart_data:
                return {"success": True, "data": smart_data, "method": "smart", "error": f"AI 失败: {str(e)}"}
            return {"success": False, "data": None, "method": "ai", "error": f"AI 失败: {str(e)}"}
    
    """降级返回"""
    if smart_data:
        return {"success": True, "data": smart_data, "method": "smart", "error": "结果可能不完整"}
    
    return {"success": False, "data": None, "method": "none", "error": "所有方法都失败"}
