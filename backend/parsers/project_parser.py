"""项目经验解析器"""

import re
from typing import Dict, Any, List, Tuple


def parse_projects(lines: List[str], start_idx: int) -> Tuple[List[Dict[str, Any]], int]:
    """
    解析项目经验部分
    
    支持层级结构：
    - 项目一
      - 子项目甲
        - 描述1
        - 描述2
      - 子项目乙
        - 描述...
    - 项目二
      - 项目描述：xxx
      - 模块一：xxx
    """
    projects = []
    current_project = None
    current_subproject = None
    i = start_idx
    
    # 结束关键词
    end_keywords = ['开源经历', '开源贡献', '专业技能', '技能', '教育经历', '教育背景', '荣誉', '奖项']
    
    while i < len(lines):
        line = lines[i].strip()
        
        # 遇到其他部分时停止
        if any(kw in line for kw in end_keywords):
            break
        
        # 跳过空行
        if not line:
            i += 1
            continue
        
        # 检测项目标题（项目一、项目二等）
        if re.match(r'^项目[一二三四五六七八九十\d]+$', line):
            # 保存之前的项目
            if current_project:
                projects.append(current_project)
            
            current_project = {
                'title': line,
                'items': []
            }
            current_subproject = None
            i += 1
            continue
        
        # 检测子项目标题（子项目甲、子项目乙等）
        if re.match(r'^子项目[甲乙丙丁戊己庚辛壬癸一二三四五六七八九十\d]+', line):
            if current_project:
                current_subproject = {
                    'title': line,
                    'details': []
                }
                current_project['items'].append(current_subproject)
            i += 1
            continue
        
        # 检测模块描述（模块一：xxx）
        module_match = re.match(r'^(模块[一二三四五六七八九十\d]+)[：:]\s*(.+)$', line)
        if module_match:
            if current_project:
                current_subproject = {
                    'title': module_match.group(1),
                    'details': [module_match.group(2)]
                }
                current_project['items'].append(current_subproject)
            i += 1
            continue
        
        # 检测带冒号的描述（项目描述：xxx、核心职责：xxx）
        desc_match = re.match(r'^(项目描述|核心职责与产出|核心职责)[：:]\s*(.*)$', line)
        if desc_match:
            if current_project:
                current_subproject = {
                    'title': desc_match.group(1),
                    'details': [desc_match.group(2)] if desc_match.group(2) else []
                }
                current_project['items'].append(current_subproject)
            i += 1
            continue
        
        # 普通描述行
        if current_subproject:
            if line:
                current_subproject['details'].append(line)
        elif current_project:
            # 没有子项目时，作为项目的直接亮点
            if 'highlights' not in current_project:
                current_project['highlights'] = []
            current_project['highlights'].append(line)
        
        i += 1
    
    # 保存最后一个项目
    if current_project:
        projects.append(current_project)
    
    return projects, i

