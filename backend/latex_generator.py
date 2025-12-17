"""
LaTeX 简历生成模块
将简历 JSON 转换为 LaTeX 代码，并编译为 PDF
"""
import os
import subprocess
import tempfile
import shutil
import time
import hashlib
import json
from pathlib import Path
from typing import Dict, Any, List
from io import BytesIO

from .latex_utils import escape_latex, normalize_resume_data
from .latex_sections import SECTION_GENERATORS, DEFAULT_SECTION_ORDER


def json_to_latex(resume_data: Dict[str, Any], section_order: List[str] = None) -> str:
    """
    将简历 JSON 转换为 LaTeX 代码
    支持中文和英文字段名，支持自定义 section 顺序
    
    参数:
        resume_data: 简历数据字典（中文或英文字段名）
        section_order: 自定义 section 顺序列表
    
    返回:
        LaTeX 代码字符串
    """
    """标准化 JSON：先尝试通用方法，失败则降级到固定映射"""
    try:
        from backend.json_normalizer import normalize_resume_json
        resume_data = normalize_resume_json(resume_data)
        print("[通用标准化] 成功")
    except Exception as e:
        print(f"[通用标准化] 失败: {e}，降级到固定映射")
        resume_data = normalize_resume_data(resume_data)
    
    """获取 LaTeX 模板目录路径"""
    current_dir = Path(__file__).resolve().parent
    root_dir = current_dir.parent
    latex_template_dir = root_dir / "LATEX-slager"
    
    """构建 LaTeX 文档"""
    latex_content = []
    
    """文档头部"""
    latex_content.append(r"% !TEX TS-program = xelatex")
    latex_content.append(r"% !TEX encoding = UTF-8 Unicode")
    latex_content.append(r'% !Mode:: "TeX:UTF-8"')
    latex_content.append("")
    latex_content.append(r"\documentclass{resume}")
    """使用中文字体配置"""
    latex_content.append(r"\usepackage{zh_CN-Adobefonts_external}")
    latex_content.append(r"\usepackage{linespacing_fix}")
    latex_content.append(r"\usepackage{cite}")
    """确保中文字体正确加载和 Unicode 支持"""
    latex_content.append(r'\XeTeXlinebreaklocale "zh"')
    latex_content.append(r"\XeTeXlinebreakskip = 0pt plus 1pt")
    """强制使用 Unicode 编码"""
    latex_content.append(r'\XeTeXinputencoding "utf8"')
    latex_content.append("")
    latex_content.append(r"\begin{document}")
    latex_content.append(r"\pagenumbering{gobble}")
    latex_content.append("")
    
    """姓名"""
    name = resume_data.get('name') or '姓名'
    latex_content.append(f"\\name{{{escape_latex(name)}}}")
    latex_content.append("")
    
    """联系信息"""
    contact = resume_data.get('contact') or {}
    phone = escape_latex(contact.get('phone') or '')
    email = escape_latex(contact.get('email') or '')
    """求职意向：优先从 objective 获取，其次从 contact.role 获取"""
    role = escape_latex(resume_data.get('objective') or contact.get('role') or '')
    
    """contactInfo 格式: {phone}{email}{role} - 与 slager.link 保持一致"""
    latex_content.append(f"\\contactInfo{{{phone}}}{{{email}}}{{{role}}}")
    latex_content.append("")
    
    """获取自定义模块标题"""
    section_titles = resume_data.get('sectionTitles') or {}
    
    """按顺序生成各 section"""
    order = section_order if section_order else DEFAULT_SECTION_ORDER
    print(f"[DEBUG] section_order received: {section_order}")
    print(f"[DEBUG] using order: {order}")
    for section_id in order:
        generator = SECTION_GENERATORS.get(section_id)
        if generator:
            latex_content.extend(generator(resume_data, section_titles))
    
    """文档结尾"""
    latex_content.append(r"\end{document}")
    
    return "\n".join(latex_content)


def compile_latex_to_pdf(latex_content: str, template_dir: Path) -> BytesIO:
    """
    编译 LaTeX 代码为 PDF（简化版本）

    参数:
        latex_content: LaTeX 代码字符串
        template_dir: LaTeX 模板目录（包含 resume.cls 等文件）

    返回:
        PDF 文件的 BytesIO 对象
    """
    """创建临时目录"""
    temp_dir = tempfile.mkdtemp()

    try:
        # 复制所有必要的模板文件
        template_files = [
            'resume.cls', 'fontawesome.sty', 'linespacing_fix.sty',
            'zh_CN-Adobefonts_external.sty', 'zh_CN-Adobefonts_internal.sty'
        ]
        for file_name in template_files:
            src_file = template_dir / file_name
            if src_file.exists():
                dest_file = Path(temp_dir) / file_name
                shutil.copy2(src_file, dest_file)
                print(f"[调试] 复制文件: {file_name} -> {dest_file}")
            else:
                print(f"[警告] 文件不存在: {file_name}")

        # 复制字体目录（如果存在）
        fonts_dir = template_dir / 'fonts'
        if fonts_dir.exists():
            shutil.copytree(fonts_dir, Path(temp_dir) / 'fonts', dirs_exist_ok=True)

        # 写入 LaTeX 文件
        tex_file = Path(temp_dir) / 'resume.tex'
        tex_file.write_text(latex_content, encoding='utf-8')

        # 使用 xelatex 编译
        compile_cmd = [
            'xelatex',
            '-interaction=nonstopmode',
            '-output-directory', temp_dir,
            str(tex_file)
        ]

        # 只编译一次，简化逻辑
        result = subprocess.run(
            compile_cmd,
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout
            print(f"LaTeX 编译失败: {error_msg[:500]}")
            raise RuntimeError(f"LaTeX 编译失败: {error_msg[:200]}")

        """读取生成的 PDF"""
        pdf_file = Path(temp_dir) / 'resume.pdf'
        if not pdf_file.exists():
            raise RuntimeError("PDF 文件未生成")

        # 读取 PDF
        pdf_bytes = pdf_file.read_bytes()
        print(f"PDF 生成成功，大小: {len(pdf_bytes)} 字节")

        pdf_io = BytesIO(pdf_bytes)
        pdf_io.seek(0)

        return pdf_io

    finally:
        """清理临时目录"""
        shutil.rmtree(temp_dir, ignore_errors=True)


"""
PDF 缓存（内存缓存，最多保留 50 个）
"""
_pdf_cache: Dict[str, bytes] = {}
_pdf_cache_order: List[str] = []
_PDF_CACHE_MAX_SIZE = 50


def _get_cache_key(resume_data: Dict[str, Any], section_order: List[str] = None) -> str:
    """生成缓存键"""
    content = json.dumps(resume_data, sort_keys=True, ensure_ascii=False) + str(section_order or [])
    return hashlib.md5(content.encode()).hexdigest()


def render_pdf_from_resume_latex(resume_data: Dict[str, Any], section_order: List[str] = None) -> BytesIO:
    """
    将简历 JSON 渲染为 PDF（使用 LaTeX）
    支持内容缓存，相同内容直接返回缓存
    
    参数:
        resume_data: 简历数据字典
        section_order: 自定义 section 顺序列表
    
    返回:
        PDF 文件的 BytesIO 对象
    """
    total_start = time.time()
    
    """检查缓存"""
    cache_key = _get_cache_key(resume_data, section_order)
    if cache_key in _pdf_cache:
        cache_time = time.time() - total_start
        print(f"[性能] 缓存命中! 耗时: {cache_time*1000:.0f}ms")
        return BytesIO(_pdf_cache[cache_key])
    
    """获取模板目录"""
    current_dir = Path(__file__).resolve().parent
    root_dir = current_dir.parent
    template_dir = root_dir / "LATEX-slager"
    
    if not template_dir.exists():
        raise RuntimeError(f"LaTeX 模板目录不存在: {template_dir}")
    
    """转换为 LaTeX"""
    latex_start = time.time()
    latex_content = json_to_latex(resume_data, section_order)
    latex_time = time.time() - latex_start
    print(f"[性能] JSON 转 LaTeX: {latex_time*1000:.0f}ms")
    
    """编译为 PDF"""
    compile_start = time.time()
    pdf_io = compile_latex_to_pdf(latex_content, template_dir)
    compile_time = time.time() - compile_start
    print(f"[性能] LaTeX 编译 PDF: {compile_time*1000:.0f}ms")
    
    """写入缓存"""
    pdf_bytes = pdf_io.getvalue()
    if len(_pdf_cache) >= _PDF_CACHE_MAX_SIZE:
        """删除最旧的缓存"""
        oldest_key = _pdf_cache_order.pop(0)
        _pdf_cache.pop(oldest_key, None)
    _pdf_cache[cache_key] = pdf_bytes
    _pdf_cache_order.append(cache_key)
    print(f"[性能] 已缓存 PDF (缓存数: {len(_pdf_cache)})")
    
    total_time = time.time() - total_start
    print(f"[性能] PDF 生成总耗时: {total_time*1000:.0f}ms")
    
    return pdf_io
