"""教育经历解析器"""

import re
from typing import Dict, Any, List, Tuple


def parse_education(lines: List[str], start_idx: int) -> Tuple[List[Dict[str, Any]], int]:
    """
    解析教育经历部分
    
    支持格式：
    - "某高校 - 某专业 - 本科（2022.09 - 2026.06）"
    - "清华大学 计算机科学 硕士 2020-2023"
    - "荣誉： 学科竞赛、省级奖项等"
    """
    education = []
    current_edu = None
    i = start_idx
    
    """结束关键词"""
    end_keywords = ['项目', '工作', '实习', '技能', '开源']
    
    while i < len(lines):
        line = lines[i].strip()
        
        """遇到其他部分时停止"""
        if any(kw in line for kw in end_keywords) and '荣誉' not in line and '奖项' not in line:
            break
        
        """跳过空行"""
        if not line:
            i += 1
            continue
        
        """提取荣誉信息"""
        if '荣誉' in line or '奖项' in line:
            honor_match = re.search(r'[：:]\s*(.+)$', line)
            if honor_match and current_edu:
                current_edu['honors'] = honor_match.group(1).strip()
            i += 1
            continue
        
        """检测教育经历行（包含学校关键词）"""
        if any(kw in line for kw in ['大学', '学院', '高校', '本科', '硕士', '博士', '学位']):
            edu = {}
            
            """提取时间"""
            time_patterns = [
                r'[\(（]\s*(\d{4}[.\-/]?\d{0,2}\s*[-–~至]\s*\d{4}[.\-/]?\d{0,2})\s*[\)）]',
                r'(\d{4}[.\-/]\d{1,2}\s*[-–~至]\s*\d{4}[.\-/]\d{1,2})',
                r'(\d{4}\s*[-–~至]\s*\d{4})',
            ]
            
            for pattern in time_patterns:
                match = re.search(pattern, line)
                if match:
                    edu['date'] = match.group(1).strip()
                    line = re.sub(pattern, '', line).strip()
                    """清理括号"""
                    line = re.sub(r'[\(（\)）]', '', line).strip()
                    break
            
            """分割学校、专业、学位"""
            parts = re.split(r'\s*[-–—/]\s*', line)
            parts = [p.strip() for p in parts if p.strip()]
            
            if parts:
                """组合成标题"""
                edu['title'] = ' - '.join(parts)
            
            if edu:
                education.append(edu)
                current_edu = edu
        
        i += 1
    
    return education, i

