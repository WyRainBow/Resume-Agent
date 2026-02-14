#!/usr/bin/env python3
"""
初始化 SQLite 数据库
创建所有必要的表结构
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import init_db, engine, DATABASE_URL

def main():
    print("=" * 50)
    print("初始化 SQLite 数据库")
    print("=" * 50)
    
    # 检查当前使用的数据库
    print(f"\n当前数据库: {DATABASE_URL}")
    
    if "sqlite" not in DATABASE_URL.lower():
        print("[警告] 当前配置不是 SQLite！")
        print("   请确保 .env 文件中已注释掉 DATABASE_URL")
        response = input("\n是否继续？(y/n): ")
        if response.lower() != 'y':
            print("已取消")
            return
    
    # 检查数据库文件路径
    db_path = PROJECT_ROOT / "backend" / "resume.db"
    print(f"\n数据库文件路径: {db_path}")
    
    if db_path.exists():
        print(f"[信息] 数据库文件已存在: {db_path}")
        print("使用现有数据库文件（如需重新创建，请手动删除该文件）")
    
    try:
        # 初始化数据库（创建所有表）
        print("\n正在创建数据库表...")
        init_db()
        print("[成功] 数据库表创建成功！")
        
        # 验证数据库文件
        if db_path.exists():
            file_size = db_path.stat().st_size
            print(f"\n数据库文件信息:")
            print(f"  路径: {db_path}")
            print(f"  大小: {file_size} 字节")
            print(f"  状态: [成功] 已创建")
        else:
            print("[警告] 数据库文件未找到")
        
        print("\n" + "=" * 50)
        print("[成功] SQLite 数据库初始化完成！")
        print("=" * 50)
        print("\n可以启动服务了：")
        print("  python -m uvicorn backend.main:app --host 0.0.0.0 --port 9000 --reload")
        
    except Exception as e:
        import traceback
        print(f"\n[错误] 初始化失败: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
