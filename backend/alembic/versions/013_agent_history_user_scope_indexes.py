"""add user scoped index for agent_conversations

Revision ID: 013
Revises: 012
Create Date: 2026-02-24
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_agent_conversations_user_lastmsg_updated",
        "agent_conversations",
        ["user_id", "last_message_at", "updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_agent_conversations_user_lastmsg_updated",
        table_name="agent_conversations",
    )
