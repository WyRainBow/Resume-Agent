"""add email credentials

Revision ID: 016
Revises: 015
Create Date: 2026-07-09
"""

from alembic import op
import sqlalchemy as sa


revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_credentials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email_address", sa.String(length=255), nullable=False),
        sa.Column("encrypted_auth_code", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_email_credentials_user_id"), "email_credentials", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_email_credentials_user_id"), table_name="email_credentials")
    op.drop_table("email_credentials")
