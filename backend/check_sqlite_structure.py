#!/usr/bin/env python3
"""
检查 SQLite 数据库表结构
"""
import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
db_path = PROJECT_ROOT / "backend" / "resume.db"

if not db_path.exists():
    print(f"[错误] 数据库文件不存在: {db_path}")
    sys.exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

print("=" * 60)
print("SQLite 数据库表结构检查")
print("=" * 60)
print(f"\n数据库文件: {db_path}")

# 获取所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

if not tables:
    print("\n[警告] 数据库中没有表，可能需要初始化")
    print("运行: python backend/init_sqlite.py")
    conn.close()
    sys.exit(1)

print(f"\n找到 {len(tables)} 个表:")
for table in tables:
    print(f"  - {table[0]}")

# 检查每个表的结构
print("\n" + "=" * 60)
print("表结构详情")
print("=" * 60)

for table_name in [t[0] for t in tables]:
    print(f"\n表名: {table_name}")
    print("-" * 60)
    
    # 获取表结构
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    
    # SQLite PRAGMA table_info 返回: (cid, name, type, notnull, dflt_value, pk)
    print(f"{'字段名':<20} {'类型':<15} {'非空':<8} {'主键':<8} {'默认值'}")
    print("-" * 60)
    
    for col in columns:
        cid, name, col_type, notnull, dflt_value, pk = col
        notnull_str = "是" if notnull else "否"
        pk_str = "是" if pk else "否"
        dflt_str = str(dflt_value) if dflt_value else ""
        print(f"{name:<20} {col_type:<15} {notnull_str:<8} {pk_str:<8} {dflt_str}")
    
    # 获取索引信息
    cursor.execute(f"PRAGMA index_list({table_name})")
    indexes = cursor.fetchall()
    
    if indexes:
        print(f"\n索引:")
        for idx in indexes:
            idx_name = idx[1]
            unique = "唯一" if idx[2] else "普通"
            print(f"  - {idx_name} ({unique})")

# 检查外键
print("\n" + "=" * 60)
print("外键关系")
print("=" * 60)

for table_name in [t[0] for t in tables]:
    cursor.execute(f"PRAGMA foreign_key_list({table_name})")
    fks = cursor.fetchall()
    
    if fks:
        print(f"\n{table_name}:")
        for fk in fks:
            # SQLite foreign_key_list: (id, seq, table, from, to, on_update, on_delete, match)
            fk_table = fk[2]
            fk_from = fk[3]
            fk_to = fk[4]
            on_delete = fk[6] or "NO ACTION"
            print(f"  {fk_from} -> {fk_table}.{fk_to} (ON DELETE: {on_delete})")

conn.close()

print("\n" + "=" * 60)
print("检查完成")
print("=" * 60)
