"""add jd analysis tables

Revision ID: 015
Revises: 014
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_descriptions",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_url", sa.String(length=1024), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("structured_data", sa.JSON(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_job_descriptions_user_id", "job_descriptions", ["user_id"])
    op.create_index("ix_job_descriptions_is_default", "job_descriptions", ["is_default"])
    op.create_index("ix_job_descriptions_last_used_at", "job_descriptions", ["last_used_at"])
    op.create_index("ix_job_descriptions_updated_at", "job_descriptions", ["updated_at"])

    op.create_table(
        "jd_analysis_results",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_id", sa.String(length=255), nullable=False),
        sa.Column("jd_id", sa.String(length=255), sa.ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("report_data", sa.JSON(), nullable=False),
        sa.Column("learning_path_data", sa.JSON(), nullable=False),
        sa.Column("patch_batches_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jd_analysis_results_user_id", "jd_analysis_results", ["user_id"])
    op.create_index("ix_jd_analysis_results_resume_id", "jd_analysis_results", ["resume_id"])
    op.create_index("ix_jd_analysis_results_jd_id", "jd_analysis_results", ["jd_id"])
    op.create_index("ix_jd_analysis_results_created_at", "jd_analysis_results", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_jd_analysis_results_created_at", table_name="jd_analysis_results")
    op.drop_index("ix_jd_analysis_results_jd_id", table_name="jd_analysis_results")
    op.drop_index("ix_jd_analysis_results_resume_id", table_name="jd_analysis_results")
    op.drop_index("ix_jd_analysis_results_user_id", table_name="jd_analysis_results")
    op.drop_table("jd_analysis_results")

    op.drop_index("ix_job_descriptions_updated_at", table_name="job_descriptions")
    op.drop_index("ix_job_descriptions_last_used_at", table_name="job_descriptions")
    op.drop_index("ix_job_descriptions_is_default", table_name="job_descriptions")
    op.drop_index("ix_job_descriptions_user_id", table_name="job_descriptions")
    op.drop_table("job_descriptions")
