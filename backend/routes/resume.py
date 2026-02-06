"""
简历相关路由
"""
import re
import json as _json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse

# 统一导入方式：优先使用绝对导入（backend.xxx），失败则使用相对导入
try:
    from backend.models import (
        ResumeGenerateRequest, ResumeGenerateResponse,
        ResumeParseRequest, SectionParseRequest,
        RewriteRequest, FormatTextRequest, FormatTextResponse
    )
    from backend.llm import call_llm, call_llm_stream, DEFAULT_AI_PROVIDER
    from backend.prompts import build_resume_prompt, build_resume_markdown_prompt, build_rewrite_prompt, SECTION_PROMPTS
    from backend.json_path import parse_path, get_by_path, set_by_path
    from backend.chunk_processor import split_resume_text, merge_resume_chunks
    from backend.parallel_chunk_processor import parse_resume_text_parallel
    from backend.config.parallel_config import get_parallel_config
    from backend.core.logger import get_logger, write_llm_debug
    from backend.services.pdf_parser import extract_markdown_from_pdf
    from backend.services.zhipu_layout import recognize_with_ocr
    from backend.services.resume_assembler import assemble_resume_data
except ImportError:
    # 确保 backend 目录在 sys.path 中
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    from models import (
        ResumeGenerateRequest, ResumeGenerateResponse,
        ResumeParseRequest, SectionParseRequest,
        RewriteRequest, FormatTextRequest, FormatTextResponse
    )
    from llm import call_llm, call_llm_stream, DEFAULT_AI_PROVIDER
    from prompts import build_resume_prompt, build_resume_markdown_prompt, build_rewrite_prompt, SECTION_PROMPTS
    from json_path import parse_path, get_by_path, set_by_path
    from chunk_processor import split_resume_text, merge_resume_chunks
    from parallel_chunk_processor import parse_resume_text_parallel
    from config.parallel_config import get_parallel_config
    from core.logger import get_logger, write_llm_debug
    from services.pdf_parser import extract_markdown_from_pdf
    from services.zhipu_layout import recognize_with_ocr
    from services.resume_assembler import assemble_resume_data

logger = get_logger(__name__)
router = APIRouter(prefix="/api", tags=["Resume"])

ROOT = Path(__file__).resolve().parents[2]
MAX_PDF_SIZE_MB = 10


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


@router.post("/resume/generate/stream")
async def generate_resume_stream(body: ResumeGenerateRequest):
    """流式生成简历 - 输出 Markdown 格式，最后返回 JSON"""
    import asyncio

    # 生成 Markdown 的提示词
    markdown_prompt = build_resume_markdown_prompt(body.instruction, body.locale)

    # 生成 JSON 的提示词（用于最后返回结构化数据）
    json_prompt = build_resume_prompt(body.instruction, body.locale)

    async def generate():
        """生成 SSE 流"""
        full_markdown = ""

        try:
            # 流式输出 Markdown
            for chunk in call_llm_stream(body.provider, markdown_prompt):
                full_markdown += chunk
                yield f"data: {_json.dumps({'type': 'markdown', 'content': chunk}, ensure_ascii=False)}\n\n"
                # 关键：让出控制权，强制 uvicorn 立即发送数据
                await asyncio.sleep(0)
            
            # Markdown 输出完成，开始生成 JSON
            yield f"data: {_json.dumps({'type': 'status', 'content': 'parsing'}, ensure_ascii=False)}\n\n"
            
            # 调用 LLM 生成 JSON
            raw_json = call_llm(body.provider, json_prompt)
            cleaned = clean_llm_response(raw_json)
            
            # 修复常见的 JSON 格式错误
            import re
            cleaned = re.sub(r'\]\}\s*,\s*"', ']}}, "', cleaned)
            cleaned = re.sub(r'\]\}\s*,\s*(["\}])', r']} \1', cleaned)
            cleaned = re.sub(r'\]\s*,\s*(["\}])', r'] \1', cleaned)
            cleaned = re.sub(r'\]\s+""([a-zA-Z_]+)"', r'], "\1"', cleaned)
            cleaned = re.sub(r'\]\s+"([a-zA-Z_]+)"\s*:', r'], "\1":', cleaned)
            cleaned = re.sub(r'\]\}\s+"([a-zA-Z_]+)"\s*:', r']}, "\1":', cleaned)
            
            resume_data = parse_json_response(cleaned)
            
            # 发送完整的 JSON 数据
            yield f"data: {_json.dumps({'type': 'json', 'content': resume_data}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            yield f"data: {_json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/resume/parse")
async def parse_resume_text(body: ResumeParseRequest):
    """AI 解析简历文本 → 结构化简历 JSON（支持并行分块处理）"""
    # 使用 print 和 logger 双重记录，确保能看到日志
    print("========== 收到解析请求 ==========", file=sys.stderr, flush=True)
    print(f"文本长度: {len(body.text)} 字符", file=sys.stderr, flush=True)
    logger.info("========== 收到解析请求 ==========")
    logger.info(f"文本长度: {len(body.text)} 字符")

    provider = body.provider or DEFAULT_AI_PROVIDER
    print(f"Provider: {provider}", file=sys.stderr, flush=True)
    logger.info(f"Provider: {provider}")

    # 获取并行处理配置
    config = get_parallel_config(provider)
    use_parallel = getattr(body, 'use_parallel', config.get('enabled', True))
    print(f"use_parallel: {use_parallel}, enabled: {config.get('enabled')}", file=sys.stderr, flush=True)
    logger.info(f"use_parallel: {use_parallel}, enabled: {config.get('enabled')}")

    chunk_threshold = config.get("chunk_threshold", 500)
    print(f"chunk_threshold: {chunk_threshold}, text_length: {len(body.text)}", file=sys.stderr, flush=True)
    if use_parallel and len(body.text) > chunk_threshold:
        print("========== 并行处理开始 ==========", file=sys.stderr, flush=True)
        print(f"文本长度: {len(body.text)} 字符", file=sys.stderr, flush=True)
        print(f"阈值: {chunk_threshold} 字符", file=sys.stderr, flush=True)
        print(f"配置: max_concurrent={config.get('max_concurrent')}, max_chunk_size={config.get('max_chunk_size')}", file=sys.stderr, flush=True)
        logger.info("========== 并行处理开始 ==========")
        logger.info(f"文本长度: {len(body.text)} 字符")
        logger.info(f"阈值: {chunk_threshold} 字符")
        logger.info(f"配置: max_concurrent={config.get('max_concurrent')}, max_chunk_size={config.get('max_chunk_size')}")
        import time
        parallel_start = time.time()
        try:
            # 使用异步并行处理
            short_data = await parse_resume_text_parallel(
                text=body.text,
                provider=provider,
                max_concurrent=config.get("max_concurrent"),
                max_chunk_size=config.get("max_chunk_size", 300),
                model=getattr(body, 'model', None)
            )
            parallel_elapsed = time.time() - parallel_start
            logger.info(f"✅ 并行处理成功！总耗时: {parallel_elapsed:.2f}秒")
            logger.info("========== 并行处理结束 ==========")
        except Exception as e:
            import traceback
            parallel_elapsed = time.time() - parallel_start
            logger.error(f"❌ 并行处理失败，耗时: {parallel_elapsed:.2f}秒")
            logger.error(f"错误信息: {str(e)}")
            logger.error(f"错误详情:\n{traceback.format_exc()}")
            logger.warning("回退到串行模式...")
            # 回退到原有的串行处理
            result = await _parse_resume_serial(body)
            if isinstance(result, dict) and "resume" in result:
                return result
            else:
                # 处理标准化数据格式
                normalized_data = result.get("data", result)
                data = {
                    "name": normalized_data.get("name", ""),
                    "contact": normalized_data.get("contact", {"phone": "", "email": ""}),
                    "objective": normalized_data.get("objective", ""),
                    "education": normalized_data.get("education", []),
                    "internships": normalized_data.get("internships", []),
                    "projects": normalized_data.get("projects", []),
                    "openSource": normalized_data.get("openSource", []),
                    "skills": normalized_data.get("skills", []),
                    "awards": normalized_data.get("awards", [])
                }
                return {"resume": data, "provider": provider}
    else:
        # 短文本或禁用并行时，使用原有的处理方式
        if len(body.text) > config.get("chunk_threshold", 500):
            logger.info(f"文本长度 {len(body.text)}，使用串行分块处理")
        result = await _parse_resume_serial(body)
        if isinstance(result, dict) and "resume" in result:
            return result
        else:
            # 处理标准化数据格式
            normalized_data = result.get("data", result)
            data = {
                "name": normalized_data.get("name", ""),
                "contact": normalized_data.get("contact", {"phone": "", "email": ""}),
                "objective": normalized_data.get("objective", ""),
                "education": normalized_data.get("education", []),
                "internships": normalized_data.get("internships", []),
                "projects": normalized_data.get("projects", []),
                "openSource": normalized_data.get("openSource", []),
                "skills": normalized_data.get("skills", []),
                "awards": normalized_data.get("awards", [])
            }
            return {"resume": data, "provider": provider}

    # 额外的数据清理和标准化
    try:
        from json_normalizer import normalize_resume_json
        normalized_data = normalize_resume_json(short_data)
    except Exception as e:
        print(f"[解析] 数据标准化失败: {e}", file=sys.stderr, flush=True)
        normalized_data = short_data

    # 统一返回格式：与串行处理保持一致
    data = {
        "name": normalized_data.get("name", ""),
        "contact": normalized_data.get("contact", {"phone": "", "email": ""}),
        "objective": normalized_data.get("objective", ""),
        "education": normalized_data.get("education", []),
        "internships": normalized_data.get("internships", []),
        "projects": normalized_data.get("projects", []),
        "openSource": normalized_data.get("openSource", []),
        "skills": normalized_data.get("skills", []),
        "awards": normalized_data.get("awards", [])
    }
    return {"resume": data, "provider": provider}


@router.post("/resume/upload-pdf")
async def upload_resume_pdf(
    file: UploadFile = File(...),
    model: Optional[str] = Form(default=None),
    provider: Optional[str] = Form(default=None)
):
    """
    上传 PDF 简历并解析为结构化简历 JSON
    混合增强策略：MinerU + glm-ocr + DeepSeek
    
    数据流：
    1. MinerU：PDF → Markdown（基础文本结构）
    2. glm-ocr：PDF → Markdown（高质量 OCR + 结构识别）
    3. DeepSeek：融合两路数据 → 结构化 JSON
    
    说明：glm-ocr 的 Markdown 输出已包含完整的结构信息（标题层级、列表格式、嵌套结构），
    无需 glm-4.6v 额外提供布局骨架。
    """
    import asyncio
    import time
    from concurrent.futures import ThreadPoolExecutor
    
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="文件为空")

    if len(pdf_bytes) > MAX_PDF_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"文件过大，最大支持 {MAX_PDF_SIZE_MB}MB")

    total_start = time.time()
    
    # ========== 步骤1: 并行执行两路数据提取 ==========
    # 1) MinerU 文本提取（快速，~2秒）
    # 2) glm-ocr 直接解析 PDF（高质量，~4秒）
    print(f"[PDF解析] 开始混合增强处理...", flush=True)
    step1_start = time.time()
    
    loop = asyncio.get_event_loop()
    markdown_text = ""
    ocr_text = ""
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        # 并行任务: MinerU + OCR
        text_future = loop.run_in_executor(executor, extract_markdown_from_pdf, pdf_bytes, True)
        ocr_future = loop.run_in_executor(executor, recognize_with_ocr, pdf_bytes)
        
        # MinerU（必须成功）
        try:
            markdown_text = await text_future
            print(f"[PDF解析] MinerU 成功，文本长度: {len(markdown_text)}", flush=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF 预处理失败: {e}")
        
        # OCR（可选，失败不阻塞流程，因为 MinerU 已提供基础文本）
        try:
            ocr_text = await ocr_future
            print(f"[PDF解析] glm-ocr 成功，文本长度: {len(ocr_text)}", flush=True)
        except Exception as e:
            print(f"[PDF解析] glm-ocr 失败（不影响流程，使用 MinerU 文本）: {e}", flush=True)
            ocr_text = ""
    
    step1_time = time.time() - step1_start
    print(f"[PDF解析] 步骤1 完成 (MinerU+OCR 并行): {step1_time:.2f}s", flush=True)

    # ========== 步骤2: DeepSeek 融合组装 ==========
    # DeepSeek 根据文本内容自行判断模块划分和格式特征
    step2_start = time.time()
    try:
        resume_data = assemble_resume_data(
            raw_text=markdown_text,
            layout={},  # 不再使用布局骨架，DeepSeek 从文本推断结构
            ocr_text=ocr_text,
            model=model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"简历结构化失败: {e}")
    step2_time = time.time() - step2_start
    print(f"[PDF解析] 步骤2 完成 (DeepSeek 融合组装): {step2_time:.2f}s", flush=True)
    
    total_time = time.time() - total_start
    print(f"[PDF解析] 总耗时: {total_time:.2f}s (数据提取: {step1_time:.2f}s, 组装: {step2_time:.2f}s)", flush=True)
    print(f"[PDF解析] 数据源: MinerU={len(markdown_text)}字符, OCR={len(ocr_text)}字符", flush=True)

    try:
        from backend.json_normalizer import normalize_resume_json
    except ImportError:
        from json_normalizer import normalize_resume_json

    try:
        normalized = normalize_resume_json(resume_data)
        return {"resume": normalized, "provider": "hybrid"}
    except Exception as e:
        logger.warning(f"JSON 标准化失败: {e}")
        return {"resume": resume_data, "provider": "hybrid"}


async def _parse_resume_serial(body: ResumeParseRequest):
    """串行解析简历文本（原有逻辑）"""
    provider = body.provider or DEFAULT_AI_PROVIDER
    model = getattr(body, 'model', None)

    # 格式定义
    schema_desc = """格式:{"name":"姓名","contact":{"phone":"电话","email":"邮箱"},"objective":"求职意向","education":[{"title":"学校","subtitle":"专业","degree":"学位(本科/硕士/博士)","date":"时间","details":["荣誉"]}],"internships":[{"title":"公司","subtitle":"职位","date":"时间","highlights":["工作内容"]}],"projects":[{"title":"项目名","subtitle":"角色","date":"时间","description":"项目描述(可选)","highlights":["描述"]}],"openSource":[{"title":"开源项目","subtitle":"角色/描述","date":"时间(格式: 2023.01-2023.12 或 2023.01-至今)","items":["贡献描述"],"repoUrl":"仓库链接"}],"skills":[{"category":"类别","details":"技能描述"}],"awards":["奖项"]}

重要说明：
1. 技能描述：如果原文中技能描述部分有多行，每行以"-"开头，应该将每一行作为一个独立的技能项，格式为{"category":"","details":"该行的完整内容(去掉开头的破折号)"}
2. 项目经历（极其重要，必须严格遵守）：
   - 只有"### xxx"或"## xxx"开头的才是项目标题，如"### RAG知识库助手"是项目名
   - 项目描述段落（从项目标题后、技术栈前的完整段落）必须放入"description"字段
   - 技术栈信息（如"技术栈：SpringBoot MySQL..."）应该附加到 description 字段末尾
   - "- **标题**：描述"格式是项目的功能亮点，必须放入该项目的"highlights"数组，绝不能作为独立项目！
   - highlights数组中的每一项应该保持原文格式，包括加粗标记
   - 如果只看到功能亮点（"- **xxx**：描述"）而没有项目标题，将这些放入highlights数组，title留空，系统会自动合并"""

    # 如果文本过长，使用分块处理
    if len(body.text) > 800:
        print(f"[解析] 文本长度 {len(body.text)}，启用分块处理")
        chunks = split_resume_text(body.text, max_chunk_size=300)
        chunks_results = []

        for i, chunk in enumerate(chunks):
            logger.info(f"处理第 {i+1}/{len(chunks)} 块: {chunk['section']}")
            chunk_prompt = f"""从简历文本片段提取信息,只输出JSON(不要markdown,无数据的字段用空数组[]):

解析规则：
1. 技能描述：如果有多行以"-"开头的技能描述，每行应该作为一个独立的技能项，格式为{{"category":"","details":"该行的完整内容(去掉开头的破折号)"}}
2. 项目经历（极其重要，必须严格遵守）：
   - 只有"### xxx"或"## xxx"开头的才是项目标题
   - 项目描述段落（从项目标题后、第一个"- **"之前的完整段落）放入"description"字段
   - 技术栈信息（如"技术栈：SpringBoot MySQL..."）附加到 description 字段末尾
   - 以"- **标题**：描述"格式开头的行是项目的功能亮点，每行一个，放入该项目的"highlights"字符串数组
   - highlights数组中的每一项保持原格式，包括**加粗标记**
   - 绝对不要把功能亮点合并到description中！

正确示例：
输入文本：
### RAG 知识库助手
基于私有知识库的 RAG 对话平台。
技术栈：SpringBoot MySQL Redis

- **上下文截断**：解决截断问题
- **文档解析**：多格式解析

输出：
{{
  "projects": [
    {{
      "title": "RAG 知识库助手",
      "description": "基于私有知识库的 RAG 对话平台。技术栈：SpringBoot MySQL Redis",
      "highlights": [
        "**上下文截断**：解决截断问题",
        "**文档解析**：多格式解析"
      ]
    }}
  ]
}}

注意：highlights数组中每项不要开头的"- "符号，前端会用无序列表渲染！

片段内容({chunk['section']}):
{chunk['content']}
{schema_desc}"""
            try:
                raw = call_llm(provider, chunk_prompt, model=model)
            except Exception as e:
                logger.warning(f"分块 {i+1} 解析失败: {e}")
                write_llm_debug(f"Chunk {i+1} Error: {e}")
                continue

            cleaned = clean_llm_response(raw)

            try:
                chunk_data = parse_json_response(cleaned)
                chunks_results.append(chunk_data)
                logger.info(f"分块 {i+1} 解析成功")
            except Exception as e:
                logger.warning(f"分块 {i+1} JSON 解析失败: {e}")
                write_llm_debug(f"Chunk {i+1} Raw: {raw}")
                continue

        short_data = merge_resume_chunks(chunks_results)
        print("[解析] 分块合并完成")

    else:
        # 短文本直接处理
        prompt = f"""从简历文本提取信息,只输出JSON(不要markdown,无数据的字段用空数组[]):

解析规则：
1. 技能描述：如果有多行以"-"开头的技能描述，每行应该作为一个独立的技能项，格式为{{"category":"","details":"该行的完整内容(去掉开头的破折号)"}}
2. 项目经历（极其重要，必须严格遵守）：
   - 只有"### xxx"或"## xxx"开头的才是项目标题
   - 项目描述段落（从项目标题后、第一个"- **"之前的完整段落）放入"description"字段
   - 技术栈信息（如"技术栈：SpringBoot MySQL..."）附加到 description 字段末尾
   - 以"- **标题**：描述"格式开头的行是项目的功能亮点，每行一个，放入该项目的"highlights"字符串数组
   - highlights数组中的每一项保持原格式，包括**加粗标记**
   - 绝对不要把功能亮点合并到description中！

正确示例：
输入文本：
### RAG 知识库助手
基于私有知识库的 RAG 对话平台。
技术栈：SpringBoot MySQL Redis

- **上下文截断**：解决截断问题
- **文档解析**：多格式解析

输出：
{{
  "projects": [
    {{
      "title": "RAG 知识库助手",
      "description": "基于私有知识库的 RAG 对话平台。技术栈：SpringBoot MySQL Redis",
      "highlights": [
        "**上下文截断**：解决截断问题",
        "**文档解析**：多格式解析"
      ]
    }}
  ]
}}

注意：highlights数组中每项不要开头的"- "符号，前端会用无序列表渲染！

简历文本:
{body.text}
{schema_desc}"""

        try:
            raw = call_llm(provider, prompt, model=model)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM 调用失败: {e}")

        cleaned = clean_llm_response(raw)

        try:
            short_data = parse_json_response(cleaned)
        except Exception as e:
            logger.error(f"JSON 解析失败: {e}")
            write_llm_debug(f"Raw Response:\n{raw}")

            raise HTTPException(status_code=500, detail="AI 返回的内容无法解析为 JSON，请重试")

    # 额外的数据清理和标准化
    try:
        from json_normalizer import normalize_resume_json
        normalized_data = normalize_resume_json(short_data)
        return {"success": True, "data": normalized_data}
    except Exception as e:
        print(f"[解析] 数据标准化失败: {e}")
        # 返回原始数据
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
        return {"resume": data, "provider": provider}


@router.post("/resume/parse-section")
async def parse_section_text(body: SectionParseRequest):
    """AI 解析单个模块文本 → 结构化数据"""
    provider = body.provider or DEFAULT_AI_PROVIDER
    model = body.model  # 获取用户指定的模型

    section_prompt = SECTION_PROMPTS.get(body.section_type, '提取信息,输出JSON')

    prompt = f"""{section_prompt}
只输出JSON,不要markdown,不要解释。

文本内容:
{body.text}"""

    try:
        raw = call_llm(provider, prompt, model=model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {e}")

    cleaned = clean_llm_response(raw)

    try:
        data = parse_json_response(cleaned)
    except Exception:
        raise HTTPException(status_code=500, detail="AI 返回的内容无法解析为 JSON，请重试")

    if body.section_type == "summary" and isinstance(data, dict):
        data = data.get("summary", data)

    return {"data": data, "section_type": body.section_type, "provider": provider, "model": model}


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

    # 默认使用 deepseek（如果未指定 provider）
    provider = body.provider or DEFAULT_AI_PROVIDER
    
    prompt = build_rewrite_prompt(body.path, cur_value, body.instruction, body.locale)
    
    async def generate():
        """生成 SSE 流"""
        try:
            for chunk in call_llm_stream(provider, prompt):
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
