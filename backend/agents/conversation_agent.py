"""
对话式简历生成 Agent

通过多轮对话收集信息，逐步构建简历数据
"""
import json
from typing import Dict, Any, Optional
from datetime import datetime


# 对话步骤定义
CONVERSATION_STEPS = [
    'greeting',      # 欢迎
    'identity',      # 身份确认（学生/职场）
    'education',     # 教育背景
    'experience',    # 实习经历
    'projects',      # 项目经历
    'activities',    # 社团活动
    'skills',        # 技能证书
    'confirm'        # 确认完成
]

# 步骤顺序映射
STEP_ORDER = {
    'greeting': 'identity',
    'identity': 'education',
    'education': 'experience',
    'experience': 'projects',
    'projects': 'activities',
    'activities': 'skills',
    'skills': 'confirm',
    'confirm': 'confirm'
}


def build_conversation_prompt(
    step: str,
    user_input: str,
    collected_info: Dict[str, Any]
) -> str:
    """
    构建对话 Prompt

    根据当前对话步骤和已收集信息，构建发送给 LLM 的 Prompt
    """
    # 基础系统提示
    system_prompt = """你是一个专业的简历助手，负责通过对话收集用户的简历信息。

你的任务：
1. 理解用户的输入
2. 提取相关的简历信息
3. 以友好的语气回复用户
4. 引导用户进入下一步

请以 JSON 格式回复，包含以下字段：
{
    "reply": "给用户的回复消息",
    "extracted_info": {提取的信息},
    "next_step": "下一步骤",
    "is_complete": false
}"""

    # 根据步骤构建特定 prompt
    if step == 'identity':
        prompt = f"""用户说："{user_input}"

请提取用户的名字。

{system_prompt}

JSON 响应示例：
{{
    "reply": "你好，{{name}}！现在让我们开始构建你的简历。\\n\\n请分享你的教育背景：学校名称、专业、学历，以及就读时间。",
    "extracted_info": {{"name": "{{提取的名字}}"}},
    "next_step": "education",
    "is_complete": false
}}"""

    elif step == 'education':
        info_summary = _format_collected_info(collected_info)
        prompt = f"""用户信息：{info_summary}

用户输入的教育背景："{user_input}"

请提取教育信息，包括学校、专业、学历、时间等。
如果有多个教育经历，请返回数组。

{system_prompt}

JSON 响应示例：
{{
    "reply": "收到！教育背景已记录。\\n\\n接下来，请分享你的实习/工作经历（公司、职位、时间），如果没有可以跳过。",
    "extracted_info": {{
        "education": [
            {{
                "school": "学校名称",
                "major": "专业",
                "degree": "学历",
                "startDate": "开始时间",
                "endDate": "结束时间",
                "description": "描述"
            }}
        ]
    }},
    "next_step": "experience",
    "is_complete": false
}}"""

    elif step == 'experience':
        info_summary = _format_collected_info(collected_info)
        prompt = f"""用户信息：{info_summary}

用户输入的实习/工作经历："{user_input}"

请提取工作经历信息，包括公司、职位、时间、详情等。
如果有多个经历，请返回数组。
如果用户说"跳过"或"没有"，返回空数组。

{system_prompt}

JSON 响应示例：
{{
    "reply": "工作经历已记录。\\n\\n接下来，请分享你的项目经历，如果没有可以跳过。",
    "extracted_info": {{
        "experience": [
            {{
                "company": "公司名称",
                "position": "职位",
                "date": "时间",
                "details": "工作详情"
            }}
        ]
    }},
    "next_step": "projects",
    "is_complete": false
}}"""

    elif step == 'projects':
        info_summary = _format_collected_info(collected_info)
        prompt = f"""用户信息：{info_summary}

用户输入的项目经历："{user_input}"

请提取项目信息，包括项目名称、角色、时间、描述等。
如果有多个项目，请返回数组。
如果用户说"跳过"或"没有"，返回空数组。

项目描述应该使用 HTML 无序列表格式，例如：
<ul class="custom-list">
  <li><p><strong>要点1</strong>: 描述</p></li>
  <li><p><strong>要点2</strong>: 描述</p></li>
</ul>

{system_prompt}

JSON 响应示例：
{{
    "reply": "项目经历已记录。\\n\\n接下来，请分享你的社团/活动经历，如果没有可以跳过。",
    "extracted_info": {{
        "projects": [
            {{
                "name": "项目名称",
                "role": "角色",
                "date": "时间",
                "description": "<ul class=\\"custom-list\\">...</ul>"
            }}
        ]
    }},
    "next_step": "activities",
    "is_complete": false
}}"""

    elif step == 'activities':
        info_summary = _format_collected_info(collected_info)
        prompt = f"""用户信息：{info_summary}

用户输入的社团/活动经历："{user_input}"

请提取活动/荣誉信息，包括奖项名称、颁发机构、时间、描述等。
如果有多个，请返回数组。
如果用户说"跳过"或"没有"，返回空数组。

{system_prompt}

JSON 响应示例：
{{
    "reply": "社团经历已记录。\\n\\n最后，请告诉我你的专业技能和证书（如编程语言、工具、证书等）。",
    "extracted_info": {{
        "awards": [
            {{
                "title": "奖项名称",
                "issuer": "颁发机构",
                "date": "时间",
                "description": "描述"
            }}
        ]
    }},
    "next_step": "skills",
    "is_complete": false
}}"""

    elif step == 'skills':
        info_summary = _format_collected_info(collected_info)
        prompt = f"""用户信息：{info_summary}

用户输入的技能："{user_input}"

请提取技能信息，格式化为 HTML 无序列表：
<ul class="custom-list">
  <li><p><strong>分类</strong>: 技能描述</p></li>
  <li><p><strong>分类</strong>: 技能描述</p></li>
</ul>

{system_prompt}

JSON 响应示例：
{{
    "reply": "太棒了！我已经帮你生成了一份简历，请查看右侧预览。如果需要修改，可以切换到编辑模式手动调整。",
    "extracted_info": {{
        "skills": "<ul class=\\"custom-list\\">...</ul>"
    }},
    "next_step": "confirm",
    "is_complete": true
}}"""

    else:
        # 默认 prompt
        prompt = f"""用户说："{user_input}"

请以友好的方式回复，并引导用户继续。"""

    return prompt


def _format_collected_info(collected_info: Dict[str, Any]) -> str:
    """格式化已收集的信息用于 prompt"""
    parts = []

    if collected_info.get('name'):
        parts.append(f"姓名：{collected_info['name']}")
    if collected_info.get('identity'):
        identity_text = '学生' if collected_info['identity'] == 'student' else '职场人士'
        parts.append(f"身份：{identity_text}")
    if collected_info.get('education'):
        parts.append(f"教育：{len(collected_info['education'])} 条记录")
    if collected_info.get('experience'):
        parts.append(f"工作经历：{len(collected_info['experience'])} 条记录")
    if collected_info.get('projects'):
        parts.append(f"项目：{len(collected_info['projects'])} 条记录")

    return '; '.join(parts) if parts else '新用户'


def parse_llm_response(response: str) -> Dict[str, Any]:
    """解析 LLM 返回的 JSON 响应"""
    try:
        # 清理响应
        cleaned = response.strip()

        # 移除 markdown 代码块标记
        if cleaned.startswith('```'):
            cleaned = cleaned.split('\n', 1)[-1]
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3].rstrip()

        # 解析 JSON
        result = json.loads(cleaned)
        return result
    except Exception as e:
        print(f"解析 LLM 响应失败: {e}")
        print(f"原始响应: {response}")
        # 返回默认响应
        return {
            "reply": "收到，请继续...",
            "extracted_info": {},
            "next_step": "education",
            "is_complete": False
        }


async def conversation_handler(
    message: str,
    step: str,
    collected_info: Dict[str, Any],
    resume_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    对话处理主函数

    Args:
        message: 用户输入的消息
        step: 当前对话步骤
        collected_info: 已收集的信息
        resume_data: 当前简历数据

    Returns:
        包含 reply, next_step, updated_info, is_complete, resume_data 的字典
    """
    # 导入 LLM 调用函数
    try:
        from backend.llm import call_llm
    except ImportError:
        from llm import call_llm

    # 构建 prompt
    prompt = build_conversation_prompt(step, message, collected_info)

    # 调用 LLM
    try:
        llm_response = call_llm(
            provider='deepseek',
            prompt=prompt,
            model='deepseek-chat'
        )

        # 解析响应
        parsed = parse_llm_response(llm_response)

        # 更新收集的信息
        updated_info = {**collected_info}
        extracted = parsed.get('extracted_info', {})

        for key, value in extracted.items():
            if value is not None:
                if key in updated_info and isinstance(updated_info[key], list) and isinstance(value, list):
                    # 合并数组
                    updated_info[key] = updated_info[key] + value
                else:
                    updated_info[key] = value

        # 获取下一步骤
        next_step = parsed.get('next_step', STEP_ORDER.get(step, 'education'))

        # 检查是否完成
        is_complete = parsed.get('is_complete', False)

        # 如果完成，构建完整简历数据
        result_resume_data = None
        if is_complete:
            result_resume_data = build_resume_from_conversation(updated_info, resume_data)

        return {
            "reply": parsed.get('reply', '收到，请继续...'),
            "next_step": next_step,
            "updated_info": updated_info,
            "is_complete": is_complete,
            "resume_data": result_resume_data
        }

    except Exception as e:
        import traceback
        traceback.print_exc()

        # 降级处理：返回错误消息但继续流程
        next_step = STEP_ORDER.get(step, 'education')
        return {
            "reply": f"处理您的输入时遇到了问题，请继续。({str(e)})",
            "next_step": next_step,
            "updated_info": collected_info,
            "is_complete": False,
            "resume_data": None
        }


def build_resume_from_conversation(
    collected_info: Dict[str, Any],
    current_resume: Dict[str, Any]
) -> Dict[str, Any]:
    """
    从对话收集的信息构建完整简历数据

    Args:
        collected_info: 对话收集的信息
        current_resume: 当前简历数据（用于合并）

    Returns:
        完整的简历数据
    """
    # 基础信息
    basic = current_resume.get('basic', {})
    if collected_info.get('name'):
        basic['name'] = collected_info['name']

    # 教育经历
    education = []
    if collected_info.get('education'):
        for idx, edu in enumerate(collected_info['education']):
            education.append({
                'id': f"edu_{datetime.now().timestamp()}_{idx}",
                'school': edu.get('school', ''),
                'major': edu.get('major', ''),
                'degree': edu.get('degree', ''),
                'startDate': edu.get('startDate', ''),
                'endDate': edu.get('endDate', ''),
                'description': edu.get('description', ''),
                'visible': True
            })
    if not education:
        education = current_resume.get('education', [])

    # 工作经历
    experience = []
    if collected_info.get('experience'):
        for idx, exp in enumerate(collected_info['experience']):
            experience.append({
                'id': f"exp_{datetime.now().timestamp()}_{idx}",
                'company': exp.get('company', ''),
                'position': exp.get('position', ''),
                'date': exp.get('date', ''),
                'details': exp.get('details', ''),
                'visible': True
            })
    if not experience:
        experience = current_resume.get('experience', [])

    # 项目经历
    projects = []
    if collected_info.get('projects'):
        for idx, proj in enumerate(collected_info['projects']):
            projects.append({
                'id': f"proj_{datetime.now().timestamp()}_{idx}",
                'name': proj.get('name', ''),
                'role': proj.get('role', ''),
                'date': proj.get('date', ''),
                'description': proj.get('description', ''),
                'visible': True
            })
    if not projects:
        projects = current_resume.get('projects', [])

    # 奖项
    awards = []
    if collected_info.get('awards'):
        for idx, award in enumerate(collected_info['awards']):
            awards.append({
                'id': f"award_{datetime.now().timestamp()}_{idx}",
                'title': award.get('title', ''),
                'issuer': award.get('issuer', ''),
                'date': award.get('date', ''),
                'description': award.get('description', ''),
                'visible': True
            })
    if not awards:
        awards = current_resume.get('awards', [])

    # 技能
    skill_content = collected_info.get('skills', '') or current_resume.get('skillContent', '')

    # 开源经历（保留原有）
    openSource = current_resume.get('openSource', [])

    # 菜单设置（保留原有）
    menuSections = current_resume.get('menuSections', [])
    globalSettings = current_resume.get('globalSettings', {})

    return {
        'basic': basic,
        'education': education,
        'experience': experience,
        'projects': projects,
        'openSource': openSource,
        'awards': awards,
        'skillContent': skill_content,
        'menuSections': menuSections,
        'globalSettings': globalSettings
    }
