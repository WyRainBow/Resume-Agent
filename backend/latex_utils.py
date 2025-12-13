"""
LaTeX 工具函数模块
提供 LaTeX 特殊字符转义和简历数据标准化功能
"""
import re
from typing import Dict, Any


def escape_latex(text: str) -> str:
    """
    转义 LaTeX 特殊字符，并处理 Markdown 加粗语法
    """
    if not isinstance(text, str):
        text = str(text)
    
    """先处理 **text** -> \textbf{text} (在转义之前)"""
    bold_pattern = re.compile(r'\*\*(.+?)\*\*')
    bold_matches = []
    
    def save_bold(match):
        bold_matches.append(match.group(1))
        return f'__BOLD_{len(bold_matches)-1}__'
    
    text = bold_pattern.sub(save_bold, text)
    
    """移除换行符（LaTeX 命令参数不能跨行）"""
    text = text.replace('\n', ' ').replace('\r', ' ')
    
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
    
    """恢复加粗文本（转义后的内容需要再次转义）"""
    for i, bold_text in enumerate(bold_matches):
        escaped_bold = bold_text
        for char, replacement in replacements.items():
            escaped_bold = escaped_bold.replace(char, replacement)
        result = result.replace(f'\\_\\_BOLD\\_{i}\\_\\_', f'\\textbf{{{escaped_bold}}}')
    
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
    """字段名映射表：中文 -> 英文"""
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
        """如果是中文字段名，转换为英文"""
        english_key = field_mapping.get(key, key)
        
        """特殊处理：联系信息字段"""
        if english_key in ['phone', 'email', 'location']:
            contact_info[english_key] = value
        else:
            """处理嵌套结构"""
            if isinstance(value, list):
                normalized[english_key] = [
                    normalize_item(item, field_mapping) if isinstance(item, dict) else item 
                    for item in value
                ]
            elif isinstance(value, dict) and key != 'contact':
                normalized[english_key] = normalize_item(value, field_mapping)
            else:
                normalized[english_key] = value
    
    """合并 contact 信息"""
    if contact_info:
        if 'contact' not in normalized:
            normalized['contact'] = {}
        """如果 contact 是字符串，转换为字典"""
        if isinstance(normalized.get('contact'), str):
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
    """项目/经历项的字段映射"""
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
        """递归处理嵌套结构"""
        if isinstance(v, dict):
            normalized_item[english_key] = normalize_item(v, field_mapping)
        elif isinstance(v, list):
            normalized_item[english_key] = [
                normalize_item(sub, field_mapping) if isinstance(sub, dict) else sub 
                for sub in v
            ]
        else:
            normalized_item[english_key] = v
    
    return normalized_item
