"""
数据迁移脚本：从本地 SQLite 迁移 agent 数据到远程 MySQL

使用方法：
    python backend/migrate_agent_data.py
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

# 源数据库：本地 SQLite
LOCAL_DB_PATH = PROJECT_ROOT / "backend" / "resume.db"
SOURCE_URL = f"sqlite:///{LOCAL_DB_PATH}"

# 目标数据库：远程 MySQL
TARGET_URL = os.getenv("DATABASE_URL", "mysql+pymysql://resume_user:0000@106.53.113.137:3306/resume_db")


def get_local_session():
    """获取本地 SQLite 会话"""
    engine = create_engine(SOURCE_URL)
    return sessionmaker(bind=engine)()


def get_remote_session():
    """获取远程 MySQL 会话"""
    engine = create_engine(TARGET_URL)
    return sessionmaker(bind=engine)()


def migrate_agent_conversations(local_session, remote_session):
    """迁移 agent_conversations 表数据"""
    print("开始迁移 agent_conversations...")

    # 从本地读取数据
    result = local_session.execute(text("SELECT * FROM agent_conversations"))
    rows = result.fetchall()

    # 获取列名
    columns = result.keys()

    migrated_count = 0
    skipped_count = 0

    for row in rows:
        row_dict = dict(zip(columns, row))

        # 检查是否已存在（根据 session_id）
        existing = remote_session.execute(
            text("SELECT id FROM agent_conversations WHERE session_id = :session_id"),
            {"session_id": row_dict["session_id"]}
        ).fetchone()

        if existing:
            print(f"  跳过已存在的会话: {row_dict['session_id']}")
            skipped_count += 1
            continue

        # 插入数据
        remote_session.execute(
            text("""
                INSERT INTO agent_conversations (
                    id, session_id, user_id, title, message_count, meta,
                    created_at, updated_at, last_message_at
                ) VALUES (
                    :id, :session_id, :user_id, :title, :message_count, :meta,
                    :created_at, :updated_at, :last_message_at
                )
            """),
            {
                "id": row_dict["id"],
                "session_id": row_dict["session_id"],
                "user_id": row_dict.get("user_id"),
                "title": row_dict.get("title", "New Conversation"),
                "message_count": row_dict.get("message_count", 0),
                "meta": row_dict.get("meta"),
                "created_at": row_dict["created_at"],
                "updated_at": row_dict["updated_at"],
                "last_message_at": row_dict.get("last_message_at"),
            }
        )
        migrated_count += 1
        print(f"  迁移会话: {row_dict['session_id']}")

    remote_session.commit()
    print(f"[OK] agent_conversations migration complete: {migrated_count} added, {skipped_count} skipped")


def migrate_agent_messages(local_session, remote_session):
    """迁移 agent_messages 表数据"""
    print("\n开始迁移 agent_messages...")

    # 从本地读取数据
    result = local_session.execute(text("SELECT * FROM agent_messages"))
    rows = result.fetchall()

    # 获取列名
    columns = result.keys()

    migrated_count = 0
    skipped_count = 0

    for row in rows:
        row_dict = dict(zip(columns, row))

        # 检查是否已存在（根据 conversation_id 和 seq）
        existing = remote_session.execute(
            text("""
                SELECT id FROM agent_messages
                WHERE conversation_id = :conversation_id AND seq = :seq
            """),
            {
                "conversation_id": row_dict["conversation_id"],
                "seq": row_dict["seq"]
            }
        ).fetchone()

        if existing:
            skipped_count += 1
            continue

        # 插入数据
        remote_session.execute(
            text("""
                INSERT INTO agent_messages (
                    id, conversation_id, seq, role, content, thought,
                    name, tool_call_id, tool_calls, base64_image, created_at
                ) VALUES (
                    :id, :conversation_id, :seq, :role, :content, :thought,
                    :name, :tool_call_id, :tool_calls, :base64_image, :created_at
                )
            """),
            {
                "id": row_dict["id"],
                "conversation_id": row_dict["conversation_id"],
                "seq": row_dict["seq"],
                "role": row_dict["role"],
                "content": row_dict.get("content"),
                "thought": row_dict.get("thought"),
                "name": row_dict.get("name"),
                "tool_call_id": row_dict.get("tool_call_id"),
                "tool_calls": row_dict.get("tool_calls"),
                "base64_image": row_dict.get("base64_image"),
                "created_at": row_dict["created_at"],
            }
        )
        migrated_count += 1

    remote_session.commit()
    print(f"[OK] agent_messages migration complete: {migrated_count} added, {skipped_count} skipped")


def main():
    print("=" * 60)
    print("Agent 数据迁移脚本")
    print("=" * 60)
    print(f"源数据库: {SOURCE_URL}")
    print(f"目标数据库: {TARGET_URL}")
    print("=" * 60)

    # 创建会话
    local_session = get_local_session()
    remote_session = get_remote_session()

    try:
        # 检查本地数据
        conv_count = local_session.execute(text("SELECT COUNT(*) FROM agent_conversations")).scalar()
        msg_count = local_session.execute(text("SELECT COUNT(*) FROM agent_messages")).scalar()

        print(f"\n本地数据库数据:")
        print(f"  - agent_conversations: {conv_count} 条")
        print(f"  - agent_messages: {msg_count} 条")

        # 检查远程表是否存在
        remote_conv_exists = remote_session.execute(
            text("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_conversations'")
        ).scalar() > 0

        if not remote_conv_exists:
            print("\n[WARNING] Remote database does not have agent_conversations table")
            print("Please run migration first:")
            print("  cd backend && alembic upgrade head")
            return

        # 执行迁移
        migrate_agent_conversations(local_session, remote_session)
        migrate_agent_messages(local_session, remote_session)

        # 验证迁移结果
        print("\n验证迁移结果:")
        remote_conv_count = remote_session.execute(text("SELECT COUNT(*) FROM agent_conversations")).scalar()
        remote_msg_count = remote_session.execute(text("SELECT COUNT(*) FROM agent_messages")).scalar()

        print(f"  - agent_conversations: {remote_conv_count} 条")
        print(f"  - agent_messages: {remote_msg_count} 条")

        print("\n" + "=" * 60)
        print("[OK] Data migration complete!")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        remote_session.rollback()
        sys.exit(1)
    finally:
        local_session.close()
        remote_session.close()


if __name__ == "__main__":
    main()
