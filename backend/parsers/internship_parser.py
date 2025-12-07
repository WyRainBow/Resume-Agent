"""实习经历解析器"""

import re
from typing import Dict, Any, Optional, List, Tuple


def _parse_single_internship(line: str) -> Optional[Dict[str, Any]]:
    """
    解析单条实习经历
    
    支持格式：
    - "实习经历一 - 某职位（2025.06 - 2025.10）"
    - "字节跳动 - 后端工程师（2024.06 - 2024.10）"
    - "某公司 后端开发 2024.01-2024.06"
    """
    if not line or len(line) < 5:
        return None
    
    result = {}
    original_line = line
    
    """提取时间（括号内）"""
    time_patterns = [
        r'[\(（]\s*(\d{4}[.\-/年]\d{1,2}[月]?\s*[-–~至]\s*\d{4}[.\-/年]\d{1,2}[月]?)\s*[\)）]',
        r'[\(（]\s*(\d{4}[.\-/年]\d{1,2}[月]?\s*[-–~至]\s*(?:至今|现在))\s*[\)）]',
        r'(\d{4}[.\-/]\d{1,2}\s*[-–~至]\s*\d{4}[.\-/]\d{1,2})',
    ]
    
    for pattern in time_patterns:
        match = re.search(pattern, line)
        if match:
            result['date'] = match.group(1).strip()
            line = re.sub(pattern, '', line).strip()
            break
    
    """清理多余符号"""
    line = re.sub(r'^[\-–—·•]\s*', '', line).strip()
    line = re.sub(r'\s*[\-–—]\s*$', '', line).strip()
    
    """分割标题和副标题（职位）"""
    separators = [' - ', ' – ', ' — ', '－']
    for sep in separators:
        if sep in line:
            parts = line.split(sep, 1)
            if len(parts) == 2:
                result['title'] = parts[0].strip()
                result['subtitle'] = parts[1].strip()
                return result if result.get('title') else None
    
    """没有分隔符时，整行作为标题"""
    if line:
        result['title'] = line
    
    return result if result.get('title') else None


def parse_internships(lines: List[str], start_idx: int) -> Tuple[List[Dict[str, Any]], int]:
    """
    解析实习经历部分
    
    Args:
        lines: 所有行
        start_idx: 开始位置（"实习经历"关键词后一行）
    
    Returns:
        (internships, end_idx): 实习列表和结束位置
    """
    internships = []
    i = start_idx
    
    """结束关键词"""
    end_keywords = ['项目经验', '项目经历', '开源', '技能', '教育', '荣誉', '奖项']
    
    while i < len(lines):
        line = lines[i].strip()
        
        """遇到其他部分时停止"""
        if any(kw in line for kw in end_keywords):
            break
        
        """跳过空行"""
        if not line:
            i += 1
            continue
        
        """解析实习经历行"""
        intern = _parse_single_internship(line)
        if intern:
            internships.append(intern)
        
        i += 1
    
    return internships, i

