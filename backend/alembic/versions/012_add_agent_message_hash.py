"""add message_hash to agent_messages

Revision ID: 012
Revises: 011
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_messages",
        sa.Column("message_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_agent_messages_message_hash",
        "agent_messages",
        ["message_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_agent_messages_message_hash", table_name="agent_messages")
    op.drop_column("agent_messages", "message_hash")
