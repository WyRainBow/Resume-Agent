#!/usr/bin/env python3
"""
查看 SQLite 数据库内容的工具
"""
import sqlite3
from pathlib import Path
from datetime import datetime
import json

PROJECT_ROOT = Path(__file__).resolve().parent.parent
db_path = PROJECT_ROOT / "backend" / "resume.db"

if not db_path.exists():
    print(f"[错误] 数据库文件不存在: {db_path}")
    exit(1)

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row  # 使用 Row 对象，可以通过列名访问
cursor = conn.cursor()

print("=" * 70)
print("SQLite 数据库查看工具")
print("=" * 70)
print(f"\n数据库文件: {db_path}")
print(f"文件大小: {db_path.stat().st_size} 字节")

# 获取所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print(f"\n表数量: {len(tables)}")
print("\n表列表:")
for i, table in enumerate(tables, 1):
    table_name = table[0]
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"  {i}. {table_name} ({count} 条记录)")

# 查看每个表的数据
print("\n" + "=" * 70)
print("数据详情")
print("=" * 70)

for table in tables:
    table_name = table[0]
    print(f"\n表: {table_name}")
    print("-" * 70)
    
    # 获取表结构
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    col_names = [col[1] for col in columns]
    
    # 获取数据
    cursor.execute(f"SELECT * FROM {table_name} LIMIT 10")
    rows = cursor.fetchall()
    
    if not rows:
        print("  (空表)")
        continue
    
    # 打印表头
    header = " | ".join([f"{name:<15}" for name in col_names])
    print(f"  {header}")
    print("  " + "-" * len(header))
    
    # 打印数据
    for row in rows:
        values = []
        for col_name in col_names:
            value = row[col_name]
            if value is None:
                values.append(f"{'NULL':<15}")
            elif isinstance(value, str) and len(value) > 15:
                values.append(f"{value[:12]}...")
            elif isinstance(value, (dict, list)):
                values.append(f"{str(value)[:12]}...")
            else:
                values.append(f"{str(value):<15}")
        print(f"  {' | '.join(values)}")
    
    # 如果记录超过10条，显示总数
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    total = cursor.fetchone()[0]
    if total > 10:
        print(f"\n  ... (共 {total} 条记录，仅显示前 10 条)")

# 显示外键关系
print("\n" + "=" * 70)
print("外键关系")
print("=" * 70)

for table in tables:
    table_name = table[0]
    cursor.execute(f"PRAGMA foreign_key_list({table_name})")
    fks = cursor.fetchall()
    
    if fks:
        print(f"\n{table_name}:")
        for fk in fks:
            # fk: (id, seq, table, from, to, on_update, on_delete, match)
            fk_table = fk[2]
            fk_from = fk[3]
            fk_to = fk[4]
            on_delete = fk[6] or "NO ACTION"
            print(f"  {fk_from} -> {fk_table}.{fk_to} (ON DELETE: {on_delete})")

conn.close()

print("\n" + "=" * 70)
print("查看完成")
print("=" * 70)
print("\n提示:")
print("  1. 使用命令行: sqlite3 backend/resume.db")
print("  2. 使用图形工具: DB Browser for SQLite")
print("  3. 使用 VS Code 扩展: SQLite Viewer")
