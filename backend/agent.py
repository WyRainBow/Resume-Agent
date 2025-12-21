"""
Reflection Agent - 简历解析自我反思修正系统

工作流程：
1. 解析阶段：用户文本 → GLM-4.5V → JSON 数据
2. 渲染阶段：JSON 数据 → 前端渲染 → 预览页面  
3. 反思阶段：
   - 预览截图 → GLM-4.5V (视觉) → 图像分析
   - [原始文本 + 图像分析 + 当前JSON] → GLM-4.5V (推理) → 修正 JSON
   - 循环直到满意或达到最大迭代次数
"""

import json
import base64
import re
from typing import Dict, Any, Optional, Tuple
import simple


def call_vision_model(image_base64: str, prompt: str) -> str:
    """
    调用 GLM-4.5V 视觉模型分析图像
    
    Args:
        image_base64: Base64 编码的图像
        prompt: 分析提示词
    
    Returns:
        视觉分析结果
    """
    from zhipuai import ZhipuAI
    import os
    
    api_key = os.getenv("ZHIPU_API_KEY")
    if not api_key:
        return "视觉模型未配置"
    
    client = ZhipuAI(api_key=api_key)
    
    """
    构建视觉请求，使用 GLM 视觉模型
    智谱视觉模型调用 - 使用 glm-4.5v (用户可用模型)
    """
    response = client.chat.completions.create(
        model="glm-4.5v",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )
    
    return response.choices[0].message.content


def analyze_resume_screenshot(image_base64: str, original_text: str) -> str:
    """
    分析简历截图，找出渲染问题
    
    Args:
        image_base64: 简历预览截图的 Base64 编码
        original_text: 用户原始输入的文本
    
    Returns:
        视觉分析结果，描述发现的问题
    """
    prompt = f"""你是一个简历排版专家。请仔细分析这张简历预览截图，对比用户原始输入的内容，找出以下问题：

用户原始输入内容：
---
{original_text[:2000]}
---

请检查并列出问题：
1. **内容缺失**：哪些原始内容没有正确显示？（如显示"点击添加..."但原文有内容）
2. **标题错误**：标题是否正确？（如"实习经历"被错误显示为"工作经历"）
3. **层级问题**：标题层级是否清晰？是否有加粗？是否有正确的缩进？
4. **格式问题**：项目名和技术栈是否在同一行？应该分开吗？
5. **排版建议**：整体排版是否美观？有什么改进建议？

请用JSON格式返回分析结果：
{{"issues": ["问题1", "问题2"], "suggestions": ["建议1", "建议2"], "missing_content": ["缺失内容1"], "title_errors": ["标题错误"]}}
"""
    
    return call_vision_model(image_base64, prompt)


def reflect_and_fix(
    original_text: str,
    current_json: Dict[str, Any],
    vision_analysis: str
) -> Tuple[Dict[str, Any], str]:
    """
    基于视觉分析结果，推理并修正 JSON 数据
    
    Args:
        original_text: 用户原始输入文本
        current_json: 当前的简历 JSON 数据
        vision_analysis: 视觉模型的分析结果
    
    Returns:
        (修正后的 JSON, 修正说明)
    """
    prompt = f"""你是一个简历数据修正专家。基于以下信息，请修正简历 JSON 数据。

## 用户原始输入：
{original_text[:3000]}

## 当前 JSON 数据：
{json.dumps(current_json, ensure_ascii=False, indent=2)[:3000]}

## 视觉分析发现的问题：
{vision_analysis}

## 修正要求：
1. 如果原文是"实习经历"，sectionTitles.experience 必须是"实习经历"，不能是"工作经历"
2. 如果某个条目没有 highlights/details 内容，就不要包含空的占位符
3. 项目的技术栈应该放在 subtitle 或单独字段，不要和标题混在一起
4. 确保所有原始内容都被正确提取，不要遗漏
5. highlights 数组中的每一项应该是独立的要点，不要合并

请返回修正后的完整 JSON（只输出 JSON，不要其他内容）：
"""
    
    """
    调用智谱 AI 进行推理修正
    """
    result = simple.call_zhipu_api(prompt, model="glm-4.5v")
    
    """
    清理并解析 JSON
    """
    cleaned = re.sub(r'```json\s*', '', result)
    cleaned = re.sub(r'```\s*', '', cleaned)
    cleaned = cleaned.strip()
    
    try:
        """
        尝试提取 JSON
        """
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1:
            json_str = cleaned[start:end+1]
            fixed_json = json.loads(json_str)
            return fixed_json, "修正成功"
    except Exception as e:
        return current_json, f"修正失败: {e}"
    
    return current_json, "无法解析修正结果"


def run_reflection_agent(
    original_text: str,
    current_json: Dict[str, Any],
    screenshot_base64: Optional[str] = None,
    max_iterations: int = 2
) -> Dict[str, Any]:
    """
    运行 Reflection Agent 完整工作流
    
    Args:
        original_text: 用户原始输入文本
        current_json: 初始解析的 JSON 数据
        screenshot_base64: 预览截图（可选，如果没有则跳过视觉分析）
        max_iterations: 最大迭代次数
    
    Returns:
        {
            "final_json": 最终修正的 JSON,
            "iterations": 迭代次数,
            "changes": 修改历史,
            "vision_analysis": 视觉分析结果
        }
    """
    result = {
        "final_json": current_json,
        "iterations": 0,
        "changes": [],
        "vision_analysis": None
    }
    
    working_json = current_json.copy()
    
    for i in range(max_iterations):
        result["iterations"] = i + 1
        
        """
        如果有截图，进行视觉分析
        """
        if screenshot_base64:
            try:
                vision_analysis = analyze_resume_screenshot(screenshot_base64, original_text)
                result["vision_analysis"] = vision_analysis
                
                """
                检查是否有问题需要修正
                """
                if "没有发现问题" in vision_analysis or "looks good" in vision_analysis.lower():
                    result["changes"].append(f"第{i+1}轮：视觉分析未发现问题，停止迭代")
                    break
                
                """
                推理修正
                """
                fixed_json, fix_message = reflect_and_fix(original_text, working_json, vision_analysis)
                
                if fixed_json != working_json:
                    result["changes"].append(f"第{i+1}轮：{fix_message}")
                    working_json = fixed_json
                else:
                    result["changes"].append(f"第{i+1}轮：无需修改")
                    break
                    
            except Exception as e:
                result["changes"].append(f"第{i+1}轮错误：{str(e)}")
                break
        else:
            """
            没有截图，只做基础文本对比修正
            """
            basic_fix_prompt = f"""对比原始文本和当前JSON，修正明显错误：

原始文本（关键词）：
{original_text[:1500]}

当前JSON：
{json.dumps(working_json, ensure_ascii=False)[:1500]}

检查：
1. sectionTitles 是否正确（实习经历/工作经历）
2. 内容是否完整
3. 格式是否正确

返回修正后的JSON（只输出JSON）："""
            
            try:
                fix_result = simple.call_zhipu_api(basic_fix_prompt, model="glm-4.5v")
                cleaned = re.sub(r'```json\s*', '', fix_result)
                cleaned = re.sub(r'```\s*', '', cleaned).strip()
                start = cleaned.find('{')
                end = cleaned.rfind('}')
                if start != -1 and end != -1:
                    fixed_json = json.loads(cleaned[start:end+1])
                    if fixed_json != working_json:
                        working_json = fixed_json
                        result["changes"].append(f"第{i+1}轮：基础修正完成")
                    else:
                        result["changes"].append(f"第{i+1}轮：无需修改")
                        break
            except Exception as e:
                result["changes"].append(f"第{i+1}轮错误：{str(e)}")
                break
    
    result["final_json"] = working_json
    return result


def analyze_template(image_base64: str, current_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    使用 GLM-4.5V 分析简历模板预览截图
    
    返回：
    - 现有模板长什么样子
    - 存在什么问题
    - 模板修改建议
    
    Args:
        image_base64: 简历预览截图的 Base64 编码
        current_json: 当前简历 JSON 数据（可选，用于对比）
    
    Returns:
        {
            "appearance": "模板外观描述",
            "issues": ["问题1", "问题2"],
            "suggestions": ["建议1", "建议2"],
            "raw_analysis": "原始分析文本"
        }
    """
    
    json_context = ""
    if current_json:
        json_context = f"""

当前简历包含的内容（JSON 数据摘要）：
- 姓名: {current_json.get('name', '未设置')}
- 联系方式: {bool(current_json.get('contact'))}
- 教育经历: {len(current_json.get('education', [])) if current_json.get('education') else 0} 条
- 工作/实习经历: {len(current_json.get('experience', [])) if current_json.get('experience') else 0} 条
- 项目经历: {len(current_json.get('projects', [])) if current_json.get('projects') else 0} 条
- 技能: {len(current_json.get('skills', [])) if current_json.get('skills') else 0} 项
"""
    
    prompt = f"""你是一位专业的简历设计师和排版专家。请仔细分析这张简历预览截图，并提供详细的评估。
{json_context}
请从以下三个方面进行分析，使用 JSON 格式返回：

1. **现有模板长什么样子** (appearance)：
   - 整体布局风格（单栏/双栏/混合）
   - 配色方案和视觉风格
   - 字体使用情况
   - 各模块的排列方式
   - 信息密度和留白

2. **存在什么问题** (issues)：
   - 排版问题（对齐、间距、层次不清）
   - 内容展示问题（信息遗漏、顺序不当）
   - 视觉问题（配色不协调、字体不统一）
   - 可读性问题（字太小、太密集）
   - 专业性问题（是否符合行业标准）

3. **模板修改建议** (suggestions)：
   - 布局优化建议
   - 内容调整建议
   - 视觉改进建议
   - 突出重点的建议
   - 提升专业度的建议

请严格按以下 JSON 格式返回（确保是有效的 JSON）：
{{
    "appearance": "这是一份[描述整体风格]的简历模板，采用[布局方式]布局...",
    "issues": [
        "问题1：具体描述",
        "问题2：具体描述"
    ],
    "suggestions": [
        "建议1：具体建议",
        "建议2：具体建议"
    ]
}}
"""
    
    try:
        raw_result = call_vision_model(image_base64, prompt)
        
        """
        解析 JSON 结果
        """
        cleaned = re.sub(r'```json\s*', '', raw_result)
        cleaned = re.sub(r'```\s*', '', cleaned)
        cleaned = cleaned.strip()
        
        """
        尝试提取 JSON
        """
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        
        if start != -1 and end != -1:
            json_str = cleaned[start:end+1]
            try:
                parsed = json.loads(json_str)
                return {
                    "appearance": parsed.get("appearance", "无法解析外观描述"),
                    "issues": parsed.get("issues", []),
                    "suggestions": parsed.get("suggestions", []),
                    "raw_analysis": raw_result
                }
            except json.JSONDecodeError:
                pass
        
        """
        如果无法解析 JSON，返回原始文本
        """
        return {
            "appearance": raw_result[:500] if len(raw_result) > 500 else raw_result,
            "issues": ["无法解析结构化结果，请查看原始分析"],
            "suggestions": ["请查看原始分析内容"],
            "raw_analysis": raw_result
        }
        
    except Exception as e:
        return {
            "appearance": f"分析失败: {str(e)}",
            "issues": [f"错误: {str(e)}"],
            "suggestions": ["请检查 API Key 配置或重试"],
            "raw_analysis": str(e)
        }


"""
快速修正函数（不需要截图）
"""
def quick_fix_resume(original_text: str, current_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    快速修正简历 JSON（基于文本对比，不需要截图）
    """
    """
    检测原文中的关键词
    """
    has_internship = any(kw in original_text for kw in ['实习', '实习经历', '实习生'])
    has_opensource = any(kw in original_text for kw in ['开源', '开源经历', 'GitHub', 'github'])
    
    fixed = current_json.copy()
    
    """
    修正 sectionTitles
    """
    if 'sectionTitles' not in fixed:
        fixed['sectionTitles'] = {}
    
    if has_internship:
        fixed['sectionTitles']['experience'] = '实习经历'
    
    if has_opensource:
        fixed['sectionTitles']['openSource'] = '开源经历'
    
    """
    清理空的 highlights
    """
    for key in ['internships', 'projects', 'openSource']:
        if key in fixed and isinstance(fixed[key], list):
            for item in fixed[key]:
                if 'highlights' in item and (not item['highlights'] or item['highlights'] == []):
                    """
                    如果没有内容，移除这个字段
                    """
                    del item['highlights']
    
    return fixed
