"""promote all users to admin by default

Revision ID: 014
Revises: 013
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _set_role_default(default_role: str) -> None:
    if _is_sqlite():
        with op.batch_alter_table("users", recreate="always") as batch_op:
            batch_op.alter_column(
                "role",
                existing_type=sa.String(length=32),
                existing_nullable=False,
                server_default=default_role,
            )
        return
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(length=32),
        existing_nullable=False,
        server_default=default_role,
    )


def upgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role IS NULL OR role != 'admin'")
    _set_role_default("admin")


def downgrade() -> None:
    _set_role_default("user")
    op.execute("UPDATE users SET role = 'user' WHERE role = 'admin'")
