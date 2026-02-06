"""
Add alias column to resumes table

Revision ID: 003_add_resume_alias
Revises: 002_add_reports_tables
Create Date: 2026-02-06

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("resumes", sa.Column("alias", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("resumes", "alias")
