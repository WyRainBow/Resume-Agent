"""add admin console tables

Revision ID: 008
Revises: 007
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa


revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("position", sa.String(length=128), nullable=True),
        sa.Column("team", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_members_email", "members", ["email"])
    op.create_index("ix_members_user_id", "members", ["user_id"])

    op.create_table(
        "api_request_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("request_size", sa.Integer(), nullable=True),
        sa.Column("response_size", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_request_logs_trace_id", "api_request_logs", ["trace_id"])
    op.create_index("ix_api_request_logs_request_id", "api_request_logs", ["request_id"])
    op.create_index("ix_api_request_logs_path", "api_request_logs", ["path"])
    op.create_index("ix_api_request_logs_user_id", "api_request_logs", ["user_id"])
    op.create_index("ix_api_request_logs_ip", "api_request_logs", ["ip"])
    op.create_index("ix_api_request_logs_created_at", "api_request_logs", ["created_at"])

    op.create_table(
        "api_error_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("request_log_id", sa.Integer(), sa.ForeignKey("api_request_logs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("error_type", sa.String(length=128), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("error_stack", sa.Text(), nullable=True),
        sa.Column("service", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_error_logs_request_log_id", "api_error_logs", ["request_log_id"])
    op.create_index("ix_api_error_logs_trace_id", "api_error_logs", ["trace_id"])
    op.create_index("ix_api_error_logs_created_at", "api_error_logs", ["created_at"])

    op.create_table(
        "api_trace_spans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("span_id", sa.String(length=64), nullable=False),
        sa.Column("parent_span_id", sa.String(length=64), nullable=True),
        sa.Column("span_name", sa.String(length=255), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ok"),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_trace_spans_trace_id", "api_trace_spans", ["trace_id"])
    op.create_index("ix_api_trace_spans_span_id", "api_trace_spans", ["span_id"])
    op.create_index("ix_api_trace_spans_parent_span_id", "api_trace_spans", ["parent_span_id"])
    op.create_index("ix_api_trace_spans_start_time", "api_trace_spans", ["start_time"])
    op.create_index("ix_api_trace_spans_created_at", "api_trace_spans", ["created_at"])

    op.create_table(
        "permission_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("operator_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("from_role", sa.String(length=32), nullable=True),
        sa.Column("to_role", sa.String(length=32), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_permission_audit_logs_operator_user_id", "permission_audit_logs", ["operator_user_id"])
    op.create_index("ix_permission_audit_logs_target_user_id", "permission_audit_logs", ["target_user_id"])
    op.create_index("ix_permission_audit_logs_created_at", "permission_audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_permission_audit_logs_created_at", table_name="permission_audit_logs")
    op.drop_index("ix_permission_audit_logs_target_user_id", table_name="permission_audit_logs")
    op.drop_index("ix_permission_audit_logs_operator_user_id", table_name="permission_audit_logs")
    op.drop_table("permission_audit_logs")

    op.drop_index("ix_api_trace_spans_created_at", table_name="api_trace_spans")
    op.drop_index("ix_api_trace_spans_start_time", table_name="api_trace_spans")
    op.drop_index("ix_api_trace_spans_parent_span_id", table_name="api_trace_spans")
    op.drop_index("ix_api_trace_spans_span_id", table_name="api_trace_spans")
    op.drop_index("ix_api_trace_spans_trace_id", table_name="api_trace_spans")
    op.drop_table("api_trace_spans")

    op.drop_index("ix_api_error_logs_created_at", table_name="api_error_logs")
    op.drop_index("ix_api_error_logs_trace_id", table_name="api_error_logs")
    op.drop_index("ix_api_error_logs_request_log_id", table_name="api_error_logs")
    op.drop_table("api_error_logs")

    op.drop_index("ix_api_request_logs_created_at", table_name="api_request_logs")
    op.drop_index("ix_api_request_logs_ip", table_name="api_request_logs")
    op.drop_index("ix_api_request_logs_user_id", table_name="api_request_logs")
    op.drop_index("ix_api_request_logs_path", table_name="api_request_logs")
    op.drop_index("ix_api_request_logs_request_id", table_name="api_request_logs")
    op.drop_index("ix_api_request_logs_trace_id", table_name="api_request_logs")
    op.drop_table("api_request_logs")

    op.drop_index("ix_members_user_id", table_name="members")
    op.drop_index("ix_members_email", table_name="members")
    op.drop_table("members")
