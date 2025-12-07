"""
FastAPI 后端入口
提供：
1) /api/health 健康检查
2) /api/ai/test 测试现有 LLM 是否可用
3) /api/resume/generate 一句话 → 结构化简历 JSON
4) /api/pdf/render 由简历 JSON 生成 PDF

说明：
- 直接复用根目录 simple.py 中的 call_zhipu_api / call_gemini_api
- 先本地跑通基础的生成 + PDF 渲染
- 后续可增加 WebSocket、版本管理、鉴权等
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any

"""
加载环境变量（强制从项目根目录 .env 读取，并允许覆盖）
"""
import os
from pathlib import Path
try:
    from dotenv import load_dotenv
    ROOT_DIR = Path(__file__).resolve().parents[1]
    DOTENV_PATH = ROOT_DIR / ".env"
    """优先加载项目根目录的 .env，再调用一次默认加载以兼容其他位置"""
    load_dotenv(dotenv_path=str(DOTENV_PATH), override=True)
    load_dotenv(override=True)
except Exception:
    pass

"""
重写接口的数据模型
"""
class RewriteRequest(BaseModel):
    provider: Literal["zhipu", "gemini", "mock"] = Field(default="mock")
    resume: Dict[str, Any]
    path: str = Field(..., description="JSON 路径，如 summary 或 experience[0].achievements[1]")
    instruction: str = Field(..., description="修改意图，如：更量化、更贴合后端 JD")
    locale: Literal["zh", "en"] = Field(default="zh")


"""
导入 simple.py 的现有 AI 调用
并将项目根目录加入 sys.path，保证可导入 simple
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

try:
    import simple
except Exception as e:
    raise RuntimeError(f"无法导入 simple.py: {e}")

"""
初始化 FastAPI 应用与 CORS
"""
app = FastAPI(title="Resume Agent Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

"""
请求 / 响应数据模型
"""
class AITestRequest(BaseModel):
    provider: Literal["zhipu", "gemini", "mock"] = Field(default="mock")
    prompt: str = Field(..., description="测试提示词")

class ResumeGenerateRequest(BaseModel):
    provider: Literal["zhipu", "gemini", "mock"] = Field(default="mock")
    instruction: str = Field(..., description="一句话或少量信息，说明岗位/经历/技能等")
    locale: Literal["zh", "en"] = Field(default="zh", description="输出语言")

class ResumeGenerateResponse(BaseModel):
    resume: Dict[str, Any]
    provider: str

class ResumeJSON(BaseModel):
    name: Optional[str] = None
    contact: Optional[Dict[str, Optional[str]]] = None
    summary: Optional[str] = None
    experience: Optional[List[Dict[str, Any]]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    skills: Optional[List[str]] = None
    education: Optional[List[Dict[str, Any]]] = None
    awards: Optional[List[Dict[str, Any]]] = None

class RenderPDFRequest(BaseModel):
    resume: Dict[str, Any]
    demo: Optional[bool] = False

"""
LLM 调用统一封装
"""

def call_llm(provider: str, prompt: str) -> str:
    """
    统一入口，基于 simple.py 封装 LLM 调用
    在调用前检查必要的 API Key，缺失时返回 400 级错误
    """
    if provider == "mock":
        return f"MOCK: {prompt[:80]}"
    if provider == "zhipu":
        import os as _os
        key = _os.getenv("ZHIPU_API_KEY") or getattr(simple, "ZHIPU_API_KEY", "")
        if not key:
            from fastapi import HTTPException as _HE
            raise _HE(status_code=400, detail="缺少 ZHIPU_API_KEY，请在项目根目录 .env 或系统环境中配置 ZHIPU_API_KEY")
        """同步到 simple 以供 SDK 使用"""
        simple.ZHIPU_API_KEY = key
        return simple.call_zhipu_api(prompt)
    elif provider == "gemini":
        import os as _os
        key = _os.getenv("GEMINI_API_KEY") or getattr(simple, "GEMINI_API_KEY", "")
        if not key:
            from fastapi import HTTPException as _HE
            raise _HE(status_code=400, detail="缺少 GEMINI_API_KEY，请在项目根目录 .env 或系统环境中配置 GEMINI_API_KEY")
        simple.GEMINI_API_KEY = key
        """允许覆盖可选配置"""
        simple.GEMINI_MODEL = _os.getenv("GEMINI_MODEL", simple.GEMINI_MODEL)
        simple.GEMINI_BASE_URL = _os.getenv("GEMINI_BASE_URL", simple.GEMINI_BASE_URL)
        return simple.call_gemini_api(prompt)
    else:
        raise ValueError("不支持的 provider")

"""
简历 JSON 生成提示词
约束模型输出 JSON（无 Markdown、无额外文字）
"""

def build_resume_prompt(instruction: str, locale: str = "zh") -> str:
    """
    构建简历生成提示词，优化为更简洁快速
    根据用户的一句话指令，构造严格的 JSON 输出提示词
    优化：要求更简洁的输出，减少不必要的描述
    """
    lang_header = "请使用中文输出，只输出 JSON，不要其他文字" if locale == "zh" else "Please output JSON only, no other text"
    schema = (
        "{"
        "\n  \"name\": \"姓名或英文名\","
        "\n  \"contact\": {\n    \"email\": \"...\", \n    \"phone\": \"...\", \n    \"location\": \"...\"\n  },"
        "\n  \"summary\": \"一句话职业总结或2-3句简介\","
        "\n  \"experience\": ["
        "{\n    \"company\": \"公司\", \n    \"position\": \"职位\", \n    \"duration\": \"起止时间\", \n    \"location\": \"地点\","
        "\n    \"achievements\": [\"量化成果1\", \"量化成果2\"]\n  }"
        "] ,"
        "\n  \"projects\": ["
        "{\n    \"name\": \"项目名\", \n    \"role\": \"角色\", \n    \"stack\": [\"技术1\", \"技术2\"], \n    \"highlights\": [\"亮点1\", \"亮点2\"]\n  }"
        "] ,"
        "\n  \"skills\": [\"技能1\", \"技能2\"],"
        "\n  \"education\": ["
        "{\n    \"school\": \"学校\", \n    \"degree\": \"学位\", \n    \"major\": \"专业\", \n    \"duration\": \"起止时间\"\n  }"
        "] ,"
        "\n  \"awards\": ["
        "{\n    \"title\": \"奖项\", \"issuer\": \"颁发方\", \"date\": \"日期\"\n  }"
        "]\n}"
    )

    prompt = f"""
{lang_header}，并严格输出 JSON（不要使用 Markdown、不要加解释、不要加代码块）。

用户需求：
{instruction}

请基于招聘 ATS 最佳实践（动词开头、含量化指标、突出影响），返回以下 JSON 结构：
{schema}

重要提示：
1. 必须根据用户输入的具体信息生成，不要使用固定模板
2. 姓名、公司、项目名称等必须多样化，不要总是使用“张明”、“XX科技”等固定名称
3. 技能栈必须与用户输入的技术栏一致（如用户提到 Go，就要包含 Go）
4. experience 字段必须包含，至少1条工作经历
5. projects 字段必须包含，至少1个项目
6. skills 字段必须是字符串数组，如 ["Java", "Python", "MySQL"]
7. 所有量化成果必须包含具体数字
8. 严格按照上述 JSON 格式输出，不要添加任何其他字段
9. 每次生成的内容应该不同，不要重复之前的结果
"""
    return prompt

"""
简单 PDF 渲染（ReportLab）
此实现偏基础：按段落顺序绘制文本。后续可替换为模板化、排版更美观的版本。
"""

from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, ListFlowable, ListItem
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle


def render_pdf_from_resume(resume_data: Dict[str, Any]) -> BytesIO:
    """
    将简历 JSON 渲染为 PDF（兼容旧/新两种结构）
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(name='Title', parent=styles['Title'], fontSize=20, spaceAfter=8)
    h_style = ParagraphStyle(name='Heading', parent=styles['Heading2'], textColor=colors.HexColor('#333333'), spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle(name='Body', parent=styles['BodyText'], leading=16)
    bullet_style = ParagraphStyle(name='Bullet', parent=styles['BodyText'], leftIndent=12, bulletIndent=0, leading=16)

    story: List[Any] = []

    name = (resume_data.get('name') or '姓名')
    story.append(Paragraph(str(name), title_style))

    contact = resume_data.get('contact') or {}
    contact_line_parts: List[str] = []
    for k in ['email', 'phone', 'location', 'role']:
        v = contact.get(k)
        if isinstance(v, str) and v.strip():
            contact_line_parts.append(v.strip())
    contact_line = " · ".join(contact_line_parts)
    if contact_line:
        story.append(Paragraph(contact_line, body_style))
        story.append(Spacer(1, 8))

    summary = resume_data.get('summary')
    if isinstance(summary, str) and summary.strip():
        story.append(Paragraph('个人简介', h_style))
        story.append(Paragraph(summary.strip(), body_style))

    """
    旧结构：experience + achievements
    新结构：internships [{title, subtitle, date}]
    """
    internships = resume_data.get('internships') or []
    if isinstance(internships, list) and internships:
        story.append(Paragraph('实习经历', h_style))
        for it in internships:
            title = it.get('title') or ''
            subtitle = it.get('subtitle') or ''
            date = it.get('date') or ''
            header = " - ".join([s for s in [title, subtitle] if s])
            if header:
                story.append(Paragraph(header, body_style))
            if date:
                story.append(Paragraph(str(date), body_style))

    exp = resume_data.get('experience') or []
    if isinstance(exp, list) and exp:
        story.append(Paragraph('工作经历', h_style))
        for e in exp:
            header = " - ".join([v for v in [e.get('company'), e.get('position'), e.get('duration')] if v])
            if header:
                story.append(Paragraph(header, body_style))
            ach = e.get('achievements') or []
            if isinstance(ach, list) and ach:
                items = [ListItem(Paragraph(str(a), body_style)) for a in ach]
                story.append(ListFlowable(items, bulletType='bullet', start='circle'))

    """
    旧结构：projects [{name, role, highlights[]}]
    新结构：projects [{title, items: [{title, details[]}]}]
    """
    projects = resume_data.get('projects') or []
    if isinstance(projects, list) and projects:
        story.append(Paragraph('项目经历', h_style))
        for p in projects:
            """新结构优先"""
            header = p.get('title') or " - ".join([v for v in [p.get('name'), p.get('role')] if v])
            if header:
                story.append(Paragraph(str(header), body_style))

            if isinstance(p.get('items'), list) and p['items']:
                for sub in p['items']:
                    st = sub.get('title')
                    if st:
                        story.append(Paragraph(str(st), body_style))
                    details = sub.get('details') or []
                    if isinstance(details, list) and details:
                        items = [ListItem(Paragraph(str(d), body_style)) for d in details]
                        story.append(ListFlowable(items, bulletType='bullet'))
            else:
                highlights = p.get('highlights') or []
                if isinstance(highlights, list) and highlights:
                    items = [ListItem(Paragraph(str(h), body_style)) for h in highlights]
                    story.append(ListFlowable(items, bulletType='bullet'))

    """
    技能：
    旧结构：skills: ["Java", "Go"]
    新结构：skills: [{category, details}]
    """
    skills = resume_data.get('skills') or []
    if skills:
        story.append(Paragraph('专业技能', h_style))
        if all(isinstance(s, str) for s in skills):
            story.append(Paragraph("、".join(skills), body_style))
        else:
            for s in skills:
                if isinstance(s, dict):
                    cat = s.get('category') or ''
                    det = s.get('details') or ''
                    line = (f"{cat}: {det}").strip(': ')
                    if line:
                        story.append(Paragraph(line, body_style))

    """
    教育经历：
    旧结构：education[{school, degree, duration, major}]
    新结构：education[{title, date, honors}]
    """
    edu = resume_data.get('education') or []
    if isinstance(edu, list) and edu:
        story.append(Paragraph('教育经历', h_style))
        for ed in edu:
            header = ed.get('title') or " - ".join([v for v in [ed.get('school'), ed.get('degree'), ed.get('duration')] if v])
            if header:
                story.append(Paragraph(str(header), body_style))
            extra = ed.get('honors') or ed.get('major')
            if extra:
                story.append(Paragraph(str(extra), body_style))

    awards = resume_data.get('awards') or []
    if isinstance(awards, list) and awards:
        story.append(Paragraph('奖项', h_style))
        for a in awards:
            header = " - ".join([v for v in [a.get('title'), a.get('issuer'), a.get('date')] if v])
            if header:
                story.append(Paragraph(str(header), body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer

"""
路由实现
"""

@app.get("/api/health")
async def health():
    """
    健康检查
    """
    return {"status": "ok"}


"""
API Key 配置接口
"""
class SaveKeysRequest(BaseModel):
    zhipu_key: Optional[str] = None
    gemini_key: Optional[str] = None


@app.get("/api/config/keys")
async def get_keys_status():
    """
    获取 API Key 配置状态（不返回完整 Key，只返回是否已配置）
    """
    zhipu_key = os.getenv("ZHIPU_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    
    return {
        "zhipu": {
            "configured": bool(zhipu_key and len(zhipu_key) > 10),
            "preview": f"{zhipu_key[:8]}..." if zhipu_key and len(zhipu_key) > 10 else ""
        },
        "gemini": {
            "configured": bool(gemini_key and len(gemini_key) > 10),
            "preview": f"{gemini_key[:8]}..." if gemini_key and len(gemini_key) > 10 else ""
        }
    }


@app.post("/api/config/keys")
async def save_keys(body: SaveKeysRequest):
    """
    保存 API Key 到 .env 文件
    """
    try:
        env_path = ROOT_DIR / ".env"
        
        """读取现有 .env 内容"""
        existing_lines = []
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                existing_lines = f.readlines()
        
        """更新或添加 Key"""
        new_lines = []
        zhipu_found = False
        gemini_found = False
        
        for line in existing_lines:
            if line.startswith("ZHIPU_API_KEY=") and body.zhipu_key:
                new_lines.append(f"ZHIPU_API_KEY={body.zhipu_key}\n")
                zhipu_found = True
            elif line.startswith("GEMINI_API_KEY=") and body.gemini_key:
                new_lines.append(f"GEMINI_API_KEY={body.gemini_key}\n")
                gemini_found = True
            else:
                new_lines.append(line)
        
        """如果没有找到，追加到末尾"""
        if body.zhipu_key and not zhipu_found:
            new_lines.append(f"ZHIPU_API_KEY={body.zhipu_key}\n")
        if body.gemini_key and not gemini_found:
            new_lines.append(f"GEMINI_API_KEY={body.gemini_key}\n")
        
        """写入文件"""
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        
        """重新加载环境变量"""
        load_dotenv(dotenv_path=str(env_path), override=True)
        
        return {"success": True, "message": "API Key 已保存"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@app.post("/api/ai/test")
async def ai_test(body: AITestRequest):
    """
    测试已有 AI 接口是否可用
    """
    try:
        result = call_llm(body.provider, body.prompt)
        return {"provider": body.provider, "result": result}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 测试失败: {e}")


"""A mock resume object that matches the new data structure"""
MOCK_RESUME_DATA = {
    "name": "某某 (Mock)",
    "contact": {
        "phone": "000-0000-0000",
        "email": "mock@example.com",
        "role": "后端开发工程师"
    },
    "internships": [
        {"title": "实习经历一", "subtitle": "某知名互联网公司", "date": "2025.06 - 2025.10"},
        {"title": "实习经历二", "subtitle": "某初创科技公司", "date": "2025.02 - 2025.06"},
    ],
    "projects": [
        {
            "title": "项目一：智能简历分析系统",
            "items": [
                {
                    "title": "子项目甲：核心引擎",
                    "details": [
                        "负责简历解析模块，使用 NLP 技术提取关键信息，准确率提升至 95%",
                        "设计并实现 JD 匹配算法，将匹配速度优化 50%",
                    ]
                }
            ]
        }
    ],
    "openSource": [
        {
            "title": "社区贡献一",
            "subtitle": "某分布式项目",
            "items": [
                "仓库: https://example.com/repo1",
                "提交了关于性能优化的核心 PR，被成功合并",
            ]
        }
    ],
    "skills": [
        {"category": "后端", "details": "熟悉 Python/Go，精通 FastAPI 与微服务架构"},
        {"category": "数据库", "details": "熟悉 MySQL/Redis，有分库分表与调优经验"},
    ],
    "education": [
        {
            "title": "某高校 - 计算机科学 - 本科",
            "date": "2022.09 - 2026.06",
            "honors": "荣誉：国家奖学金、ACM 竞赛省级一等奖"
        }
    ]
}

@app.post("/api/resume/generate", response_model=ResumeGenerateResponse)
async def generate_resume(body: ResumeGenerateRequest):
    """
    一句话 → 结构化简历 JSON
    """
    if body.provider == "mock":
        return ResumeGenerateResponse(resume=MOCK_RESUME_DATA, provider="mock")

    prompt = build_resume_prompt(body.instruction, body.locale)
    try:
        raw = call_llm(body.provider, prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {e}")

    """清理返回内容中的特殊标签和多余字符"""
    import re
    import json as _json
    
    """移除智谱的特殊标签"""
    cleaned = re.sub(r'<\|begin_of_box\|>', '', raw)
    cleaned = re.sub(r'<\|end_of_box\|>', '', cleaned)
    cleaned = cleaned.strip()
    
    """修复常见的 JSON 格式错误"""
    """修复 ]} , 这种错误格式，应该是 ]}}"""
    cleaned = re.sub(r'\]\}\s*,\s*"', ']}}, "', cleaned)
    """修复数组后多余的逗号：]} , 应该是 ]}"""
    cleaned = re.sub(r'\]\}\s*,\s*(["\}])', r']} \1', cleaned)
    """修复数组结尾多余逗号：] , 应该是 ]"""
    cleaned = re.sub(r'\]\s*,\s*(["\}])', r'] \1', cleaned)
    """修复缺少逗号的错误"""
    cleaned = re.sub(r'\]\s+""([a-zA-Z_]+)"', r'], "\1"', cleaned)
    cleaned = re.sub(r'\]\s+"([a-zA-Z_]+)"\s*:', r'], "\1":', cleaned)
    cleaned = re.sub(r'\]\}\s+"([a-zA-Z_]+)"\s*:', r']}, "\1":', cleaned)
    
    """尝试解析 JSON"""
    data = None
    try:
        """直接解析"""
        data = _json.loads(cleaned)
    except Exception:
        try:
            """尝试提取 JSON 部分"""
            start = cleaned.find('{')
            end = cleaned.rfind('}')
            if start != -1 and end != -1 and end > start:
                json_str = cleaned[start:end+1]
                data = _json.loads(json_str)
            else:
                """尝试查找最后一个完整的 JSON 对象"""
                import re as _re
                json_matches = _re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned)
                if json_matches:
                    """使用最长的匹配"""
                    json_str = max(json_matches, key=len)
                    data = _json.loads(json_str)
                else:
                    raise ValueError("未找到有效的 JSON 对象")
        except Exception as e:
            """如果还是失败，尝试更智能的 JSON 提取"""
            """查找所有可能的 JSON 对象，选择最完整的"""
            import re as _re
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            json_matches = _re.finditer(json_pattern, cleaned, _re.DOTALL)
            
            best_match = None
            best_length = 0
            
            for match in json_matches:
                try:
                    candidate = _json.loads(match.group(0))
                    """检查是否包含必要的字段"""
                    if isinstance(candidate, dict) and len(match.group(0)) > best_length:
                        best_match = candidate
                        best_length = len(match.group(0))
                except:
                    continue
            
            if best_match:
                data = best_match
            else:
                """最后尝试：使用 instructor 库强制 JSON 输出（如果可用）"""
                try:
                    from instructor import patch
                    from pydantic import BaseModel
                    from typing import Dict, Any, List, Optional
                    
                    """定义简历结构"""
                    class ResumeModel(BaseModel):
                        name: Optional[str] = None
                        contact: Optional[Dict[str, Optional[str]]] = None
                        summary: Optional[str] = None
                        experience: Optional[List[Dict[str, Any]]] = None
                        projects: Optional[List[Dict[str, Any]]] = None
                        skills: Optional[List[str]] = None
                        education: Optional[List[Dict[str, Any]]] = None
                        awards: Optional[List[Dict[str, Any]]] = None
                    
                    """使用 instructor 强制结构化输出"""
                    if body.provider == "zhipu" and simple.ZhipuAiClient is not None:
                        client = simple.ZhipuAiClient(api_key=simple.ZHIPU_API_KEY)
                        patched_client = patch(client)
                        result = patched_client.chat.completions.create(
                            model=simple.ZHIPU_MODEL,
                            response_model=ResumeModel,
                            messages=[{"role": "user", "content": prompt}],
                            temperature=0.7
                        )
                        data = result.model_dump()
                    else:
                        raise ValueError("无法使用 instructor，回退到原始错误")
                except Exception as instructor_error:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"解析 JSON 失败: {e}, 所有方法都失败，原始返回长度: {len(cleaned)}, 前1000字符: {cleaned[:1000]}"
                    )

    return ResumeGenerateResponse(resume=data, provider=body.provider)


class FormatTextRequest(BaseModel):
    """格式化文本请求"""
    text: str = Field(..., description="简历文本内容")
    provider: Literal['zhipu', 'gemini'] = Field(default='zhipu', description="AI 提供商")
    use_ai: bool = Field(default=True, description="是否允许使用 AI（最后一层）")


class FormatTextResponse(BaseModel):
    """格式化文本响应"""
    success: bool
    data: Optional[Dict[str, Any]]
    method: str  # "json-repair", "regex", "smart", "ai"
    error: Optional[str]


@app.post("/api/resume/format", response_model=FormatTextResponse)
async def format_resume_text_api(body: FormatTextRequest):
    """
    多层降级的简历文本格式化
    
    策略：
    1. json-repair 快速修复（0.1秒）
    2. 正则提取 JSON（0.1秒）
    3. 智能解析（0.1秒）
    4. AI 解析（3-5秒，最后手段）
    """
    from backend.format_helper import format_resume_text
    
    """定义 AI 回调函数（支持分块处理）"""
    def ai_callback(text: str) -> Dict:
        """
        使用分块处理 + AI 解析
        对于长文本，分块后分别调用 AI，最后合并
        """
        from backend.chunk_processor import split_resume_text, merge_resume_chunks
        import re
        import json as _json
        
        """
        判断是否需要分块（超过 300 字符）
        分块越小，每块处理越快
        """
        if len(text) > 300:
            print(f"[分块处理] 文本长度 {len(text)}，开始分块...")
            chunks = split_resume_text(text, max_chunk_size=250)
            print(f"[分块处理] 分为 {len(chunks)} 块")
            
            chunks_results = []
            for i, chunk in enumerate(chunks):
                print(f"[分块处理] 处理第 {i+1}/{len(chunks)} 块: {chunk['section']}")
                
                """
                为每个分块构造 Prompt
                """
                chunk_prompt = f"""提取以下简历段落为JSON。只提取原文。

段落：{chunk['section']}

{chunk['content']}"""
                
                try:
                    raw = call_llm(body.provider, chunk_prompt)
                    
                    """
                    清理和解析
                    """
                    cleaned = re.sub(r'<\|begin_of_box\|>', '', raw)
                    cleaned = re.sub(r'<\|end_of_box\|>', '', cleaned)
                    cleaned = cleaned.strip()
                    
                    try:
                        chunk_data = _json.loads(cleaned)
                    except:
                        start = cleaned.find('{')
                        end = cleaned.rfind('}')
                        if start != -1 and end != -1:
                            chunk_data = _json.loads(cleaned[start:end+1])
                        else:
                            print(f"[分块处理] 第 {i+1} 块解析失败")
                            continue
                    
                    chunks_results.append(chunk_data)
                    print(f"[分块处理] 第 {i+1} 块完成")
                    
                except Exception as e:
                    print(f"[分块处理] 第 {i+1} 块失败: {e}")
                    continue
            
            """
            合并所有分块结果
            """
            merged_data = merge_resume_chunks(chunks_results)
            print(f"[分块处理] 合并完成，字段: {list(merged_data.keys())}")
            return merged_data
        
        """
        短文本：直接处理
        """
        print(f"[直接处理] 文本长度 {len(text)}")
        prompt = f"""提取简历信息JSON。规则：只提取原文，不添加，灵活识别字段。

{text}"""
        
        raw = call_llm(body.provider, prompt)
        
        """
        清理和解析 JSON
        """
        cleaned = re.sub(r'<\|begin_of_box\|>', '', raw)
        cleaned = re.sub(r'<\|end_of_box\|>', '', cleaned)
        cleaned = cleaned.strip()
        
        """
        尝试直接解析
        """
        try:
            data = _json.loads(cleaned)
            return data
        except:
            """提取 JSON 部分"""
            start = cleaned.find('{')
            end = cleaned.rfind('}')
            if start != -1 and end != -1:
                data = _json.loads(cleaned[start:end+1])
                return data
            raise ValueError("无法解析 AI 返回的 JSON")
    
    """执行多层格式化"""
    result = format_resume_text(
        text=body.text,
        use_ai=body.use_ai,
        ai_callback=ai_callback if body.use_ai else None
    )
    
    return FormatTextResponse(**result)


@app.post("/api/pdf/render")
async def render_pdf(body: RenderPDFRequest):
    """
    将简历 JSON 渲染为 PDF 并返回（使用 LaTeX）
    支持 demo 模式：如果 body.demo 为 True，使用固定的 demo 模板
    """
    try:
        """导入 LaTeX 生成器"""
        from backend.latex_generator import render_pdf_from_resume_latex
        import json
        from pathlib import Path
        
        """如果请求 demo 模式，使用固定模板"""
        resume_data = body.resume
        if hasattr(body, 'demo') and getattr(body, 'demo', False):
            demo_file = Path(__file__).parent.parent / 'test_resume_demo.json'
            if demo_file.exists():
                with open(demo_file, 'r', encoding='utf-8') as f:
                    resume_data = json.load(f)
        
        pdf_io = render_pdf_from_resume_latex(resume_data)
        return StreamingResponse(pdf_io, media_type='application/pdf', headers={
            'Content-Disposition': 'inline; filename="resume.pdf"'
        })
    except Exception as e:
        """如果 LaTeX 编译失败，回退到 ReportLab"""
        try:
            pdf_io = render_pdf_from_resume(body.resume)
            return StreamingResponse(pdf_io, media_type='application/pdf', headers={
                'Content-Disposition': 'inline; filename="resume.pdf"'
            })
        except Exception as fallback_error:
            raise HTTPException(status_code=500, detail=f"PDF 渲染失败: LaTeX 错误 - {e}, ReportLab 错误 - {fallback_error}")


"""
JSON 路径工具：支持 a.b[0].c 形式的简单路径
"""

def _parse_path(path: str):
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


def _get_by_path(obj, parts):
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


def _set_by_path(obj, parts, new_value):
    """
    将路径对应的值替换为 new_value
    """
    if not parts:
        raise ValueError("路径不能为空")
    parent, key, _ = _get_by_path(obj, parts)
    if isinstance(key, int):
        parent[key] = new_value
    else:
        parent[key] = new_value
    return obj


"""
重写提示词构造
"""

def build_rewrite_prompt(path: str, original_value: Any, instruction: str, locale: str = "zh") -> str:
    """
    构造一个将字段进行改写的提示词
    如果原值是字符串，则要求输出单段文本；
    如果原值是数组或对象，则要求输出 JSON。
    """
    lang = "请使用中文输出" if locale == "zh" else "Please output in English"
    if isinstance(original_value, str):
        return f"""
{lang}。你是简历优化助手，请按照以下意图重写文本：{instruction}
要求：
1. 以动词开头，量化成果，突出影响；
2. 输出纯文本，不要包含任何多余解释或代码块；

原始文本：
{original_value}
"""
    else:
        return f"""
{lang}。你是简历优化助手，请根据以下意图重写数据：{instruction}
要求：
1. 以动词开头，量化成果，突出影响；
2. 严格输出 JSON，结构需与原值类型一致；

原始数据(JSON)：
{original_value}
"""


@app.post("/api/resume/rewrite")
async def rewrite_resume(body: RewriteRequest):
    """
    对简历 JSON 的某个路径进行 AI 改写
    支持路径形式：summary、experience[0].achievements[1]
    """
    try:
        parts = _parse_path(body.path)
        parent, key, cur_value = _get_by_path(body.resume, parts)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"路径错误：{e}")

    prompt = build_rewrite_prompt(body.path, cur_value, body.instruction, body.locale)
    try:
        raw = call_llm(body.provider, prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败：{e}")

    new_value: Any = None
    if isinstance(cur_value, str):
        text = raw.strip()
        if text.startswith('```'):
            idx = text.find('\n')
            if idx != -1:
                text = text[idx+1:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
        new_value = text
    else:
        import json as _json
        try:
            new_value = _json.loads(raw)
        except Exception:
            try:
                s = raw.find('{')
                e = raw.rfind('}')
                if s != -1 and e != -1 and e > s:
                    new_value = _json.loads(raw[s:e+1])
                else:
                    raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"解析 JSON 失败: {e}")

    try:
        updated = _set_by_path(body.resume, parts, new_value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入失败：{e}")

    return {"resume": updated}


"""
本地运行：
1) 安装依赖：pip3 install -r backend/requirements.txt --break-system-packages
2) 启动服务：uvicorn backend.main:app --reload --port 8000
3) 测试接口：
   - 健康：curl http://127.0.0.1:8000/api/health | cat
   - AI测试：curl -X POST http://127.0.0.1:8000/api/ai/test -H 'Content-Type: application/json' -d '{"provider":"zhipu","prompt":"用一句话介绍人工智能"}' | cat
   - 生成简历：curl -X POST http://127.0.0.1:8000/api/resume/generate -H 'Content-Type: application/json' -d '{"provider":"zhipu","instruction":"3年后端开发，Java+Spring，投递后端工程师"}' | cat
   - 渲染 PDF：将上一步返回中的 resume 作为 /api/pdf/render 的 body
   - 改写字段：curl -X POST http://127.0.0.1:8000/api/resume/rewrite -H 'Content-Type: application/json' -d '{"provider":"zhipu","path":"summary","instruction":"更量化","resume":{}}' | cat
"""

