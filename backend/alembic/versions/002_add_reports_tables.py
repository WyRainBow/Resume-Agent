"""add reports tables

Revision ID: 002
Revises: 001
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def _existing_tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    existing_tables = _existing_tables()
    if "documents" not in existing_tables:
        op.create_table(
            "documents",
            sa.Column("id", sa.String(255), primary_key=True, index=True),
            sa.Column("content", sa.String(10000), nullable=False, server_default=""),
            sa.Column("type", sa.String(50), nullable=False, server_default="main"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
    if "reports" not in existing_tables:
        op.create_table(
            "reports",
            sa.Column("id", sa.String(255), primary_key=True, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("main_id", sa.String(255), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
    if "report_conversations" not in existing_tables:
        op.create_table(
            "report_conversations",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, index=True),
            sa.Column("report_id", sa.String(255), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("conversation_id", sa.String(255), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("report_conversations")
    op.drop_table("reports")
    op.drop_table("documents")
