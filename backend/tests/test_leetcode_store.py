from __future__ import annotations

import json
from pathlib import Path

from backend.services.leetcode_store import LeetCodeStore


def make_problem(slug: str) -> dict:
    return {
        "id": f"problem_{slug.replace('-', '_')}",
        "slug": slug,
        "title": "Example Problem",
        "difficulty": "Medium",
        "tags": ["Array"],
        "source": "custom",
        "description": "desc",
        "examples": [],
        "constraints": [],
        "hints": [],
        "functionName": "solve",
        "signature": "func solve(nums []int, k int) []int",
        "starterCode": "package main\n\nfunc solve(nums []int, k int) []int {\n\treturn nums\n}\n",
        "visibleTestCases": [
            {"id": "case-1", "input": {"nums": [1, 2, 3], "k": 2}, "expected": [2, 1, 3]}
        ],
        "hiddenTestCases": [
            {"id": "hidden-1", "input": {"nums": [1, 2], "k": 3}, "expected": [2, 1]}
        ],
        "judge": {"type": "function", "entry": "solve"},
        "createdAt": "2026-05-10T00:00:00.000Z",
        "updatedAt": "2026-05-10T00:00:00.000Z",
    }


def test_list_and_get_problem(tmp_path: Path):
    store = LeetCodeStore(base_dir=tmp_path)
    problem = make_problem("sample-problem")
    (tmp_path / "problems").mkdir(parents=True, exist_ok=True)
    (tmp_path / "problems" / "sample-problem.json").write_text(
        json.dumps(problem, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    problems = store.list_problems()

    assert len(problems) == 1
    assert problems[0]["slug"] == "sample-problem"
    assert store.get_problem("sample-problem")["starterCode"].startswith("package main")


def test_save_and_update_problem(tmp_path: Path):
    store = LeetCodeStore(base_dir=tmp_path)
    problem = make_problem("editable-problem")

    store.save_problem(problem)
    saved = store.get_problem("editable-problem")
    assert saved["title"] == "Example Problem"

    problem["title"] = "Updated Title"
    store.save_problem(problem)

    updated = store.get_problem("editable-problem")
    assert updated["title"] == "Updated Title"


def test_draft_and_submission_persistence(tmp_path: Path):
    store = LeetCodeStore(base_dir=tmp_path)
    code = "package main\n\nfunc solve(nums []int, k int) []int { return nums }\n"

    store.save_draft("sample-problem", code)
    draft = store.get_draft("sample-problem")

    assert draft is not None
    assert draft["slug"] == "sample-problem"
    assert draft["code"] == code

    store.save_submission(
        {
            "id": "sub-1",
            "slug": "sample-problem",
            "language": "go",
            "code": code,
            "mode": "submit",
            "status": "accepted",
            "summary": {"passed": 2, "total": 2},
            "results": [],
            "createdAt": "2026-05-10T00:00:00.000Z",
        }
    )

    submissions = store.list_submissions("sample-problem")
    assert len(submissions) == 1
    assert submissions[0]["id"] == "sub-1"


def test_solution_persistence(tmp_path: Path):
    store = LeetCodeStore(base_dir=tmp_path)
    code = "package main\n\nfunc quickSort(nums []int) []int { return nums }\n"

    solution = store.save_solution("quick-sort", code)
    loaded = store.get_solution("quick-sort")

    assert solution["slug"] == "quick-sort"
    assert solution["language"] == "go"
    assert solution["code"] == code
    assert loaded is not None
    assert loaded["code"] == code
