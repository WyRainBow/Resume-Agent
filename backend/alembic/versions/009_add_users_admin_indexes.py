"""add users admin indexes

Revision ID: 009
Revises: 008
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def _index_exists(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(ix.get("name") == index_name for ix in inspector.get_indexes(table_name))


def upgrade() -> None:
    if not _index_exists("users", "ix_users_role"):
        op.create_index("ix_users_role", "users", ["role"])
    if not _index_exists("users", "ix_users_last_login_ip"):
        op.create_index("ix_users_last_login_ip", "users", ["last_login_ip"])
    if not _index_exists("users", "ix_users_updated_at"):
        op.create_index("ix_users_updated_at", "users", ["updated_at"])
    if not _index_exists("users", "ix_users_role_updated_at"):
        op.create_index("ix_users_role_updated_at", "users", ["role", "updated_at"])


def downgrade() -> None:
    if _index_exists("users", "ix_users_role_updated_at"):
        op.drop_index("ix_users_role_updated_at", table_name="users")
    if _index_exists("users", "ix_users_updated_at"):
        op.drop_index("ix_users_updated_at", table_name="users")
    if _index_exists("users", "ix_users_last_login_ip"):
        op.drop_index("ix_users_last_login_ip", table_name="users")
    if _index_exists("users", "ix_users_role"):
        op.drop_index("ix_users_role", table_name="users")
