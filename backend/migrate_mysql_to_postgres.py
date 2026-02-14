"""
数据迁移脚本：从 MySQL 迁移到 PostgreSQL

使用方法：
    1. 确保 .env 中配置了 POSTGRESQL_URL
    2. 设置 USE_POSTGRESQL=true
    3. 运行: python backend/migrate_mysql_to_postgres.py
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

# 源数据库：MySQL
MYSQL_URL = os.getenv("DATABASE_URL", "mysql+pymysql://resume_user:0000@106.53.113.137:3306/resume_db")

# 目标数据库：PostgreSQL
POSTGRESQL_URL = os.getenv("POSTGRESQL_URL")


def get_mysql_session():
    """获取 MySQL 会话"""
    engine = create_engine(MYSQL_URL)
    return sessionmaker(bind=engine)()


def get_postgres_session():
    """获取 PostgreSQL 会话"""
    # 转换 URL 格式
    url = POSTGRESQL_URL
    if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    engine = create_engine(url)
    return sessionmaker(bind=engine)()


def get_table_names(session):
    """获取所有表名"""
    engine = session.bind
    inspector = inspect(engine)
    return inspector.get_table_names()


def migrate_table(mysql_session, pg_session, table_name, primary_key="id", skip_existing=True):
    """迁移单个表的数据"""
    print(f"\n迁移表: {table_name}")

    # 获取 MySQL 数据
    result = mysql_session.execute(text(f"SELECT * FROM {table_name}"))
    rows = result.fetchall()

    if not rows:
        print(f"  表 {table_name} 无数据，跳过")
        return

    # 获取列名
    columns = result.keys()
    total = len(rows)
    migrated = 0
    skipped = 0

    for row in rows:
        row_dict = dict(zip(columns, row))

        # 检查是否已存在
        if skip_existing:
            pk_value = row_dict.get(primary_key)
            if pk_value is not None:
                existing = pg_session.execute(
                    text(f"SELECT {primary_key} FROM {table_name} WHERE {primary_key} = :pk"),
                    {"pk": pk_value}
                ).fetchone()

                if existing:
                    skipped += 1
                    continue

        # 构建插入语句
        cols_str = ", ".join(row_dict.keys())
        placeholders = ", ".join([f":{key}" for key in row_dict.keys()])

        try:
            pg_session.execute(
                text(f"""
                    INSERT INTO {table_name} ({cols_str})
                    VALUES ({placeholders})
                    ON CONFLICT ({primary_key}) DO NOTHING
                """),
                row_dict
            )
            migrated += 1

            if migrated % 100 == 0:
                print(f"  进度: {migrated}/{total}")
        except Exception as e:
            print(f"  警告: 插入记录失败 (pk={row_dict.get(primary_key)}): {e}")

    pg_session.commit()
    print(f"  [OK] {table_name}: {migrated} 条新增, {skipped} 条跳过")


def main():
    print("=" * 60)
    print("MySQL -> PostgreSQL 数据迁移脚本")
    print("=" * 60)
    print(f"源数据库 (MySQL): {MYSQL_URL}")
    print(f"目标数据库 (PostgreSQL): {POSTGRESQL_URL}")
    print("=" * 60)

    if not POSTGRESQL_URL or "your_host" in POSTGRESQL_URL:
        print("\n[ERROR] 请先在 .env 中配置 POSTGRESQL_URL")
        print("格式: POSTGRESQL_URL=postgresql://用户名:密码@主机:端口/数据库名")
        sys.exit(1)

    # 创建会话
    mysql_session = get_mysql_session()
    pg_session = get_postgres_session()

    try:
        # 获取 MySQL 所有表
        mysql_tables = get_table_names(mysql_session)
        pg_tables = get_table_names(pg_session)

        print(f"\nMySQL 表数量: {len(mysql_tables)}")
        print(f"PostgreSQL 表数量: {len(pg_tables)}")

        # 显示 MySQL 表统计
        print("\nMySQL 表数据统计:")
        for table in sorted(mysql_tables):
            count = mysql_session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"  - {table}: {count} 条")

        # 询问是否继续
        print("\n" + "=" * 60)
        response = input("是否开始迁移? (y/n): ").strip().lower()
        if response != "y":
            print("已取消迁移")
            return

        # 按依赖顺序迁移表
        # 先迁移没有外键的表，再迁移有外键的表
        table_order = [
            "users",
            "resumes",
            "documents",
            "reports",
            "report_conversations",
            "application_progress",
            "calendar_events",
            "members",
            "api_request_logs",
            "api_error_logs",
            "api_trace_spans",
            "permission_audit_logs",
            "agent_conversations",
            "agent_messages",
            "resume_embeddings",  # 新增的向量表
        ]

        for table in table_order:
            if table in mysql_tables:
                # 确定主键
                if table == "users":
                    pk = "id"
                elif table == "resumes":
                    pk = "id"
                elif table == "documents":
                    pk = "id"
                elif table == "reports":
                    pk = "id"
                elif table == "application_progress":
                    pk = "id"
                elif table == "calendar_events":
                    pk = "id"
                elif table == "members":
                    pk = "id"
                elif table == "agent_conversations":
                    pk = "id"
                else:
                    pk = "id"

                migrate_table(mysql_session, pg_session, table, primary_key=pk)

        # 验证迁移结果
        print("\n" + "=" * 60)
        print("验证迁移结果:")
        print("=" * 60)

        for table in sorted(mysql_tables):
            mysql_count = mysql_session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            pg_count = pg_session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            status = "[OK]" if mysql_count == pg_count else "[MISMATCH]"
            print(f"{status} {table}: MySQL={mysql_count}, PostgreSQL={pg_count}")

        print("\n" + "=" * 60)
        print("[OK] 数据迁移完成!")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        pg_session.rollback()
        sys.exit(1)
    finally:
        mysql_session.close()
        pg_session.close()


if __name__ == "__main__":
    main()
