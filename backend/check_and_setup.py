#!/usr/bin/env python3
"""
检查并设置数据库
"""
import subprocess
import sys

def run_cmd(cmd, check=True):
    """运行命令"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if check and result.returncode != 0:
            print(f"❌ 命令失败: {cmd}")
            print(f"   错误: {result.stderr}")
            return False
        return result.returncode == 0
    except Exception as e:
        print(f"❌ 执行命令时出错: {e}")
        return False

def check_mysql_service():
    """检查 MySQL 服务"""
    print("1. 检查 MySQL 服务...")
    if run_cmd("systemctl is-active --quiet mysql", check=False):
        print("   ✅ MySQL 服务运行正常")
        return True
    else:
        print("   ❌ MySQL 服务未运行")
        return False

def check_database():
    """检查数据库是否存在"""
    print("\n2. 检查数据库...")
    # 尝试使用 sudo mysql
    if run_cmd("sudo mysql -u root -e 'USE resume_db'", check=False):
        print("   ✅ 数据库 resume_db 已存在")
        return True
    # 尝试普通 mysql
    elif run_cmd("mysql -u root -e 'USE resume_db'", check=False):
        print("   ✅ 数据库 resume_db 已存在")
        return True
    else:
        print("   ⚠️  数据库 resume_db 不存在")
        print("\n   请手动创建数据库：")
        print("   sudo mysql -u root")
        print("   CREATE DATABASE IF NOT EXISTS resume_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        print("   EXIT;")
        return False

def run_migration():
    """运行数据库迁移"""
    print("\n3. 运行数据库迁移...")
    if run_cmd("alembic upgrade head"):
        print("   ✅ 数据库迁移成功")
        return True
    else:
        print("   ❌ 数据库迁移失败")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("数据库检查和设置")
    print("=" * 50)
    
    if not check_mysql_service():
        sys.exit(1)
    
    if check_database():
        if run_migration():
            print("\n" + "=" * 50)
            print("✅ 数据库配置完成！")
            print("=" * 50)
            print("\n可以启动服务了：")
            print("  cd .. && ./quick_start.sh")
        else:
            sys.exit(1)
    else:
        print("\n" + "=" * 50)
        print("⚠️  请先创建数据库，然后重新运行此脚本")
        print("=" * 50)
        sys.exit(1)
