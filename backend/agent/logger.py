import sys
from datetime import datetime
from pathlib import Path

from loguru import logger as _logger

from backend.agent.config import PROJECT_ROOT


_print_level = "INFO"


def define_log_level(print_level="INFO", logfile_level="DEBUG", name: str = None):
    """Adjust the log level to above level"""
    global _print_level
    _print_level = print_level

    # 使用日期格式的日志文件名：YYYYMMDD-backend.log
    current_date = datetime.now()
    formatted_date = current_date.strftime("%Y%m%d")
    log_name = f"{formatted_date}-backend.log"

    # 确保 logs/backend 目录存在
    log_dir = PROJECT_ROOT / "logs" / "backend"
    log_dir.mkdir(parents=True, exist_ok=True)

    _logger.remove()
    _logger.add(sys.stderr, level=print_level)
    _logger.add(
        log_dir / log_name,
        level=logfile_level,
        rotation="00:00",  # 每天午夜分割日志
        retention="30 days",  # 保留30天的日志
        compression="zip",  # 压缩旧日志
        encoding="utf-8"
    )
    return _logger


logger = define_log_level()


if __name__ == "__main__":
    logger.info("Starting application")
    logger.debug("Debug message")
    logger.warning("Warning message")
    logger.error("Error message")
    logger.critical("Critical message")

    try:
        raise ValueError("Test error")
    except Exception as e:
        logger.exception(f"An error occurred: {e}")
