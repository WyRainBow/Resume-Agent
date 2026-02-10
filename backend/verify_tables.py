import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "resume.db"

if not db_path.exists():
    print(f"数据库文件不存在: {db_path}")
    exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# 获取所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

print(f"数据库: {db_path}")
print(f"表数量: {len(tables)}")
print("\n表列表:")
for table in tables:
    print(f"  - {table[0]}")

if tables:
    print("\n表结构:")
    for table_name in [t[0] for t in tables]:
        print(f"\n{table_name}:")
        cursor.execute(f"PRAGMA table_info({table_name})")
        cols = cursor.fetchall()
        for col in cols:
            print(f"  {col[1]} ({col[2]})")

conn.close()
