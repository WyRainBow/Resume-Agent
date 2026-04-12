import sqlite3
import sys
import tempfile
import unittest
import importlib.util
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
for candidate in (PROJECT_ROOT, BACKEND_DIR):
    candidate_str = str(candidate)
    if candidate_str not in sys.path:
        sys.path.insert(0, candidate_str)

from schema_bootstrap import read_current_revision, upgrade_database_schema  # noqa: E402


EXPECTED_TABLES = {
    "agent_conversations",
    "agent_messages",
    "alembic_version",
    "api_error_logs",
    "api_request_logs",
    "api_trace_spans",
    "application_progress",
    "calendar_events",
    "documents",
    "members",
    "permission_audit_logs",
    "report_conversations",
    "reports",
    "resume_embeddings",
    "resumes",
    "users",
}


def _load_auth_module():
    module_path = BACKEND_DIR / "routes" / "auth.py"
    spec = importlib.util.spec_from_file_location("test_auth_route_module", module_path)
    module = importlib.util.module_from_spec(spec)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load auth route module for tests")
    spec.loader.exec_module(module)
    return module


AUTH_MODULE = _load_auth_module()
AUTH_GET_DB = AUTH_MODULE.get_db
AUTH_ROUTER = AUTH_MODULE.router


def _read_tables(db_path: Path) -> set[str]:
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        return {row[0] for row in cursor.fetchall()}
    finally:
        connection.close()


class SchemaBootstrapTests(unittest.TestCase):
    def test_upgrade_fresh_sqlite_database_to_head(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "resume.db"
            database_url = f"sqlite:///{db_path}"

            upgrade_database_schema(database_url)

            self.assertEqual(read_current_revision(database_url), "014")
            self.assertTrue(EXPECTED_TABLES.issubset(_read_tables(db_path)))

    def test_register_succeeds_after_schema_upgrade(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "resume.db"
            database_url = f"sqlite:///{db_path}"

            upgrade_database_schema(database_url)

            engine = create_engine(database_url)
            testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

            app = FastAPI()
            app.include_router(AUTH_ROUTER)

            def override_db():
                db = testing_session()
                try:
                    yield db
                finally:
                    db.close()

            app.dependency_overrides[AUTH_GET_DB] = override_db
            client = TestClient(app)
            response = client.post(
                "/api/auth/register",
                json={"username": "877247564@qq.com", "password": "secret123"},
            )

            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["user"]["username"], "877247564@qq.com")
            engine.dispose()
