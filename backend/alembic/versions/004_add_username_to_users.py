"""add username column to users

Revision ID: 004
Revises: 003
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=255), nullable=True))

    # 历史数据回填：沿用原 email 值，确保唯一性
    op.execute("UPDATE users SET username = email WHERE username IS NULL OR username = ''")

    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.alter_column("users", "username", existing_type=sa.String(length=255), nullable=False)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
