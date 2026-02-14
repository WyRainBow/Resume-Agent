"""
数据迁移脚本：从 MySQL 迁移到 PostgreSQL

示例：
    python backend/migrate_mysql_to_postgres.py --yes
    python backend/migrate_mysql_to_postgres.py --tables users,resumes,documents --yes
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

# 添加项目根目录到 Python 路径
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 加载环境变量
load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=True)
load_dotenv(override=True)

DEFAULT_MYSQL_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://resume_user:0000@106.53.113.137:3306/resume_db",
)
DEFAULT_POSTGRESQL_URL = os.getenv("POSTGRESQL_URL", "")

PREFERRED_TABLE_ORDER = [
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
    "resume_embeddings",
]


def normalize_postgres_url(url: str) -> str:
    """兼容 postgresql:// 前缀，默认切到 psycopg2 驱动。"""
    stripped = url.strip()
    if stripped.startswith("postgresql://"):
        return stripped.replace("postgresql://", "postgresql+psycopg2://", 1)
    return stripped


def make_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def quote_ident_for(engine: Engine, name: str) -> str:
    """按数据库方言转义标识符。"""
    if engine.dialect.name == "mysql":
        return f"`{name.replace('`', '``')}`"
    return f'"{name.replace(chr(34), chr(34) * 2)}"'


def get_table_names(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    return inspector.get_table_names()


def choose_primary_key(engine: Engine, table_name: str) -> str | None:
    inspector = inspect(engine)
    pk_info = inspector.get_pk_constraint(table_name) or {}
    cols = pk_info.get("constrained_columns") or []
    return cols[0] if cols else None


def get_ordered_tables(
    mysql_tables: list[str],
    only_tables: list[str] | None,
) -> list[str]:
    table_set = set(mysql_tables)
    if only_tables:
        picked = [t for t in only_tables if t in table_set]
        missing = [t for t in only_tables if t not in table_set]
        if missing:
            print(f"[WARN] 以下表在 MySQL 不存在，将跳过: {', '.join(missing)}")
        return picked

    ordered: list[str] = [t for t in PREFERRED_TABLE_ORDER if t in table_set]
    ordered.extend(sorted(table_set - set(ordered)))
    return ordered


def migrate_table(
    mysql_engine: Engine,
    pg_engine: Engine,
    table_name: str,
    batch_size: int = 1000,
    skip_existing: bool = True,
) -> tuple[int, int, int]:
    """
    迁移单表数据。
    返回值：(source_total, inserted, skipped)
    """
    print(f"\n迁移表: {table_name}")
    pk_col = choose_primary_key(pg_engine, table_name)

    q_table_mysql = quote_ident_for(mysql_engine, table_name)
    q_table_pg = quote_ident_for(pg_engine, table_name)

    pg_inspector = inspect(pg_engine)
    pg_columns = pg_inspector.get_columns(table_name)
    bool_columns = {
        col["name"]
        for col in pg_columns
        if col.get("type") is not None and "bool" in str(col.get("type")).lower()
    }

    with mysql_engine.connect() as mysql_conn:
        source_total = mysql_conn.execute(text(f"SELECT COUNT(*) FROM {q_table_mysql}")).scalar_one()
        if source_total == 0:
            print("  表无数据，跳过")
            return 0, 0, 0

        result = mysql_conn.execution_options(stream_results=True).execute(
            text(f"SELECT * FROM {q_table_mysql}")
        )
        columns = list(result.keys())

        q_cols = ", ".join(quote_ident_for(pg_engine, col) for col in columns)
        placeholders = ", ".join(f":{col}" for col in columns)

        if pk_col and skip_existing:
            insert_sql = text(
                f"""
                INSERT INTO {q_table_pg} ({q_cols})
                VALUES ({placeholders})
                ON CONFLICT ({quote_ident_for(pg_engine, pk_col)}) DO NOTHING
                """
            )
        else:
            insert_sql = text(
                f"""
                INSERT INTO {q_table_pg} ({q_cols})
                VALUES ({placeholders})
                """
            )

        inserted = 0
        skipped = 0
        processed = 0
        batch: list[dict[str, Any]] = []

        with pg_engine.begin() as pg_conn:
            for row in result.mappings():
                row_dict = dict(row)
                for col in bool_columns:
                    if col in row_dict and isinstance(row_dict[col], int):
                        row_dict[col] = bool(row_dict[col])
                batch.append(row_dict)
                if len(batch) >= batch_size:
                    inserted_now = _flush_batch(pg_conn, insert_sql, batch)
                    inserted += inserted_now
                    skipped += len(batch) - inserted_now
                    processed += len(batch)
                    batch = []
                    print(f"  进度: {processed}/{source_total}")

            if batch:
                inserted_now = _flush_batch(pg_conn, insert_sql, batch)
                inserted += inserted_now
                skipped += len(batch) - inserted_now
                processed += len(batch)
                print(f"  进度: {processed}/{source_total}")

    _sync_sequence_if_needed(pg_engine, table_name, pk_col)
    print(f"  [OK] {table_name}: {inserted} 条新增, {skipped} 条跳过")
    return int(source_total), inserted, skipped


def _flush_batch(pg_conn: Any, insert_sql: Any, batch: list[dict[str, Any]]) -> int:
    """
    批量写入并返回成功新增行数。
    对于 ON CONFLICT DO NOTHING，rowcount 会是新增数量（驱动相关，通常可用）。
    """
    try:
        with pg_conn.begin_nested():
            result = pg_conn.execute(insert_sql, batch)
        return int(result.rowcount or 0)
    except SQLAlchemyError as exc:
        # 回退到逐行写入，尽量完成迁移
        print(f"  [WARN] 批量写入失败，回退逐行写入: {exc}")
        ok = 0
        for row in batch:
            try:
                with pg_conn.begin_nested():
                    single_result = pg_conn.execute(insert_sql, row)
                ok += int(single_result.rowcount or 0)
            except SQLAlchemyError as row_exc:
                print(f"  [WARN] 单条写入失败，已跳过: {row_exc}")
        return ok


def _sync_sequence_if_needed(pg_engine: Engine, table_name: str, pk_col: str | None) -> None:
    """若主键是 serial/identity，迁移后同步序列避免后续插入主键冲突。"""
    if not pk_col:
        return

    q_table = quote_ident_for(pg_engine, table_name)
    q_pk = quote_ident_for(pg_engine, pk_col)
    sql = text(
        f"""
        SELECT setval(
            pg_get_serial_sequence('{q_table}', '{pk_col}'),
            COALESCE((SELECT MAX({q_pk}) FROM {q_table}), 1),
            (SELECT COUNT(*) > 0 FROM {q_table})
        )
        """
    )

    try:
        with pg_engine.begin() as conn:
            conn.execute(sql)
    except SQLAlchemyError:
        # 不是 serial/identity 或没有序列，忽略即可
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MySQL -> PostgreSQL 数据迁移")
    parser.add_argument("--mysql-url", default=DEFAULT_MYSQL_URL, help="源 MySQL 连接串")
    parser.add_argument("--postgres-url", default=DEFAULT_POSTGRESQL_URL, help="目标 PostgreSQL 连接串")
    parser.add_argument("--tables", default="", help="仅迁移指定表，逗号分隔")
    parser.add_argument("--batch-size", type=int, default=1000, help="批量写入大小，默认 1000")
    parser.add_argument("--no-skip-existing", action="store_true", help="不跳过已存在主键（可能冲突）")
    parser.add_argument("--yes", action="store_true", help="跳过确认提示，直接执行")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    mysql_url = args.mysql_url.strip()
    postgres_url = normalize_postgres_url(args.postgres_url)
    only_tables = [t.strip() for t in args.tables.split(",") if t.strip()] or None
    skip_existing = not args.no_skip_existing

    print("=" * 70)
    print("MySQL -> PostgreSQL 数据迁移")
    print("=" * 70)
    print(f"MySQL URL: {mysql_url}")
    print(f"PostgreSQL URL: {postgres_url}")
    print(f"仅迁移表: {', '.join(only_tables) if only_tables else '全部'}")
    print(f"批大小: {args.batch_size}")
    print(f"跳过已存在主键: {skip_existing}")
    print("=" * 70)

    if not postgres_url or "your_host" in postgres_url:
        print("[ERROR] POSTGRESQL_URL 未配置或无效")
        sys.exit(1)

    mysql_engine = make_engine(mysql_url)
    pg_engine = make_engine(postgres_url)

    try:
        mysql_tables = get_table_names(mysql_engine)
        pg_tables = set(get_table_names(pg_engine))
        tables = get_ordered_tables(mysql_tables, only_tables)

        if not tables:
            print("[WARN] 没有可迁移的表")
            return

        print(f"\nMySQL 表数量: {len(mysql_tables)}")
        print(f"PostgreSQL 表数量: {len(pg_tables)}")
        print(f"计划迁移表数量: {len(tables)}")

        print("\n源库数据统计:")
        with mysql_engine.connect() as conn:
            for table in tables:
                count = conn.execute(
                    text(f"SELECT COUNT(*) FROM {quote_ident_for(mysql_engine, table)}")
                ).scalar_one()
                print(f"  - {table}: {count}")

        if not args.yes:
            print("\n" + "=" * 70)
            confirm = input("是否开始迁移? (y/n): ").strip().lower()
            if confirm != "y":
                print("已取消迁移")
                return

        migrated_tables: list[str] = []
        for table in tables:
            if table not in pg_tables:
                print(f"\n[WARN] 目标 PostgreSQL 不存在表 {table}，跳过")
                continue
            migrate_table(
                mysql_engine=mysql_engine,
                pg_engine=pg_engine,
                table_name=table,
                batch_size=args.batch_size,
                skip_existing=skip_existing,
            )
            migrated_tables.append(table)

        print("\n" + "=" * 70)
        print("迁移校验（按行数）")
        print("=" * 70)
        with mysql_engine.connect() as mysql_conn, pg_engine.connect() as pg_conn:
            for table in migrated_tables:
                mysql_count = mysql_conn.execute(
                    text(f"SELECT COUNT(*) FROM {quote_ident_for(mysql_engine, table)}")
                ).scalar_one()
                pg_count = pg_conn.execute(
                    text(f"SELECT COUNT(*) FROM {quote_ident_for(pg_engine, table)}")
                ).scalar_one()
                status = "[OK]" if mysql_count == pg_count else "[MISMATCH]"
                print(f"{status} {table}: MySQL={mysql_count}, PostgreSQL={pg_count}")

        print("\n[OK] 数据迁移流程执行完成")
    except Exception as exc:
        print(f"\n[ERROR] 迁移失败: {exc}")
        raise
    finally:
        mysql_engine.dispose()
        pg_engine.dispose()


if __name__ == "__main__":
    main()
