"""
文本分块处理器
将长文本分块后分别调用 AI，最后合并结果
"""

from typing import List, Dict, Any
import re
import sys


def split_resume_text(text: str, max_chunk_size: int = 400) -> List[Dict[str, str]]:
    """
    简单分割简历文本，按照段落关键词分割。
    注意：调用方不要去掉换行或用单行字符串拼接（否则会退化成 1 块，无法分段）。

    核心策略：
    1. 先识别所有项目边界（### 开头的项目标题）
    2. 确保每个项目的完整内容（标题+描述+亮点）在同一个块中
    3. 只在项目边界处切分，避免把项目内容拆散
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

    # 辅助函数：查找从 start_index 开始的下一个项目标题位置
    def find_next_project_title(content_lines, start_index=0):
        """查找下一个项目标题（### 开头）的位置"""
        for i in range(start_index, len(content_lines)):
            if content_lines[i].strip().startswith('###'):
                return i
        return -1

    # 辅助函数：检查是否在某个项目的描述/亮点内容中
    def is_inside_project(content_lines, check_index):
        """检查 check_index 是否在某个项目的内容中（而非标题行）"""
        # 找到 check_index 之前最近的项目标题
        last_title_idx = -1
        for i in range(check_index - 1, -1, -1):
            if content_lines[i].strip().startswith('###'):
                last_title_idx = i
                break
        return last_title_idx >= 0

    # 辅助函数：找到一个项目的结束位置（下一个项目标题或空行后接其他内容）
    def find_current_project_end(content_lines, title_index):
        """找到从 title_index 开始的项目的结束位置"""
        # 跳过标题行
        i = title_index + 1
        n = len(content_lines)

        # 跳过空行
        while i < n and not content_lines[i].strip():
            i += 1

        # 检查接下来的内容：
        # - 项目描述段落（非空行，不以 ###、-、*、• 开头）
        # - 技术栈行
        # - 亮点列表（以 -、*、• 开头）
        # 遇到下一个 ### 项目标题时结束
        while i < n:
            line = content_lines[i].strip()
            if line.startswith('###'):
                # 下一个项目标题，当前项目结束
                return i
            i += 1

        return n  # 到了末尾

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
            current_length = sum(len(l) + 1 for l in current_content)  # +1 for newline
            if current_length >= max_chunk_size:
                """智能分块：优先在项目边界切分，确保项目完整性"""

                # 策略1：查找第一个项目标题，检查是否可以在这里切分
                # 我们希望在完整项目之后切分，而不是在项目中间

                # 首先查找当前 content 中的所有项目标题
                project_title_indices = []
                for i, cl in enumerate(current_content):
                    if cl.strip().startswith('###'):
                        project_title_indices.append(i)

                if len(project_title_indices) >= 2:
                    # 有至少2个项目，可以切分
                    # 找到最合适的切分点：确保切分点之前的块包含至少1个完整项目
                    # 且切分点之后的块也有完整项目

                    # 尝试在第二个项目标题处切分（保留第一个项目在前一个块）
                    split_index = project_title_indices[1]

                    # 检查切分后第一个块是否太小
                    first_block_size = sum(len(current_content[i]) + 1 for i in range(split_index))
                    if first_block_size < max_chunk_size * 0.3:
                        # 第一个块太小，尝试在第三个项目处切分
                        if len(project_title_indices) >= 3:
                            split_index = project_title_indices[2]

                    content_text = '\n'.join(current_content[:split_index]).strip()
                    if content_text:
                        chunks.append({
                            'section': current_section,
                            'content': content_text
                        })
                    current_content = current_content[split_index:]

                elif len(project_title_indices) == 1:
                    # 只有1个项目，检查是否在项目标题后
                    title_idx = project_title_indices[0]
                    if title_idx > 0:
                        # 项目标题不在开头，说明前面有其他内容（可能是上个项目的亮点等）
                        # 尝试在项目标题前切分
                        split_index = title_idx
                        content_text = '\n'.join(current_content[:split_index]).strip()
                        if content_text:
                            chunks.append({
                                'section': current_section,
                                'content': content_text
                            })
                        current_content = current_content[split_index:]
                    else:
                        # 项目标题在开头，需要检查是否有完整项目
                        # 计算这个项目的完整内容
                        project_end = find_current_project_end(current_content, title_idx)

                        # 如果项目结束位置在合理范围内，可以切分
                        if project_end < len(current_content):
                            # 检查项目内容大小
                            project_size = sum(len(current_content[i]) + 1 for i in range(project_end))
                            if project_size < max_chunk_size * 1.5:
                                # 项目大小合理，在项目结束后切分
                                split_index = project_end
                                content_text = '\n'.join(current_content[:split_index]).strip()
                                if content_text:
                                    chunks.append({
                                        'section': current_section,
                                        'content': content_text
                                    })
                                current_content = current_content[split_index:]
                            else:
                                # 项目太大，需要在项目内部切分
                                # 使用空行或列表边界作为切分点
                                split_index = len(current_content) // 2
                                # 向前查找空行
                                for i in range(split_index, max(0, split_index - 20), -1):
                                    if not current_content[i].strip():
                                        split_index = i + 1
                                        break
                                content_text = '\n'.join(current_content[:split_index]).strip()
                                if content_text:
                                    chunks.append({
                                        'section': current_section,
                                        'content': content_text
                                    })
                                current_content = current_content[split_index:]
                        else:
                            # 项目到末尾还没结束，使用空行切分
                            # 策略2: 在空行处切分
                            split_index = len(current_content)
                            for i in range(len(current_content) - 1, max(0, len(current_content) - 30), -1):
                                if not current_content[i].strip():
                                    split_index = i + 1
                                    break

                            if split_index < len(current_content):
                                content_text = '\n'.join(current_content[:split_index]).strip()
                                if content_text:
                                    chunks.append({
                                        'section': current_section,
                                        'content': content_text
                                    })
                                current_content = current_content[split_index:]

                else:
                    # 没有项目标题，使用原有策略
                    # 策略: 在空行处切分
                    split_index = len(current_content)
                    for i in range(len(current_content) - 1, max(0, len(current_content) - 30), -1):
                        if not current_content[i].strip():
                            split_index = i + 1
                            break

                    # 如果没有空行，尝试在句子边界切分
                    if split_index == len(current_content):
                        for i in range(len(current_content) - 1, max(0, len(current_content) - 20), -1):
                            line_text = current_content[i].strip()
                            if line_text and line_text[-1] in ['。', '！', '？', '.', '!', '?']:
                                split_index = i + 1
                                break

                    if split_index < len(current_content):
                        content_text = '\n'.join(current_content[:split_index]).strip()
                        if content_text:
                            chunks.append({
                                'section': current_section,
                                'content': content_text
                            })
                        current_content = current_content[split_index:]
                    else:
                        # 强制切分
                        split_index = len(current_content) // 2
                        if split_index > 0:
                            content_text = '\n'.join(current_content[:split_index]).strip()
                            if content_text:
                                chunks.append({
                                    'section': current_section,
                                    'content': content_text
                                })
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

    # 智能修复：将被误识别为项目的功能点合并到正确的项目中
    if "projects" in merged and isinstance(merged["projects"], list):
        merged["projects"] = _fix_project_highlights(merged["projects"])

    return merged


def _is_likely_highlight_project(project: Dict[str, Any]) -> bool:
    """
    判断一个项目是否可能是被误识别的功能亮点

    规则：
    1. 标题必须非空且像真正的项目名（不太长，看起来像项目名）
    2. 如果有 description，说明这是一个完整的项目（不是误识别的功能亮点）
    3. 只有标题为空，或标题以 ** 开头，或 title 看起来像描述时才可能是误识别
    """
    # 检查标题
    title = project.get("title", "") or project.get("name", "")

    # 如果标题为空，可能是误识别的功能亮点集合
    if not title:
        return True

    # 如果标题以 ** 开头，很可能是功能亮点
    if title.startswith("**"):
        return True

    # 检查 description
    description = project.get("description", "")

    # 如果有非空的 description，说明这是一个完整的项目，不是误识别的功能亮点
    # 这是最重要的判断：AI 解析时，真正的项目会有 description，被误识别的亮点没有
    if description and len(description) > 10:
        return False  # 有完整描述，是真实项目

    # 检查 highlights
    highlights = project.get("highlights", [])
    has_highlights = bool(highlights)

    # 如果标题不为空但没有 description，需要进一步判断
    # 检查标题长度：真正的项目名通常不会太长（一般不超过 30 个字符）
    if len(title) > 30 and '###' not in title and '##' not in title:
        # 标题太长，看起来像描述
        return True

    # 如果标题看起来像描述句（包含句号、逗号等标点，且较长）
    if len(title) > 15 and any(c in title for c in ['。', '，', '：', '的', '是']):
        # 看起来像描述句子
        return True

    # 默认情况下，如果有 title 和 description，认为是真实项目
    return False


def _fix_project_highlights(projects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    修复项目列表，将被误识别为项目的功能亮点合并到正确的项目中

    策略：
    1. 从前往后遍历，将疑似功能亮点的项目合并到下一个真实项目中
    2. 或者将疑似功能亮点的项目合并到上一个真实项目中
    3. 将功能亮点的 title 和 description 合并到项目的 highlights 数组中
    """
    if not projects:
        return projects

    fixed_projects = []
    i = 0
    n = len(projects)

    while i < n:
        current = projects[i]

        # 检查当前项是否可能是功能亮点
        if _is_likely_highlight_project(current):
            # 尝试找到最近的真实项目来合并
            # 优先合并到上一个项目（如果有），否则合并到下一个项目
            if fixed_projects:
                # 合并到上一个项目
                prev_project = fixed_projects[-1]

                # 获取当前"功能亮点项目"的信息
                title = current.get("title", "") or current.get("name", "")
                description = current.get("description", "")
                current_highlights = current.get("highlights", [])

                # 如果当前项目有 highlights，直接合并过去
                if current_highlights:
                    if "highlights" not in prev_project:
                        prev_project["highlights"] = []
                    elif prev_project["highlights"] is None:
                        prev_project["highlights"] = []
                    prev_project["highlights"].extend(current_highlights)

                # 如果有 title 和 description，构建 highlight 条目
                elif title and description:
                    # 如果标题看起来像描述（不是项目名），直接作为 highlight
                    if not title.startswith("**") and len(title) > 10:
                        # 将 title + description 合并为一个 highlight
                        if not description.startswith(title):
                            highlight_entry = f"- **{title}**：{description}"
                        else:
                            highlight_entry = f"- {description}"
                    else:
                        if not title.startswith("**"):
                            highlight_entry = f"- **{title}**：{description}"
                        else:
                            highlight_entry = f"- {title}：{description}"

                    if "highlights" not in prev_project:
                        prev_project["highlights"] = []
                    elif prev_project["highlights"] is None:
                        prev_project["highlights"] = []
                    prev_project["highlights"].append(highlight_entry)

                # 如果只有 description
                elif description:
                    if "highlights" not in prev_project:
                        prev_project["highlights"] = []
                    elif prev_project["highlights"] is None:
                        prev_project["highlights"] = []
                    prev_project["highlights"].append(f"- {description}")

                # 跳过当前项目（已被合并）
                i += 1
                continue
            else:
                # 没有上一个项目，检查是否有下一个项目可以合并
                if i + 1 < n and not _is_likely_highlight_project(projects[i + 1]):
                    # 合并到下一个项目
                    next_project = projects[i + 1]

                    # 获取当前"功能亮点项目"的信息
                    title = current.get("title", "") or current.get("name", "")
                    description = current.get("description", "")
                    current_highlights = current.get("highlights", [])

                    # 将当前内容插入到下一个项目的 highlights 开头
                    if current_highlights:
                        if "highlights" not in next_project:
                            next_project["highlights"] = []
                        elif next_project["highlights"] is None:
                            next_project["highlights"] = []
                        next_project["highlights"] = current_highlights + next_project["highlights"]
                    elif title and description:
                        highlight_entry = f"- **{title}**：{description}" if not title.startswith("**") else f"- {title}：{description}"
                        if "highlights" not in next_project:
                            next_project["highlights"] = []
                        elif next_project["highlights"] is None:
                            next_project["highlights"] = []
                        next_project["highlights"].insert(0, highlight_entry)
                    elif description:
                        if "highlights" not in next_project:
                            next_project["highlights"] = []
                        elif next_project["highlights"] is None:
                            next_project["highlights"] = []
                        next_project["highlights"].insert(0, f"- {description}")

                    # 跳过当前项目（已被合并）
                    i += 1
                    continue

        # 是真实项目，直接添加
        fixed_projects.append(current)
        i += 1

    return fixed_projects
