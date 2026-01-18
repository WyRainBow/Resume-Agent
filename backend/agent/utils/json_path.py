"""
JSON Path 工具

支持 a.b[0].c 形式的 JSON 路径操作。
提供解析、读取、设置、删除等功能。
"""
from typing import Any, Dict, List, Tuple, Union


def parse_path(path: str) -> List[Union[str, int]]:
    """
    将字符串路径解析为片段列表

    Args:
        path: JSON 路径字符串

    Returns:
        解析后的路径片段列表

    Examples:
        >>> parse_path("basic.name")
        ['basic', 'name']
        >>> parse_path("education[0].school")
        ['education', 0, 'school']
        >>> parse_path("experience[0].achievements[1]")
        ['experience', 0, 'achievements', 1]
    """
    if not path or not path.strip():
        return []

    parts: List[Union[str, int]] = []
    buf = ""
    i = 0

    while i < len(path):
        ch = path[i]

        if ch == '.':
            if buf:
                parts.append(buf)
                buf = ""
            i += 1
            continue

        if ch == '[':
            if buf:
                parts.append(buf)
                buf = ""
            j = path.find(']', i)
            if j == -1:
                raise ValueError(f"路径解析失败：缺少闭合 ']'，路径: {path}")
            idx_str = path[i + 1:j].strip()
            if not idx_str.lstrip('-').isdigit():
                raise ValueError(f"索引需为整数，但收到: {idx_str}")
            parts.append(int(idx_str))
            i = j + 1
            continue

        buf += ch
        i += 1

    if buf:
        parts.append(buf)

    return parts


def get_by_path(
    obj: Union[Dict, List],
    path: Union[str, List[Union[str, int]]]
) -> Tuple[Any, Union[str, int], Any]:
    """
    读取指定路径的值

    Args:
        obj: 数据对象
        path: JSON 路径（字符串或已解析的列表）

    Returns:
        (父对象, 键/索引, 当前值)

    Raises:
        ValueError: 路径不存在或索引越界
    """
    if isinstance(path, str):
        parts = parse_path(path)
    else:
        parts = path

    if not parts:
        return None, None, obj

    cur = obj
    parent = None
    key = None

    for p in parts:
        parent = cur
        key = p

        if isinstance(p, int):
            if not isinstance(cur, list):
                raise ValueError(f"期望列表类型，但实际是 {type(cur).__name__}")
            if p < 0:
                p = len(cur) + p  # 支持负索引
            if p < 0 or p >= len(cur):
                raise ValueError(f"列表索引越界: {p}，列表长度: {len(cur)}")
            cur = cur[p]
        else:
            if not isinstance(cur, dict):
                raise ValueError(f"期望字典类型，但实际是 {type(cur).__name__}")
            if p not in cur:
                raise ValueError(f"字典键不存在: '{p}'")
            cur = cur[p]

    return parent, key, cur


def set_by_path(
    obj: Union[Dict, List],
    path: Union[str, List[Union[str, int]]],
    value: Any
) -> Union[Dict, List]:
    """
    设置指定路径的值

    Args:
        obj: 数据对象
        path: JSON 路径
        value: 新值

    Returns:
        修改后的对象

    Raises:
        ValueError: 路径无效
    """
    if isinstance(path, str):
        parts = parse_path(path)
    else:
        parts = path

    if not parts:
        raise ValueError("路径不能为空")

    # 遍历到倒数第二层，自动创建中间节点
    cur = obj
    for i, p in enumerate(parts[:-1]):
        next_part = parts[i + 1]

        if isinstance(p, int):
            if not isinstance(cur, list):
                raise ValueError(f"期望列表，但实际是 {type(cur).__name__}")
            # 确保索引有效
            while len(cur) <= p:
                cur.append({} if isinstance(next_part, str) else [])
            cur = cur[p]
        else:
            if not isinstance(cur, dict):
                raise ValueError(f"期望字典，但实际是 {type(cur).__name__}")
            # 自动创建中间节点
            if p not in cur:
                cur[p] = {} if isinstance(next_part, str) else []
            cur = cur[p]

    # 设置最终值
    final_key = parts[-1]
    if isinstance(final_key, int):
        if not isinstance(cur, list):
            raise ValueError(f"期望列表，但实际是 {type(cur).__name__}")
        while len(cur) <= final_key:
            cur.append(None)
        cur[final_key] = value
    else:
        if not isinstance(cur, dict):
            raise ValueError(f"期望字典，但实际是 {type(cur).__name__}")
        cur[final_key] = value

    return obj


def delete_by_path(
    obj: Union[Dict, List],
    path: Union[str, List[Union[str, int]]]
) -> Any:
    """
    删除指定路径的值

    Args:
        obj: 数据对象
        path: JSON 路径

    Returns:
        被删除的值

    Raises:
        ValueError: 路径不存在
    """
    if isinstance(path, str):
        parts = parse_path(path)
    else:
        parts = path

    if not parts:
        raise ValueError("路径不能为空")

    parent, key, old_value = get_by_path(obj, parts)

    if isinstance(parent, list):
        del parent[int(key)]
    elif isinstance(parent, dict):
        del parent[key]
    else:
        raise ValueError(f"无法从 {type(parent).__name__} 类型删除")

    return old_value


def exists_path(
    obj: Union[Dict, List],
    path: Union[str, List[Union[str, int]]]
) -> bool:
    """
    检查路径是否存在

    Args:
        obj: 数据对象
        path: JSON 路径

    Returns:
        路径是否存在
    """
    try:
        get_by_path(obj, path)
        return True
    except ValueError:
        return False


def get_or_default(
    obj: Union[Dict, List],
    path: Union[str, List[Union[str, int]]],
    default: Any = None
) -> Any:
    """
    获取路径的值，不存在时返回默认值

    Args:
        obj: 数据对象
        path: JSON 路径
        default: 默认值

    Returns:
        路径对应的值或默认值
    """
    try:
        _, _, value = get_by_path(obj, path)
        return value
    except ValueError:
        return default
