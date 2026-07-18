#!/usr/bin/env python3
"""创建数据库表"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import init_db, DATABASE_URL
# 必须先导入 models 让全部 ORM 表注册进 Base.metadata——否则 create_all 无表可建、
# 脚本静默 no-op（2026-07-17 身份统一 bootstrap 演练时发现的既有缺陷）。
import backend.models  # noqa: F401

print(f"当前数据库: {DATABASE_URL}")
print("正在创建表...")

try:
    init_db()
    print("[成功] 表创建完成")
except Exception as e:
    print(f"[错误] 创建表失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
