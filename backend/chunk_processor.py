"""
文本分块处理器
将长文本分块后分别调用 AI，最后合并结果
"""

from typing import List, Dict, Any
import re
import sys


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
                """智能分块：尽量在段落边界或句子边界切分，避免损失信息"""
                # 策略1: 尝试在最近的段落边界（空行）切分
                split_index = len(current_content)
                for i in range(len(current_content) - 1, max(0, len(current_content) - 20), -1):
                    if not current_content[i].strip():  # 找到空行
                        split_index = i + 1
                        break
                
                # 策略2: 如果没有空行，尝试在句子边界切分（句号、问号、感叹号）
                if split_index == len(current_content):
                    for i in range(len(current_content) - 1, max(0, len(current_content) - 15), -1):
                        line_text = current_content[i].strip()
                        if line_text and line_text[-1] in ['。', '！', '？', '.', '!', '?']:
                            split_index = i + 1
                            break
                
                # 策略3: 如果还是没找到合适位置，尝试在列表项边界切分（-、*、•）
                if split_index == len(current_content):
                    for i in range(len(current_content) - 1, max(0, len(current_content) - 10), -1):
                        line_text = current_content[i].strip()
                        if line_text and line_text.startswith(('-', '*', '•', '·')):
                            split_index = i  # 保留列表项标记
                            break
                
                # 策略4: 如果还是没找到合适位置，至少保留最后一行（避免切掉关键信息）
                if split_index == len(current_content) and len(current_content) > 1:
                    split_index = len(current_content) - 1
                
                # 分块：保存前面的内容
                if split_index > 0:
                    content_text = '\n'.join(current_content[:split_index]).strip()
                    if content_text:
                        chunks.append({
                            'section': current_section,
                            'content': content_text
                        })
                    # 保留剩余内容
                    current_content = current_content[split_index:]
                else:
                    # 如果无法分块，强制保存（避免无限循环）
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
    
    # 优化：合并小块，减少分块数量
    # 如果小块（<50字符）和前一块是同一段落，合并它们
    optimized_chunks = []
    min_chunk_size = 50  # 最小块大小阈值
    
    for i, chunk in enumerate(chunks):
        if len(chunk['content']) < min_chunk_size and optimized_chunks:
            # 小块，尝试合并到前一块
            last_chunk = optimized_chunks[-1]
            # 如果前一块也是同一段落，或者前一块不够大，合并
            if (last_chunk['section'] == chunk['section'] or 
                len(last_chunk['content']) < max_chunk_size * 0.8):
                # 合并到前一块
                last_chunk['content'] = last_chunk['content'] + '\n' + chunk['content']
            else:
                # 不能合并，保留
                optimized_chunks.append(chunk)
        else:
            # 正常大小的块，直接添加
            optimized_chunks.append(chunk)
    
    # 使用 print 和 logger 双重记录
    print(f"[分块优化] 原始分块数: {len(chunks)}, 优化后: {len(optimized_chunks)}", file=sys.stderr, flush=True)
    for i, chunk in enumerate(optimized_chunks, 1):
        print(f"[分块优化] 块 {i}: {len(chunk['content'])} 字符, 段落: {chunk['section']}", file=sys.stderr, flush=True)
    try:
        from .logger import backend_logger
        backend_logger.info(f"[分块优化] 原始分块数: {len(chunks)}, 优化后: {len(optimized_chunks)}")
        for i, chunk in enumerate(optimized_chunks, 1):
            backend_logger.info(f"[分块优化] 块 {i}: {len(chunk['content'])} 字符, 段落: {chunk['section']}")
    except ImportError:
        pass
    
    return optimized_chunks


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
