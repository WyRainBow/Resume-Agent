"""add application_progress table

Revision ID: 006
Revises: 005
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "application_progress",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("application_link", sa.String(length=512), nullable=True),
        sa.Column("industry", sa.String(length=128), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("position", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=128), nullable=True),
        sa.Column("progress", sa.String(length=64), nullable=True),
        sa.Column("progress_status", sa.String(length=64), nullable=True),
        sa.Column("progress_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("application_date", sa.Date(), nullable=True),
        sa.Column("referral_code", sa.String(length=64), nullable=True),
        sa.Column("link2", sa.String(length=512), nullable=True),
        sa.Column("resume_id", sa.String(length=255), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_application_progress_user_id", "application_progress", ["user_id"])
    op.create_index("ix_application_progress_resume_id", "application_progress", ["resume_id"])


def downgrade() -> None:
    op.drop_index("ix_application_progress_resume_id", table_name="application_progress")
    op.drop_index("ix_application_progress_user_id", table_name="application_progress")
    op.drop_table("application_progress")
