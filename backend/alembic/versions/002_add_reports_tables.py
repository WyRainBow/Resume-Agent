"""add reports tables

Revision ID: 002
Revises: 001
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade():
    # 创建 documents 表
    op.create_table(
        'documents',
        sa.Column('id', sa.String(255), primary_key=True, index=True),
        sa.Column('content', sa.String(10000), nullable=False, server_default=''),
        sa.Column('type', sa.String(50), nullable=False, server_default='main'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # 创建 reports 表
    op.create_table(
        'reports',
        sa.Column('id', sa.String(255), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), nullable=True, index=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('main_id', sa.String(255), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_foreign_key(
        'fk_reports_user_id', 'reports', 'users',
        ['user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_reports_main_id', 'reports', 'documents',
        ['main_id'], ['id'], ondelete='CASCADE'
    )
    
    # 创建 report_conversations 表
    op.create_table(
        'report_conversations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, index=True),
        sa.Column('report_id', sa.String(255), nullable=False, index=True),
        sa.Column('conversation_id', sa.String(255), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key(
        'fk_report_conversations_report_id', 'report_conversations', 'reports',
        ['report_id'], ['id'], ondelete='CASCADE'
    )


def downgrade():
    op.drop_table('report_conversations')
    op.drop_table('reports')
    op.drop_table('documents')
