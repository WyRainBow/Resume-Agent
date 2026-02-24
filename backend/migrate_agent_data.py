"""
数据迁移脚本：从本地 SQLite 迁移 agent 数据到远程 MySQL

用法:
  python backend/migrate_agent_data.py
  python backend/migrate_agent_data.py --dry-run
  python backend/migrate_agent_data.py --max-retries 5
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 加载环境变量
load_dotenv()

# 源数据库：本地 SQLite
LOCAL_DB_PATH = PROJECT_ROOT / "backend" / "resume.db"
SOURCE_URL = f"sqlite:///{LOCAL_DB_PATH}"

# 目标数据库：远程 MySQL
TARGET_URL = os.getenv(
    "DATABASE_URL", "mysql+pymysql://resume_user:0000@106.53.113.137:3306/resume_db"
)


@dataclass
class TableMigrationStats:
    table: str
    processed: int = 0
    migrated: int = 0
    skipped: int = 0
    failed: int = 0


@dataclass
class MigrationSummary:
    dry_run: bool
    retries: int
    conversations: TableMigrationStats
    messages: TableMigrationStats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate agent data to remote DB")
    parser.add_argument("--dry-run", action="store_true", help="只校验并打印迁移计划，不写远程")
    parser.add_argument("--max-retries", type=int, default=3, help="每个数据库操作最大重试次数")
    parser.add_argument("--retry-delay", type=float, default=0.8, help="首次重试等待秒数")
    return parser.parse_args()


def with_retry(
    op_name: str,
    operation: Callable[[], Any],
    max_retries: int,
    retry_delay: float,
) -> Any:
    delay = max(retry_delay, 0.1)
    for attempt in range(1, max_retries + 1):
        try:
            return operation()
        except Exception as exc:
            if attempt == max_retries:
                raise
            print(
                f"[RETRY] {op_name} failed on attempt {attempt}/{max_retries}: {exc}. "
                f"sleep={delay:.1f}s"
            )
            time.sleep(delay)
            delay *= 2


def get_local_session():
    engine = create_engine(SOURCE_URL)
    return sessionmaker(bind=engine)()


def get_remote_session():
    engine = create_engine(TARGET_URL)
    return sessionmaker(bind=engine)()


def check_remote_schema(remote_session, max_retries: int, retry_delay: float) -> None:
    def op() -> bool:
        return (
            remote_session.execute(
                text(
                    """
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_name = 'agent_conversations'
                    """
                )
            ).scalar()
            > 0
        )

    exists = with_retry(
        "check_remote_schema.agent_conversations", op, max_retries, retry_delay
    )
    if not exists:
        raise RuntimeError(
            "Remote database does not have agent_conversations table. "
            "Please run: cd backend && alembic upgrade head"
        )


def migrate_agent_conversations(
    local_session,
    remote_session,
    dry_run: bool,
    max_retries: int,
    retry_delay: float,
) -> TableMigrationStats:
    stats = TableMigrationStats(table="agent_conversations")
    print("\n开始迁移 agent_conversations...")

    result = local_session.execute(text("SELECT * FROM agent_conversations"))
    rows = result.fetchall()
    columns = result.keys()

    for row in rows:
        stats.processed += 1
        row_dict = dict(zip(columns, row))
        sid = row_dict["session_id"]
        try:
            existing = with_retry(
                f"agent_conversations.exists[{sid}]",
                lambda: remote_session.execute(
                    text(
                        "SELECT id FROM agent_conversations WHERE session_id = :session_id"
                    ),
                    {"session_id": sid},
                ).fetchone(),
                max_retries,
                retry_delay,
            )
            if existing:
                stats.skipped += 1
                continue

            if not dry_run:
                with_retry(
                    f"agent_conversations.insert[{sid}]",
                    lambda: remote_session.execute(
                        text(
                            """
                            INSERT INTO agent_conversations (
                                id, session_id, user_id, title, message_count, meta,
                                created_at, updated_at, last_message_at
                            ) VALUES (
                                :id, :session_id, :user_id, :title, :message_count, :meta,
                                :created_at, :updated_at, :last_message_at
                            )
                            """
                        ),
                        {
                            "id": row_dict["id"],
                            "session_id": sid,
                            "user_id": row_dict.get("user_id"),
                            "title": row_dict.get("title", "New Conversation"),
                            "message_count": row_dict.get("message_count", 0),
                            "meta": row_dict.get("meta"),
                            "created_at": row_dict["created_at"],
                            "updated_at": row_dict["updated_at"],
                            "last_message_at": row_dict.get("last_message_at"),
                        },
                    ),
                    max_retries,
                    retry_delay,
                )
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[ERROR] migrate conversation {sid}: {exc}")
            remote_session.rollback()

    if not dry_run:
        with_retry(
            "agent_conversations.commit",
            lambda: remote_session.commit(),
            max_retries,
            retry_delay,
        )
    print(
        f"[OK] agent_conversations: processed={stats.processed}, migrated={stats.migrated}, "
        f"skipped={stats.skipped}, failed={stats.failed}, dry_run={dry_run}"
    )
    return stats


def migrate_agent_messages(
    local_session,
    remote_session,
    dry_run: bool,
    max_retries: int,
    retry_delay: float,
) -> TableMigrationStats:
    stats = TableMigrationStats(table="agent_messages")
    print("\n开始迁移 agent_messages...")

    result = local_session.execute(text("SELECT * FROM agent_messages"))
    rows = result.fetchall()
    columns = result.keys()

    for row in rows:
        stats.processed += 1
        row_dict = dict(zip(columns, row))
        conv_id = row_dict["conversation_id"]
        seq = row_dict["seq"]
        row_key = f"{conv_id}:{seq}"
        try:
            existing = with_retry(
                f"agent_messages.exists[{row_key}]",
                lambda: remote_session.execute(
                    text(
                        """
                        SELECT id FROM agent_messages
                        WHERE conversation_id = :conversation_id AND seq = :seq
                        """
                    ),
                    {"conversation_id": conv_id, "seq": seq},
                ).fetchone(),
                max_retries,
                retry_delay,
            )
            if existing:
                stats.skipped += 1
                continue

            if not dry_run:
                with_retry(
                    f"agent_messages.insert[{row_key}]",
                    lambda: remote_session.execute(
                        text(
                            """
                            INSERT INTO agent_messages (
                                id, conversation_id, seq, role, content, thought,
                                name, tool_call_id, tool_calls, base64_image, created_at
                            ) VALUES (
                                :id, :conversation_id, :seq, :role, :content, :thought,
                                :name, :tool_call_id, :tool_calls, :base64_image, :created_at
                            )
                            """
                        ),
                        {
                            "id": row_dict["id"],
                            "conversation_id": conv_id,
                            "seq": seq,
                            "role": row_dict["role"],
                            "content": row_dict.get("content"),
                            "thought": row_dict.get("thought"),
                            "name": row_dict.get("name"),
                            "tool_call_id": row_dict.get("tool_call_id"),
                            "tool_calls": row_dict.get("tool_calls"),
                            "base64_image": row_dict.get("base64_image"),
                            "created_at": row_dict["created_at"],
                        },
                    ),
                    max_retries,
                    retry_delay,
                )
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[ERROR] migrate message {row_key}: {exc}")
            remote_session.rollback()

    if not dry_run:
        with_retry(
            "agent_messages.commit",
            lambda: remote_session.commit(),
            max_retries,
            retry_delay,
        )
    print(
        f"[OK] agent_messages: processed={stats.processed}, migrated={stats.migrated}, "
        f"skipped={stats.skipped}, failed={stats.failed}, dry_run={dry_run}"
    )
    return stats


def print_counts(local_session, remote_session, max_retries: int, retry_delay: float) -> None:
    local_conv = local_session.execute(text("SELECT COUNT(*) FROM agent_conversations")).scalar()
    local_msg = local_session.execute(text("SELECT COUNT(*) FROM agent_messages")).scalar()
    remote_conv = with_retry(
        "remote_count.agent_conversations",
        lambda: remote_session.execute(text("SELECT COUNT(*) FROM agent_conversations")).scalar(),
        max_retries,
        retry_delay,
    )
    remote_msg = with_retry(
        "remote_count.agent_messages",
        lambda: remote_session.execute(text("SELECT COUNT(*) FROM agent_messages")).scalar(),
        max_retries,
        retry_delay,
    )
    print("\n数据量:")
    print(f"  local agent_conversations={local_conv}, local agent_messages={local_msg}")
    print(f"  remote agent_conversations={remote_conv}, remote agent_messages={remote_msg}")


def main() -> None:
    args = parse_args()
    print("=" * 60)
    print("Agent 数据迁移脚本")
    print("=" * 60)
    print(f"源数据库: {SOURCE_URL}")
    print(f"目标数据库: {TARGET_URL}")
    print(f"dry_run: {args.dry_run}")
    print(f"max_retries: {args.max_retries}, retry_delay: {args.retry_delay}")
    print("=" * 60)

    local_session = get_local_session()
    remote_session = get_remote_session()

    try:
        check_remote_schema(remote_session, args.max_retries, args.retry_delay)
        print_counts(local_session, remote_session, args.max_retries, args.retry_delay)

        conv_stats = migrate_agent_conversations(
            local_session, remote_session, args.dry_run, args.max_retries, args.retry_delay
        )
        msg_stats = migrate_agent_messages(
            local_session, remote_session, args.dry_run, args.max_retries, args.retry_delay
        )

        summary = MigrationSummary(
            dry_run=args.dry_run,
            retries=args.max_retries,
            conversations=conv_stats,
            messages=msg_stats,
        )
        print("\n迁移汇总:")
        print(json.dumps(asdict(summary), ensure_ascii=False, indent=2))

        if conv_stats.failed > 0 or msg_stats.failed > 0:
            raise RuntimeError("migration completed with failures")

        print("\n[OK] Data migration complete!")
    except (SQLAlchemyError, RuntimeError) as exc:
        print(f"\n[ERROR] Migration failed: {exc}")
        traceback.print_exc()
        remote_session.rollback()
        sys.exit(1)
    finally:
        local_session.close()
        remote_session.close()


if __name__ == "__main__":
    main()
