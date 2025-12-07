"""技能解析器"""

import re
from typing import Dict, Any, List, Tuple, Union


def parse_skills(lines: List[str], start_idx: int) -> Tuple[List[Union[str, Dict[str, str]]], int]:
    """
    解析专业技能部分
    
    支持格式：
    1. 分类格式：
       - "后端： 熟悉若干编程语言或服务框架"
       - "数据库： 了解常见数据库及调优思路"
    
    2. 列表格式：
       - "Java、Go、Python、Redis"
       - "技能：Java, Go, Python"
    
    Returns:
        (skills, end_idx): 技能列表和结束位置
        技能可以是字符串列表或分类对象列表
    """
    skills = []
    i = start_idx
    
    """结束关键词"""
    end_keywords = ['教育经历', '教育背景', '荣誉', '奖项', '证书', '项目', '工作', '实习']
    
    while i < len(lines):
        line = lines[i].strip()
        
        """遇到其他部分时停止"""
        if any(kw in line for kw in end_keywords):
            break
        
        """跳过空行"""
        if not line:
            i += 1
            continue
        
        """解析分类格式：类别：描述"""
        if '：' in line or ':' in line:
            sep = '：' if '：' in line else ':'
            parts = line.split(sep, 1)
            if len(parts) == 2:
                category = parts[0].strip()
                details = parts[1].strip()
                """过滤掉不像技能的行（如仓库链接）"""
                if category and details and 'http' not in line and '仓库' not in line:
                    skills.append({
                        'category': category,
                        'details': details
                    })
        
        i += 1
    
    return skills, i


def parse_skills_simple(text: str) -> List[str]:
    """
    简单技能提取（用于"技能：Java, Go, Python"格式）
    """
    skills = []
    
    """查找技能关键词后的内容"""
    patterns = [
        r'(?:技能|技术栈|专业技能)[：:]\s*(.+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            skill_text = match.group(1).strip()
            """分割（支持多种分隔符）"""
            items = re.split(r'[、,，;；/|]', skill_text)
            skills.extend([s.strip() for s in items if s.strip()])
            break
    
    return skills

