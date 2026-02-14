"""add resume embeddings with pgvector support

Revision ID: 011
Revises: 010
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 启用 pgvector 扩展（PostgreSQL）
    # 注意：需要先在数据库中安装 pgvector 扩展
    # CREATE EXTENSION IF NOT EXISTS vector;
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 创建简历向量嵌入表
    op.create_table(
        "resume_embeddings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("resume_id", sa.String(length=255), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", sa.JSON(), nullable=False),  # 向量数据
        sa.Column("content_type", sa.String(length=50), nullable=False),  # summary/experience/projects/skills
        sa.Column("content", sa.Text(), nullable=False),  # 原始文本
        sa.Column("metadata", sa.JSON(), nullable=True),  # 额外元数据
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 创建索引
    op.create_index("ix_resume_embeddings_id", "resume_embeddings", ["id"])
    op.create_index("ix_resume_embeddings_resume_id", "resume_embeddings", ["resume_id"])
    op.create_index("ix_resume_embeddings_user_id", "resume_embeddings", ["user_id"])
    op.create_index("ix_resume_embeddings_content_type", "resume_embeddings", ["content_type"])

    # 为 user_id + content_type 创建复合索引，用于快速查询特定类型的简历片段
    op.create_index(
        "ix_resume_embeddings_user_content_type",
        "resume_embeddings",
        ["user_id", "content_type"]
    )


def downgrade() -> None:
    op.drop_index("ix_resume_embeddings_user_content_type", table_name="resume_embeddings")
    op.drop_index("ix_resume_embeddings_content_type", table_name="resume_embeddings")
    op.drop_index("ix_resume_embeddings_user_id", table_name="resume_embeddings")
    op.drop_index("ix_resume_embeddings_resume_id", table_name="resume_embeddings")
    op.drop_index("ix_resume_embeddings_id", table_name="resume_embeddings")
    op.drop_table("resume_embeddings")

    # 删除 pgvector 扩展（可选）
    # op.execute("DROP EXTENSION IF EXISTS vector;")
