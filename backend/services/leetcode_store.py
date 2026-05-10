from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class LeetCodeStore:
    def __init__(self, base_dir: str | Path | None = None):
        project_root = Path(__file__).resolve().parents[2]
        self.base_dir = Path(base_dir) if base_dir else project_root / "LeetCode"
        self.problems_dir = self.base_dir / "problems"
        self.drafts_dir = self.base_dir / "drafts"
        self.solutions_dir = self.base_dir / "solutions"
        self.submissions_dir = self.base_dir / "submissions"
        self.runtime_dir = self.base_dir / "runtime"
        for directory in (
            self.base_dir,
            self.problems_dir,
            self.drafts_dir,
            self.solutions_dir,
            self.submissions_dir,
            self.runtime_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)

    def list_problems(self) -> list[dict]:
        problems = []
        for path in sorted(self.problems_dir.glob("*.json")):
            problems.append(self._load_json(path))
        return problems

    def get_problem(self, slug: str) -> dict:
        path = self.problems_dir / f"{slug}.json"
        if not path.exists():
            raise FileNotFoundError(f"Problem not found: {slug}")
        return self._load_json(path)

    def problem_exists(self, slug: str) -> bool:
        return (self.problems_dir / f"{slug}.json").exists()

    def save_problem(self, problem: dict) -> dict:
        slug = problem["slug"]
        now = _now_iso()
        existing = None
        if self.problem_exists(slug):
            existing = self.get_problem(slug)
        payload = dict(problem)
        payload["updatedAt"] = now
        payload["createdAt"] = payload.get("createdAt") or (existing or {}).get("createdAt") or now
        self._write_json(self.problems_dir / f"{slug}.json", payload)
        return payload

    def get_draft(self, slug: str) -> dict | None:
        path = self.drafts_dir / f"{slug}.json"
        if not path.exists():
            return None
        return self._load_json(path)

    def save_draft(self, slug: str, code: str, language: str = "go") -> dict:
        payload = {
            "slug": slug,
            "language": language,
            "code": code,
            "updatedAt": _now_iso(),
        }
        self._write_json(self.drafts_dir / f"{slug}.json", payload)
        return payload

    def get_solution(self, slug: str) -> dict | None:
        path = self.solutions_dir / f"{slug}.json"
        if not path.exists():
            return None
        return self._load_json(path)

    def save_solution(self, slug: str, code: str, language: str = "go") -> dict:
        payload = {
            "slug": slug,
            "language": language,
            "code": code,
            "updatedAt": _now_iso(),
        }
        self._write_json(self.solutions_dir / f"{slug}.json", payload)
        return payload

    def save_submission(self, record: dict) -> dict:
        slug = record["slug"]
        submission_id = record.get("id") or f"sub_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
        payload = dict(record)
        payload["id"] = submission_id
        payload["createdAt"] = payload.get("createdAt") or _now_iso()
        target_dir = self.submissions_dir / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        self._write_json(target_dir / f"{submission_id}.json", payload)
        return payload

    def list_submissions(self, slug: str | None = None) -> list[dict]:
        files: list[Path] = []
        if slug:
            target_dir = self.submissions_dir / slug
            if target_dir.exists():
                files = sorted(target_dir.glob("*.json"), reverse=True)
        else:
            files = sorted(self.submissions_dir.glob("*/*.json"), reverse=True)
        return [self._load_json(path) for path in files]

    @staticmethod
    def _load_json(path: Path) -> dict:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(path: Path, payload: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
