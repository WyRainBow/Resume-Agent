"""
简历相关路由
"""
import re
import json as _json
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models import (
    ResumeGenerateRequest, ResumeGenerateResponse, 
    ResumeParseRequest, SectionParseRequest,
    RewriteRequest, FormatTextRequest, FormatTextResponse
)
from ..llm import call_llm, call_llm_stream, DEFAULT_AI_PROVIDER
from ..prompts import build_resume_prompt, build_rewrite_prompt, SECTION_PROMPTS
from ..json_path import parse_path, get_by_path, set_by_path
from ..chunk_processor import split_resume_text, merge_resume_chunks

router = APIRouter(prefix="/api", tags=["Resume"])

ROOT = Path(__file__).resolve().parents[2]

# Mock 数据
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


def clean_llm_response(raw: str) -> str:
    """清理 LLM 返回的内容"""
    cleaned = re.sub(r'<\|begin_of_box\|>', '', raw)
    cleaned = re.sub(r'<\|end_of_box\|>', '', cleaned)
    cleaned = re.sub(r'```json\s*', '', cleaned)
    cleaned = re.sub(r'```\s*', '', cleaned)
    return cleaned.strip()


def parse_json_response(cleaned: str) -> Dict:
    """解析 JSON 响应"""
    try:
        return _json.loads(cleaned)
    except Exception:
        # 尝试提取 JSON 部分
        if cleaned.startswith('['):
            start = cleaned.find('[')
            end = cleaned.rfind(']')
        else:
            start = cleaned.find('{')
            end = cleaned.rfind('}')
        
        if start != -1 and end != -1 and end > start:
            return _json.loads(cleaned[start:end+1])
        raise


@router.post("/resume/generate", response_model=ResumeGenerateResponse)
async def generate_resume(body: ResumeGenerateRequest):
    """一句话 → 结构化简历 JSON"""
    if body.provider == "mock":
        return ResumeGenerateResponse(resume=MOCK_RESUME_DATA, provider="mock")

    prompt = build_resume_prompt(body.instruction, body.locale)
    try:
        raw = call_llm(body.provider, prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {e}")

    cleaned = clean_llm_response(raw)
    
    # 修复常见的 JSON 格式错误
    cleaned = re.sub(r'\]\}\s*,\s*"', ']}}, "', cleaned)
    cleaned = re.sub(r'\]\}\s*,\s*(["\}])', r']} \1', cleaned)
    cleaned = re.sub(r'\]\s*,\s*(["\}])', r'] \1', cleaned)
    cleaned = re.sub(r'\]\s+""([a-zA-Z_]+)"', r'], "\1"', cleaned)
    cleaned = re.sub(r'\]\s+"([a-zA-Z_]+)"\s*:', r'], "\1":', cleaned)
    cleaned = re.sub(r'\]\}\s+"([a-zA-Z_]+)"\s*:', r']}, "\1":', cleaned)
    
    try:
        data = parse_json_response(cleaned)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析 JSON 失败: {e}")

    return ResumeGenerateResponse(resume=data, provider=body.provider)


@router.post("/resume/parse")
async def parse_resume_text(body: ResumeParseRequest):
    """AI 解析简历文本 → 结构化简历 JSON"""
    provider = body.provider or DEFAULT_AI_PROVIDER
    
    if provider == "mock":
        return {"resume": MOCK_RESUME_DATA, "provider": "mock"}
    
    # 格式定义
    schema_desc = """格式:{"name":"姓名","contact":{"phone":"电话","email":"邮箱"},"objective":"求职意向","education":[{"title":"学校","subtitle":"学历","date":"时间","major":"专业","details":["荣誉"]}],"internships":[{"title":"公司","subtitle":"职位","date":"时间","highlights":["工作内容"]}],"projects":[{"title":"项目名","subtitle":"角色","date":"时间","highlights":["描述"]}],"openSource":[{"title":"开源项目","subtitle":"描述","items":["贡献"],"repoUrl":"链接"}],"skills":[{"category":"类别","details":"技能"}],"awards":["奖项"]}"""

    # 如果文本过长，使用分块处理
    if len(body.text) > 800:
        print(f"[解析] 文本长度 {len(body.text)}，启用分块处理")
        chunks = split_resume_text(body.text, max_chunk_size=300)
        chunks_results = []
        
        for i, chunk in enumerate(chunks):
            print(f"[解析] 处理第 {i+1}/{len(chunks)} 块: {chunk['section']}")
            chunk_prompt = f"""从简历文本片段提取信息,只输出JSON(不要markdown,无数据的字段用空数组[]):
片段内容({chunk['section']}):
{chunk['content']}
{schema_desc}"""
            try:
                raw = call_llm(provider, chunk_prompt)
                cleaned = clean_llm_response(raw)
                chunk_data = parse_json_response(cleaned)
                chunks_results.append(chunk_data)
            except Exception as e:
                print(f"[解析] 第 {i+1} 块失败: {e}")
                # 使用新日志系统记录错误
                from logger import write_llm_debug, backend_logger
                backend_logger.warning(f"分块 {i+1} 解析失败: {e}")
                write_llm_debug(f"Chunk {i+1} Error: {e}")
                continue
        
        short_data = merge_resume_chunks(chunks_results)
        print("[解析] 分块合并完成")
    
    else:
        # 短文本直接处理
        prompt = f"""从简历文本提取信息,只输出JSON(不要markdown,无数据的字段用空数组[]):
{body.text}
{schema_desc}"""
        
        try:
            raw = call_llm(provider, prompt)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM 调用失败: {e}")
        
        cleaned = clean_llm_response(raw)
        
        try:
            short_data = parse_json_response(cleaned)
        except Exception as e:
            # 使用新日志系统记录错误
            from logger import write_llm_debug, backend_logger
            backend_logger.error(f"JSON 解析失败: {e}")
            write_llm_debug(raw, cleaned)
            
            raise HTTPException(status_code=500, detail="AI 返回的内容无法解析为 JSON，请重试")
    
    data = {
        "name": short_data.get("name", ""),
        "contact": short_data.get("contact", {"phone": "", "email": ""}),
        "objective": short_data.get("objective", ""),
        "education": short_data.get("education", []),
        "internships": short_data.get("internships", []),
        "projects": short_data.get("projects", []),
        "openSource": short_data.get("openSource", []),
        "skills": short_data.get("skills", []),
        "awards": short_data.get("awards", [])
    }
    
    return {"resume": data, "provider": body.provider}


@router.post("/resume/parse-section")
async def parse_section_text(body: SectionParseRequest):
    """AI 解析单个模块文本 → 结构化数据"""
    provider = body.provider or DEFAULT_AI_PROVIDER
    
    if provider == "mock":
        mock_data = {
            "contact": {"name": "张三", "phone": "138****8888", "email": "test@example.com", "location": "北京"},
            "education": [{"title": "示例大学", "subtitle": "本科", "major": "计算机科学", "date": "2020-2024"}],
            "experience": [{"title": "示例公司", "subtitle": "软件工程师", "date": "2023-至今", "highlights": ["负责后端开发"]}],
            "projects": [{"title": "示例项目", "subtitle": "负责人", "date": "2023", "highlights": ["项目描述"]}],
            "skills": [{"category": "编程语言", "details": "Java, Python"}],
            "awards": ["优秀学生"],
            "summary": "热爱技术的软件工程师",
            "opensource": [{"title": "开源项目", "subtitle": "贡献者", "items": ["提交PR"]}]
        }
        return {"data": mock_data.get(body.section_type, {}), "section_type": body.section_type, "provider": "mock"}
    
    section_prompt = SECTION_PROMPTS.get(body.section_type, '提取信息,输出JSON')
    
    prompt = f"""{section_prompt}
只输出JSON,不要markdown,不要解释。

文本内容:
{body.text}"""
    
    try:
        raw = call_llm(provider, prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {e}")
    
    cleaned = clean_llm_response(raw)
    
    try:
        data = parse_json_response(cleaned)
    except Exception:
        raise HTTPException(status_code=500, detail="AI 返回的内容无法解析为 JSON，请重试")
    
    if body.section_type == "summary" and isinstance(data, dict):
        data = data.get("summary", data)
    
    return {"data": data, "section_type": body.section_type, "provider": provider}


@router.post("/resume/rewrite")
async def rewrite_resume(body: RewriteRequest):
    """对简历 JSON 的某个路径进行 AI 改写"""
    try:
        parts = parse_path(body.path)
        parent, key, cur_value = get_by_path(body.resume, parts)
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
        updated = set_by_path(body.resume, parts, new_value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入失败：{e}")

    return {"resume": updated}


@router.post("/resume/rewrite/stream")
async def rewrite_resume_stream(body: RewriteRequest):
    """流式对简历 JSON 的某个路径进行 AI 改写"""
    try:
        parts = parse_path(body.path)
        parent, key, cur_value = get_by_path(body.resume, parts)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"路径错误：{e}")

    prompt = build_rewrite_prompt(body.path, cur_value, body.instruction, body.locale)
    
    async def generate():
        """生成 SSE 流"""
        try:
            for chunk in call_llm_stream(body.provider, prompt):
                """发送 SSE 格式数据"""
                yield f"data: {_json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {_json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/resume/format", response_model=FormatTextResponse)
async def format_resume_text_api(body: FormatTextRequest):
    """多层降级的简历文本格式化"""
    from format_helper import format_resume_text
    
    def ai_callback(text: str) -> Dict:
        from chunk_processor import split_resume_text, merge_resume_chunks
        
        if len(text) > 300:
            print(f"[分块处理] 文本长度 {len(text)}，开始分块...")
            chunks = split_resume_text(text, max_chunk_size=250)
            print(f"[分块处理] 分为 {len(chunks)} 块")
            
            chunks_results = []
            for i, chunk in enumerate(chunks):
                print(f"[分块处理] 处理第 {i+1}/{len(chunks)} 块: {chunk['section']}")
                
                chunk_prompt = f"""提取以下简历段落为JSON。只提取原文。

段落：{chunk['section']}

{chunk['content']}"""
                
                try:
                    raw = call_llm(body.provider, chunk_prompt)
                    cleaned = clean_llm_response(raw)
                    chunk_data = parse_json_response(cleaned)
                    chunks_results.append(chunk_data)
                    print(f"[分块处理] 第 {i+1} 块完成")
                except Exception as e:
                    print(f"[分块处理] 第 {i+1} 块失败: {e}")
                    continue
            
            merged_data = merge_resume_chunks(chunks_results)
            print(f"[分块处理] 合并完成，字段: {list(merged_data.keys())}")
            return merged_data
        
        print(f"[直接处理] 文本长度 {len(text)}")
        prompt = f"""提取简历信息JSON。规则：只提取原文，不添加，灵活识别字段。

{text}"""
        
        raw = call_llm(body.provider, prompt)
        cleaned = clean_llm_response(raw)
        return parse_json_response(cleaned)
    
    result = format_resume_text(
        text=body.text,
        use_ai=body.use_ai,
        ai_callback=ai_callback if body.use_ai else None
    )
    
    return FormatTextResponse(**result)
