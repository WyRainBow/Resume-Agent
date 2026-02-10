import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 确保导入所有模型
from backend import models  # 这会加载所有模型
from backend.database import Base, engine, DATABASE_URL

print(f"数据库URL: {DATABASE_URL}")
print(f"表元数据: {len(Base.metadata.tables)} 个表")

# 列出所有表
for table_name in Base.metadata.tables.keys():
    print(f"  - {table_name}")

print("\n正在创建表...")
try:
    Base.metadata.create_all(bind=engine)
    print("表创建完成")
    
    # 验证
    import sqlite3
    db_path = PROJECT_ROOT / "backend" / "resume.db"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"\n验证: 数据库中有 {len(tables)} 个表")
    for table in tables:
        print(f"  - {table[0]}")
    conn.close()
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
