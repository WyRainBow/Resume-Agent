"""
日志管理模块
提供统一的日志记录功能，支持按类型和日期归档
"""
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from logging.handlers import TimedRotatingFileHandler


# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"

# 日志目录
LOG_DIRS = {
    "frontend": LOGS_DIR / "frontend",
    "backend": LOGS_DIR / "backend",
    "latex": LOGS_DIR / "latex",
    "other": LOGS_DIR / "other",
}


def ensure_log_dirs():
    """确保所有日志目录存在"""
    for dir_path in LOG_DIRS.values():
        dir_path.mkdir(parents=True, exist_ok=True)


def get_log_path(category: str, filename: Optional[str] = None) -> Path:
    """
    获取日志文件路径
    
    参数:
        category: 日志类别 (frontend/backend/latex/other)
        filename: 文件名，默认使用当天日期
    
    返回:
        日志文件完整路径
    """
    ensure_log_dirs()
    
    log_dir = LOG_DIRS.get(category, LOG_DIRS["other"])
    
    if filename is None:
        # 默认使用当天日期作为文件名
        filename = f"{datetime.now().strftime('%Y-%m-%d')}.log"
    
    return log_dir / filename


def get_logger(
    name: str,
    category: str = "backend",
    level: int = logging.INFO,
    console_output: bool = True
) -> logging.Logger:
    """
    获取配置好的 logger 实例
    
    参数:
        name: logger 名称
        category: 日志类别 (frontend/backend/latex/other)
        level: 日志级别
        console_output: 是否输出到控制台
    
    返回:
        配置好的 Logger 实例
    """
    ensure_log_dirs()
    
    logger = logging.getLogger(name)
    
    # 避免重复添加 handler
    if logger.handlers:
        return logger
    
    logger.setLevel(level)
    logger.propagate = False  # 避免日志传播到父 logger 导致重复
    
    # 日志格式
    formatter = logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # 文件 handler - 按天轮转
    log_dir = LOG_DIRS.get(category, LOG_DIRS["other"])
    log_file = log_dir / f"{datetime.now().strftime('%Y-%m-%d')}.log"
    
    file_handler = TimedRotatingFileHandler(
        filename=str(log_file),
        when="midnight",
        interval=1,
        backupCount=30,  # 保留30天的日志
        encoding="utf-8"
    )
    file_handler.suffix = "%Y-%m-%d.log"
    file_handler.setFormatter(formatter)
    file_handler.setLevel(level)
    logger.addHandler(file_handler)
    
    # 控制台 handler（可选）
    if console_output:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(level)
        logger.addHandler(console_handler)
    
    return logger


def write_debug_log(category: str, content: str, filename: Optional[str] = None):
    """
    写入调试日志（直接写文件，用于保存原始内容）
    
    参数:
        category: 日志类别 (frontend/backend/latex/other)
        content: 日志内容
        filename: 文件名，默认使用当天日期
    """
    log_path = get_log_path(category, filename)
    
    with open(log_path, "a", encoding="utf-8") as f:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"\n{'='*60}\n")
        f.write(f"[{timestamp}]\n")
        f.write(f"{'='*60}\n")
        f.write(content)
        f.write("\n")


def write_latex_debug(latex_content: str, error_msg: str = ""):
    """
    写入 LaTeX 调试日志
    
    参数:
        latex_content: LaTeX 源码
        error_msg: 错误信息
    """
    content = ""
    if error_msg:
        content += f"Error:\n{error_msg}\n\n"
    content += f"LaTeX Source:\n{latex_content}"
    
    write_debug_log("latex", content, f"latex_debug_{datetime.now().strftime('%Y-%m-%d')}.log")


def write_llm_debug(raw_response: str, cleaned_response: str = ""):
    """
    写入 LLM 调试日志
    
    参数:
        raw_response: LLM 原始响应
        cleaned_response: 清理后的响应
    """
    content = f"Raw Response:\n{raw_response}"
    if cleaned_response:
        content += f"\n\nCleaned Response:\n{cleaned_response}"
    
    write_debug_log("backend", content, f"llm_debug_{datetime.now().strftime('%Y-%m-%d')}.log")


# 预创建常用 logger
backend_logger = get_logger("backend", "backend")
latex_logger = get_logger("latex", "latex")


# 迁移旧日志文件
def migrate_old_logs():
    """将旧的日志文件迁移到新的目录结构"""
    old_logs = [
        (PROJECT_ROOT / "frontend_server.log", "frontend"),
        (PROJECT_ROOT / "frontend" / "frontend_server.log", "frontend"),
        (PROJECT_ROOT / "backend" / "latex_debug.log", "latex"),
        (PROJECT_ROOT / "backend" / "llm_debug.log", "backend"),
        (PROJECT_ROOT / "backend_server.log", "backend"),
    ]
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    for old_path, category in old_logs:
        if old_path.exists():
            new_path = get_log_path(category, f"migrated_{today}_{old_path.name}")
            try:
                import shutil
                shutil.move(str(old_path), str(new_path))
                print(f"[日志迁移] {old_path} -> {new_path}")
            except Exception as e:
                print(f"[日志迁移失败] {old_path}: {e}")


if __name__ == "__main__":
    # 测试日志系统
    print("测试日志系统...")
    
    # 迁移旧日志
    migrate_old_logs()
    
    # 测试写入
    backend_logger.info("后端日志测试")
    latex_logger.info("LaTeX 日志测试")
    write_debug_log("other", "其他日志测试")
    
    print(f"日志目录: {LOGS_DIR}")
    print("日志系统测试完成！")
