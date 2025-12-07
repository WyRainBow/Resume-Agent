"""JSON 解析器：尝试解析和修复 JSON 格式"""

import json
from typing import Dict, Any, Optional, Tuple


def try_json_repair(text: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    尝试修复和解析 JSON
    
    Returns:
        (data, error): 成功返回 (dict, None)，失败返回 (None, error_msg)
    """
    try:
        from json_repair import repair_json
        cleaned = text.strip()
        
        # 直接解析
        try:
            return json.loads(cleaned), None
        except:
            pass
        
        # json-repair 修复
        try:
            repaired = repair_json(cleaned)
            return json.loads(repaired), None
        except Exception as e:
            return None, f"json-repair 失败: {str(e)}"
            
    except ImportError:
        return None, "json-repair 库未安装"
    except Exception as e:
        return None, f"json-repair 异常: {str(e)}"


def try_regex_extract(text: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    使用正则表达式提取 JSON
    """
    try:
        start = text.find('{')
        end = text.rfind('}')
        
        if start == -1 or end == -1 or end <= start:
            return None, "未找到 JSON 结构"
        
        return json.loads(text[start:end+1]), None
        
    except json.JSONDecodeError as e:
        return None, f"JSON 解析失败: {str(e)}"
    except Exception as e:
        return None, f"正则提取异常: {str(e)}"

