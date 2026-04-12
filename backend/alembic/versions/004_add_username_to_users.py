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


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _set_username_not_null() -> None:
    if _is_sqlite():
        with op.batch_alter_table("users", recreate="always") as batch_op:
            batch_op.alter_column("username", existing_type=sa.String(length=255), nullable=False)
        return
    op.alter_column("users", "username", existing_type=sa.String(length=255), nullable=False)


def _drop_username_column() -> None:
    if _is_sqlite():
        with op.batch_alter_table("users", recreate="always") as batch_op:
            batch_op.drop_column("username")
        return
    op.drop_column("users", "username")


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=255), nullable=True))

    # 历史数据回填：沿用原 email 值，确保唯一性
    op.execute("UPDATE users SET username = email WHERE username IS NULL OR username = ''")

    _set_username_not_null()
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    _drop_username_column()
