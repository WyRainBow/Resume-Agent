"""开源经历解析器"""

import re
from typing import Dict, Any, List, Tuple


def parse_opensource(lines: List[str], start_idx: int) -> Tuple[List[Dict[str, Any]], int]:
    """
    解析开源经历部分
    
    支持格式：
    - 社区贡献一（某分布式项目）
      - 仓库：https://example.com/repo1
      - 简述提交的核心 PR 或 Issue 处理经验
    - 社区贡献二
      - 组件一： xxx
      - 能力二： xxx
    """
    opensource = []
    current_item = None
    i = start_idx
    
    """结束关键词"""
    end_keywords = ['专业技能', '技能', '教育经历', '教育背景', '荣誉', '奖项', '项目经验', '工作经历']
    
    while i < len(lines):
        line = lines[i].strip()
        
        """遇到其他部分时停止"""
        if any(kw in line for kw in end_keywords):
            break
        
        """跳过空行"""
        if not line:
            i += 1
            continue
        
        """检测贡献标题（社区贡献一、社区贡献二等）"""
        if re.match(r'^社区贡献[一二三四五六七八九十\d]*', line):
            """保存之前的项目"""
            if current_item:
                opensource.append(current_item)
            
            """提取括号中的项目名作为副标题"""
            subtitle_match = re.search(r'[（(](.+?)[)）]', line)
            subtitle = subtitle_match.group(1) if subtitle_match else None
            
            """标题（去除括号部分）"""
            title = re.sub(r'[（(].+?[)）]', '', line).strip()
            
            current_item = {
                'title': title,
                'subtitle': subtitle,
                'items': []
            }
            i += 1
            continue
        
        """普通描述行"""
        if current_item and line:
            current_item['items'].append(line)
        
        i += 1
    
    """保存最后一个项目"""
    if current_item:
        opensource.append(current_item)
    
    return opensource, i

