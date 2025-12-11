"""
JSON 路径工具：支持 a.b[0].c 形式的简单路径
"""


def parse_path(path: str):
    """
    将字符串路径解析为片段列表
    示例："experience[0].achievements[1]" → ["experience", 0, "achievements", 1]
    """
    parts = []
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
                raise ValueError("路径解析失败：缺少闭合 ]")
            idx_str = path[i+1:j].strip()
            if not idx_str.isdigit():
                raise ValueError("索引需为数字")
            parts.append(int(idx_str))
            i = j + 1
            continue
        buf += ch
        i += 1
    if buf:
        parts.append(buf)
    return parts


def get_by_path(obj, parts):
    """
    读取某个路径的值，并返回(父对象, 键/索引, 当前值)
    """
    cur = obj
    parent = None
    key = None
    for p in parts:
        parent = cur
        key = p
        if isinstance(p, int):
            if not isinstance(cur, list) or p < 0 or p >= len(cur):
                raise ValueError("列表索引越界")
            cur = cur[p]
        else:
            if not isinstance(cur, dict) or p not in cur:
                raise ValueError("字典键不存在")
            cur = cur[p]
    return parent, key, cur


def set_by_path(obj, parts, new_value):
    """
    将路径对应的值替换为 new_value
    """
    if not parts:
        raise ValueError("路径不能为空")
    parent, key, _ = get_by_path(obj, parts)
    if isinstance(key, int):
        parent[key] = new_value
    else:
        parent[key] = new_value
    return obj
