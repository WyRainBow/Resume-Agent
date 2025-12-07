"""联系方式和姓名解析器"""

import re
from typing import Dict, Any, Optional, List


def parse_name(lines: List[str]) -> Optional[str]:
    """
    提取姓名（通常是第一个非关键词行）
    """
    keywords = ['联系', '工作', '实习', '项目', '技能', '教育', '经历', '经验', '求职', '方向']
    
    for line in lines:
        line = line.strip()
        if line and not any(kw in line for kw in keywords):
            # 排除看起来像联系方式的行
            if '@' not in line and not re.match(r'^\d{3}', line):
                return line
    
    return None


def parse_contact(text: str) -> Dict[str, str]:
    """
    提取联系方式
    
    支持：
    - 电话：000-0000-0000 或 00000000000
    - 邮箱：xxx@xxx.com
    - 求职方向：xxx工程师
    """
    contact = {}
    
    # 电话
    phone_patterns = [
        r'(?:联系方式|电话|手机)[：:]\s*(\d{3}[-\s]?\d{4}[-\s]?\d{4})',
        r'(\d{3}[-\s]?\d{4}[-\s]?\d{4})',
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            contact['phone'] = match.group(1).replace(' ', '').replace('-', '-')
            break
    
    # 邮箱
    email_patterns = [
        r'(?:邮箱|Email)[：:]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
        r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    ]
    for pattern in email_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            contact['email'] = match.group(1)
            break
    
    # 求职方向
    role_match = re.search(r'求职方向[：:]\s*(.+?)(?:\n|$)', text)
    if role_match:
        contact['role'] = role_match.group(1).strip()
    
    return contact

