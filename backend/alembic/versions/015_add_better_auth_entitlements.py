"""add better auth entitlements

Revision ID: 015
Revises: 014
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "better_auth_entitlements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("better_auth_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("image", sa.Text(), nullable=True),
        sa.Column("plan", sa.String(length=64), nullable=False, server_default="free"),
        sa.Column("credits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("daily_usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_usage_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subscription_status", sa.String(length=64), nullable=False, server_default="free"),
        sa.Column("provider_customer_id", sa.String(length=255), nullable=True),
        sa.Column("provider_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("better_auth_user_id"),
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_better_auth_user_id"),
        "better_auth_entitlements",
        ["better_auth_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_email"),
        "better_auth_entitlements",
        ["email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_plan"),
        "better_auth_entitlements",
        ["plan"],
        unique=False,
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_subscription_status"),
        "better_auth_entitlements",
        ["subscription_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_provider_customer_id"),
        "better_auth_entitlements",
        ["provider_customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_provider_subscription_id"),
        "better_auth_entitlements",
        ["provider_subscription_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_better_auth_entitlements_updated_at"),
        "better_auth_entitlements",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_better_auth_entitlements_updated_at"), table_name="better_auth_entitlements")
    op.drop_index(op.f("ix_better_auth_entitlements_provider_subscription_id"), table_name="better_auth_entitlements")
    op.drop_index(op.f("ix_better_auth_entitlements_provider_customer_id"), table_name="better_auth_entitlements")
    op.drop_index(op.f("ix_better_auth_entitlements_subscription_status"), table_name="better_auth_entitlements")
    op.drop_index(op.f("ix_better_auth_entitlements_plan"), table_name="better_auth_entitlements")
    op.drop_index(op.f("ix_better_auth_entitlements_email"), table_name="better_auth_entitlements")
    op.drop_index(op.f("ix_better_auth_entitlements_better_auth_user_id"), table_name="better_auth_entitlements")
    op.drop_table("better_auth_entitlements")
