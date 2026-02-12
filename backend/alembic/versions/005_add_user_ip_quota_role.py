"""add last_login_ip, api_quota, role to users

Revision ID: 005
Revises: 004
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_ip", sa.String(length=45), nullable=True))
    op.add_column("users", sa.Column("api_quota", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("role", sa.String(length=32), nullable=False, server_default="user"))


def downgrade() -> None:
    op.drop_column("users", "role")
    op.drop_column("users", "api_quota")
    op.drop_column("users", "last_login_ip")
