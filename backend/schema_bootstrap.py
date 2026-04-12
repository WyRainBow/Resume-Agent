"""Utilities for upgrading the application schema to the latest revision."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

try:
    from backend.database import DATABASE_URL
except ImportError:
    from database import DATABASE_URL


BACKEND_DIR = Path(__file__).resolve().parent
ALEMBIC_INI_PATH = BACKEND_DIR / "alembic.ini"
ALEMBIC_SCRIPT_PATH = BACKEND_DIR / "alembic"


def _build_alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(ALEMBIC_SCRIPT_PATH))
    config.set_main_option("sqlalchemy.url", database_url)
    config.attributes["configured_database_url"] = database_url
    return config


def upgrade_database_schema(database_url: str = DATABASE_URL, revision: str = "head") -> None:
    config = _build_alembic_config(database_url)
    command.upgrade(config, revision)


def read_current_revision(database_url: str = DATABASE_URL) -> str | None:
    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            try:
                result = connection.execute(text("SELECT version_num FROM alembic_version"))
            except Exception:
                return None
            row = result.fetchone()
            return None if row is None else str(row[0])
    finally:
        engine.dispose()
