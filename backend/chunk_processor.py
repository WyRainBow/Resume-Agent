"""
文本分块处理器
将长文本分块后分别调用 AI，最后合并结果
"""

from typing import List, Dict, Any
import re


def split_resume_text(text: str, max_chunk_size: int = 400) -> List[Dict[str, str]]:
    """
    简单分割简历文本
    按照段落关键词分割
    """
    chunks = []
    
    """移除示例 JSON"""
    if '正确的 JSON' in text:
        text = text.split('正确的 JSON')[0]
    if '```json' in text:
        text = text.split('```json')[0]
    text = text.strip()
    
    """段落关键词"""
    section_keywords = ['实习经历', '项目经验', '项目经历', '开源经历', '专业技能', '教育经历']
    
    lines = text.split('\n')
    current_section = '基本信息'
    current_content = []
    
    for line in lines:
        """检查是否是新段落"""
        is_new_section = False
        for keyword in section_keywords:
            if keyword in line and len(line.strip()) < 20:
                """找到新段落"""
                if current_content:
                    """保存上一段"""
                    content_text = '\n'.join(current_content).strip()
                    if content_text:
                        chunks.append({
                            'section': current_section,
                            'content': content_text
                        })
                
                current_section = keyword
                current_content = [line]
                is_new_section = True
                break
        
        if not is_new_section:
            current_content.append(line)
            
            """检查长度是否超过限制"""
            current_length = sum(len(l) + 1 for l in current_content) # +1 for newline
            if current_length >= max_chunk_size:
                """强制分块"""
                content_text = '\n'.join(current_content).strip()
                if content_text:
                    chunks.append({
                        'section': current_section,
                        'content': content_text
                    })
                current_content = []
    
    """保存最后一段"""
    if current_content:
        content_text = '\n'.join(current_content).strip()
        if content_text:
            chunks.append({
                'section': current_section,
                'content': content_text
            })
    
    return chunks


def merge_resume_chunks(chunks_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    合并多个分块的解析结果
    
    Args:
        chunks_results: 每个分块的解析结果列表
    
    Returns:
        合并后的完整简历数据
    """
    merged = {}
    
    for chunk_result in chunks_results:
        if not chunk_result:
            continue
        
        for key, value in chunk_result.items():
            if key not in merged:
                merged[key] = value
            else:
                """
                合并逻辑
                """
                if isinstance(value, list) and isinstance(merged[key], list):
                    """
                    列表类型：追加
                    """
                    merged[key].extend(value)
                elif isinstance(value, dict) and isinstance(merged[key], dict):
                    """
                    字典类型：更新
                    """
                    merged[key].update(value)
                elif isinstance(value, str) and isinstance(merged[key], str):
                    """
                    字符串类型：如果不同则合并
                    """
                    if value != merged[key]:
                        merged[key] = f"{merged[key]}\n{value}"
                else:
                    """
                    其他情况：保留第一个非空值
                    """
                    if not merged[key] and value:
                        merged[key] = value
    
    return merged
