"""
智谱 GLM-4.6V 布局识别服务
用于从简历截图中识别结构骨架
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, Iterable

try:
    from zhipuai import ZhipuAI
except ImportError as exc:
    raise ImportError("zhipuai 未安装，请运行: uv pip install zhipuai") from exc

try:
    import tomllib  # Python 3.11+
except ImportError:
    import tomli as tomllib  # Python < 3.11


def _load_zhipu_config() -> Dict[str, str]:
    """从 config.toml 加载智谱配置"""
    config_path = Path(__file__).resolve().parent.parent.parent / "config.toml"
    if config_path.exists():
        with open(config_path, "rb") as f:
            config = tomllib.load(f)
            zhipu_config = config.get("zhipu", {})
            return {
                "api_key": zhipu_config.get("api_key", ""),
                "vision_model": zhipu_config.get("vision_model", "glm-4.6v"),
            }
    return {"api_key": "", "vision_model": "glm-4.6v"}


_config = _load_zhipu_config()
ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY", "") or _config["api_key"]
ZHIPU_VISION_MODEL = os.getenv("ZHIPU_VISION_MODEL", "") or _config["vision_model"]

_zhipu_client: Optional[ZhipuAI] = None
_last_key: Optional[str] = None


def _get_client(api_key: Optional[str] = None) -> ZhipuAI:
    global _zhipu_client, _last_key
    key = api_key or ZHIPU_API_KEY
    if not key:
        raise ValueError("ZHIPU_API_KEY 未配置")
    if _zhipu_client is None or _last_key != key:
        _zhipu_client = ZhipuAI(api_key=key)
        _last_key = key
    return _zhipu_client


def _strip_json_block(text: str) -> str:
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
    return cleaned.strip()


def _fix_json_string(text: str) -> str:
    """修复常见的 JSON 格式问题"""
    import re
    # 移除可能的 BOM 和不可见字符
    text = text.strip().lstrip('\ufeff')
    # 修复尾部多余逗号: ,] -> ] 和 ,} -> }
    text = re.sub(r',\s*]', ']', text)
    text = re.sub(r',\s*}', '}', text)
    # 修复中文冒号
    text = text.replace('：', ':')
    # 修复中文引号
    text = text.replace('"', '"').replace('"', '"')
    text = text.replace(''', "'").replace(''', "'")
    return text


def _balance_json_braces(text: str) -> str:
    """
    平衡 JSON 的括号，修复多余或缺失的闭合括号
    """
    # 统计括号
    brace_count = 0  # {}
    bracket_count = 0  # []
    in_string = False
    escape = False
    last_valid_pos = 0
    
    for i, char in enumerate(text):
        if escape:
            escape = False
            continue
        if char == '\\':
            escape = True
            continue
        if char == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
            
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and bracket_count == 0:
                # 找到完整的 JSON 对象
                last_valid_pos = i + 1
                break
            elif brace_count < 0:
                # 多余的 }，截断
                return text[:i]
        elif char == '[':
            bracket_count += 1
        elif char == ']':
            bracket_count -= 1
            if bracket_count < 0:
                # 多余的 ]，截断
                return text[:i]
    
    if last_valid_pos > 0:
        return text[:last_valid_pos]
    return text


def _parse_json(text: str) -> Dict[str, Any]:
    cleaned = _strip_json_block(text)
    cleaned = _fix_json_string(cleaned)
    
    # 尝试直接解析
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    
    # 尝试提取 JSON 对象
    start = cleaned.find("{")
    if start != -1:
        json_str = cleaned[start:]
        json_str = _fix_json_string(json_str)
        # 使用括号平衡来截取正确的 JSON
        json_str = _balance_json_braces(json_str)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            # 打印调试信息
            print(f"[智谱JSON解析] 原始内容前100字符: {json_str[:100]}", flush=True)
            print(f"[智谱JSON解析] 错误位置附近: {json_str[max(0, e.pos-50):e.pos+50]}", flush=True)
            raise ValueError(f"JSON 解析失败: {e}")
    
    raise ValueError("未找到有效的 JSON 对象")


def _build_prompt() -> str:
    return """识别简历结构骨架，按从上到下顺序输出JSON。

type值: basic/experience/projects/education/skills/openSource/awards

规则:
- 标题含"开源"→openSource
- 含GitHub链接→openSource
- 只输出JSON,不要解释

格式:{"sections":[{"type":"xxx","title":"标题","items":[{"name":"名称","date":"时间"}]}]}"""


def recognize_layout_from_images(
    image_bytes_list: Iterable[bytes],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    使用智谱 GLM-4.6V 识别简历布局骨架（支持多页图片）
    """
    images = [img for img in image_bytes_list if img]
    if not images:
        raise ValueError("图片内容为空")

    content = []
    for image_bytes in images:
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{image_base64}"
                },
            }
        )
    content.append({"type": "text", "text": _build_prompt()})

    client = _get_client(api_key)
    response = client.chat.completions.create(
        model=model or ZHIPU_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": content
            }
        ],
        temperature=0.1,
        max_tokens=10000
    )

    msg = response.choices[0].message
    content = msg.content or ""
    # GLM-4.6V 可能将内容放在 reasoning_content 中
    if not content and hasattr(msg, "reasoning_content") and msg.reasoning_content:
        content = msg.reasoning_content
    if not content:
        raise ValueError("智谱未返回布局内容")
    
    # 调试日志
    print(f"[智谱布局] 返回内容长度: {len(content)} 字符", flush=True)
    if len(content) < 500:
        print(f"[智谱布局] 完整内容: {content}", flush=True)
    else:
        print(f"[智谱布局] 前200字符: {content[:200]}...", flush=True)
    
    return _parse_json(content)


def recognize_layout_from_image_bytes(
    image_bytes: bytes,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    使用智谱 GLM-4.6V 识别简历布局骨架（单张图片）
    """
    return recognize_layout_from_images([image_bytes], api_key=api_key, model=model)
