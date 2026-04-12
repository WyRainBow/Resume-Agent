import importlib.util
import sqlite3
import sys
import tempfile
import unittest
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

from auth import decode_access_token, hash_password  # noqa: E402
from schema_bootstrap import read_current_revision, upgrade_database_schema  # noqa: E402


def _load_auth_module():
    module_path = BACKEND_DIR / "routes" / "auth.py"
    spec = importlib.util.spec_from_file_location("test_admin_auth_route_module", module_path)
    module = importlib.util.module_from_spec(spec)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load auth route module for tests")
    spec.loader.exec_module(module)
    return module


AUTH_MODULE = _load_auth_module()
AUTH_GET_DB = AUTH_MODULE.get_db
AUTH_ROUTER = AUTH_MODULE.router


class AdminRoleBootstrapTests(unittest.TestCase):
    def test_upgrade_backfills_existing_users_to_admin(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "resume.db"
            database_url = f"sqlite:///{db_path}"

            upgrade_database_schema(database_url, revision="013")

            connection = sqlite3.connect(db_path)
            try:
                cursor = connection.cursor()
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                    ("existing@example.com", "existing@example.com", hash_password("secret123"), "user"),
                )
                connection.commit()
            finally:
                connection.close()

            upgrade_database_schema(database_url)

            connection = sqlite3.connect(db_path)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT role FROM users WHERE username = ?", ("existing@example.com",))
                self.assertEqual(cursor.fetchone()[0], "admin")
            finally:
                connection.close()

            self.assertEqual(read_current_revision(database_url), "014")

    def test_register_returns_admin_role_and_admin_token(self) -> None:
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
                json={"username": "new@example.com", "password": "secret123"},
            )

            self.assertEqual(response.status_code, 200, response.text)
            payload = response.json()
            self.assertEqual(payload["user"]["role"], "admin")
            self.assertEqual(decode_access_token(payload["access_token"])["role"], "admin")
            engine.dispose()
