"""add agent conversation tables

Revision ID: 010
Revises: 009
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_conversations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="New Conversation"),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_agent_conversations_id", "agent_conversations", ["id"])
    op.create_index("ix_agent_conversations_session_id", "agent_conversations", ["session_id"], unique=True)
    op.create_index("ix_agent_conversations_user_id", "agent_conversations", ["user_id"])
    op.create_index("ix_agent_conversations_updated_at", "agent_conversations", ["updated_at"])
    op.create_index(
        "ix_agent_conversations_user_updated_at",
        "agent_conversations",
        ["user_id", "updated_at"],
    )

    op.create_table(
        "agent_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("thought", sa.Text(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("tool_call_id", sa.String(length=255), nullable=True),
        sa.Column("tool_calls", sa.JSON(), nullable=True),
        sa.Column("base64_image", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["conversation_id"], ["agent_conversations.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("conversation_id", "seq", name="uq_agent_messages_conversation_seq"),
    )
    op.create_index("ix_agent_messages_id", "agent_messages", ["id"])
    op.create_index("ix_agent_messages_conversation_id", "agent_messages", ["conversation_id"])
    op.create_index("ix_agent_messages_tool_call_id", "agent_messages", ["tool_call_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_messages_tool_call_id", table_name="agent_messages")
    op.drop_index("ix_agent_messages_conversation_id", table_name="agent_messages")
    op.drop_index("ix_agent_messages_id", table_name="agent_messages")
    op.drop_table("agent_messages")

    op.drop_index("ix_agent_conversations_user_updated_at", table_name="agent_conversations")
    op.drop_index("ix_agent_conversations_updated_at", table_name="agent_conversations")
    op.drop_index("ix_agent_conversations_user_id", table_name="agent_conversations")
    op.drop_index("ix_agent_conversations_session_id", table_name="agent_conversations")
    op.drop_index("ix_agent_conversations_id", table_name="agent_conversations")
    op.drop_table("agent_conversations")
