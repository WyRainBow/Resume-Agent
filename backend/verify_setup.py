#!/usr/bin/env python3
"""
验证环境配置脚本
"""
import sys
import os

def check_mysql():
    """检查 MySQL 连接"""
    print("1. 检查 MySQL 连接...")
    try:
        from database import DATABASE_URL, engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("   ✅ MySQL 连接成功")
        return True
    except Exception as e:
        print(f"   ❌ MySQL 连接失败: {e}")
        print("   请确保 MySQL 服务已启动")
        return False

def check_tables():
    """检查数据库表"""
    print("\n2. 检查数据库表...")
    try:
        from database import engine
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        required = ['users', 'resumes']
        missing = [t for t in required if t not in tables]
        if missing:
            print(f"   ⚠️  缺少表: {missing}")
            print("   请运行: alembic upgrade head")
            return False
        else:
            print(f"   ✅ 所有表已创建: {tables}")
            return True
    except Exception as e:
        print(f"   ❌ 检查表失败: {e}")
        return False

def check_dependencies():
    """检查 Python 依赖"""
    print("\n3. 检查 Python 依赖...")
    required = ['sqlalchemy', 'alembic', 'pymysql', 'jose', 'passlib', 'fastapi']
    missing = []
    for dep in required:
        try:
            __import__(dep.replace('-', '_'))
        except ImportError:
            missing.append(dep)
    
    if missing:
        print(f"   ⚠️  缺少依赖: {missing}")
        print("   请运行: uv pip install -r requirements.txt")
        return False
    else:
        print("   ✅ 所有依赖已安装")
        return True

if __name__ == "__main__":
    print("=" * 50)
    print("环境配置验证")
    print("=" * 50)
    
    all_ok = True
    all_ok &= check_dependencies()
    all_ok &= check_mysql()
    if all_ok:
        all_ok &= check_tables()
    
    print("\n" + "=" * 50)
    if all_ok:
        print("✅ 环境配置完成，可以启动服务")
    else:
        print("❌ 环境配置未完成，请根据上述提示修复")
    print("=" * 50)
