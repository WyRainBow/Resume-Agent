import json
import uuid
from backend.agent.tool.base import BaseTool, ToolResult
from backend.core.logger import get_logger

logger = get_logger(__name__)

GENERATE_RESUME_PROMPT = """你是专业简历写作专家。根据以下信息生成完整简历 JSON。

目标岗位：{job_description}
用户背景：{user_background}

严格按此 JSON schema 输出，不输出其他文字：
{{
  "basic": {{"name": "", "title": "", "email": "", "phone": "", "location": ""}},
  "education": [{{"id": "", "school": "", "major": "", "degree": "", "startDate": "", "endDate": "", "description": ""}}],
  "experience": [{{"id": "", "company": "", "position": "", "date": "", "details": ""}}],
  "projects": [{{"id": "", "name": "", "role": "", "date": "", "description": "", "link": ""}}],
  "openSource": [],
  "awards": [],
  "skillContent": ""
}}"""


class GenerateResumeTool(BaseTool):
    name: str = "generate_resume"
    description: str = (
        "根据岗位描述和用户背景，从零生成完整简历。"
        "适用于：用户没有简历、或想针对新岗位重新生成。"
    )
    parameters: dict = {
        "type": "object",
        "properties": {
            "job_description": {
                "type": "string",
                "description": "目标岗位 JD 或岗位名称",
            },
            "user_background": {
                "type": "string",
                "description": "用户自述经历、技能、教育背景（可选）",
            },
        },
        "required": ["job_description"],
    }

    async def execute(self, job_description: str, user_background: str = "") -> ToolResult:
        from backend.agent.llm import LLM
        from backend.agent.schema import Message, Role

        prompt = GENERATE_RESUME_PROMPT.format(
            job_description=job_description,
            user_background=user_background or "未提供",
        )
        try:
            llm = LLM()
            response = await llm.ask(
                messages=[Message(role=Role.USER, content=prompt)],
            )
            content = response.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            resume_dict = json.loads(content.strip())

            for section in ["education", "experience", "projects", "openSource", "awards"]:
                for item in resume_dict.get(section, []):
                    if not item.get("id"):
                        item["id"] = str(uuid.uuid4())

            summary = f"已生成面向「{job_description[:30]}」的简历"
            structured_data = {
                "type": "resume_generated",
                "resume": resume_dict,
                "summary": summary,
            }
            return ToolResult(
                output=summary,
                system=json.dumps(structured_data, ensure_ascii=False),
            )
        except json.JSONDecodeError as e:
            logger.error(f"[GenerateResumeTool] JSON 解析失败: {e}")
            return ToolResult(output="生成失败，LLM 返回格式有误", error=str(e))
        except Exception as e:
            logger.error(f"[GenerateResumeTool] 生成异常: {e}")
            return ToolResult(output=f"生成失败: {e}", error=str(e))
