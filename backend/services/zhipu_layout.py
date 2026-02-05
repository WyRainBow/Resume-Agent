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


def _parse_json(text: str) -> Dict[str, Any]:
    cleaned = _strip_json_block(text)
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def _build_prompt() -> str:
    return """识别简历结构，按从上到下顺序，直接输出JSON（不要解释）：

type 可选值：
- basic: 基本信息（姓名、联系方式）
- experience: 实习经历/工作经历
- projects: 项目经验/项目经历（公司内的项目）
- education: 教育经历
- skills: 专业技能
- openSource: 开源经历/开源贡献/开源项目（包含GitHub链接的项目、社区贡献、个人开源项目）
- awards: 获奖/荣誉

重要区分规则：
1. 如果模块标题包含"开源"二字，type 必须是 openSource
2. 如果条目包含 GitHub 仓库链接或社区贡献描述，type 应该是 openSource
3. 个人项目（如 Resume-Agent）如果有 GitHub 链接，应该放在 openSource 类型

输出格式示例：
{"sections": [
  {"type": "experience", "title": "实习经历", "items": [{"company": "公司名", "position": "职位", "date": "时间"}]},
  {"type": "projects", "title": "项目经验", "items": [{"name": "项目名", "role": "角色", "date": "时间"}]},
  {"type": "openSource", "title": "开源经历", "items": [{"name": "项目名", "role": "贡献者", "repo": "仓库链接"}]}
]}"""


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
