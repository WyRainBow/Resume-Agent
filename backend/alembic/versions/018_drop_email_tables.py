"""drop email tables (AI 发简历邮件功能下线)

移除 016/017 建的 email_credentials / email_templates 两张表——邮件凭证栈与
正文模板随「AI 发送简历到邮箱」功能一并下线。不改写 016/017 历史迁移文件本身,
本迁移单向 drop;downgrade() 镜像 016/017 的 upgrade() 重建两表以便回滚。

Revision ID: 018
Revises: 017
Create Date: 2026-07-11
"""

from alembic import op
import sqlalchemy as sa


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 先 drop index 再 drop table(与 016/017 downgrade 同序)
    op.drop_index(op.f("ix_email_templates_user_id"), table_name="email_templates")
    op.drop_table("email_templates")
    op.drop_index(op.f("ix_email_credentials_user_id"), table_name="email_credentials")
    op.drop_table("email_credentials")


def downgrade() -> None:
    # 镜像 016 upgrade():重建 email_credentials
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

    # 镜像 017 upgrade():重建 email_templates
    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_email_templates_user_id"), "email_templates", ["user_id"])
