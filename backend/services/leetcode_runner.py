from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import textwrap
import time
from pathlib import Path

_MAX_PROGRAM_OUTPUT_CHARS = 256 * 1024


def _truncate_output(text: str) -> str:
    if len(text) <= _MAX_PROGRAM_OUTPUT_CHARS:
        return text
    return text[:_MAX_PROGRAM_OUTPUT_CHARS] + "\n... (output truncated)"


class LeetCodeRunner:
    def __init__(self, runtime_dir: str | Path):
        self.runtime_dir = Path(runtime_dir)
        self.runtime_dir.mkdir(parents=True, exist_ok=True)

    def run_cases(self, problem: dict, code: str, cases: list[dict]) -> dict:
        results = [self._run_single_case(problem, code, case) for case in cases]
        return self._summarize(results)

    def submit_problem(self, problem: dict, code: str) -> dict:
        cases = list(problem.get("visibleTestCases", [])) + list(problem.get("hiddenTestCases", []))
        results = [self._run_single_case(problem, code, case) for case in cases]
        return self._summarize(results)

    def _run_single_case(self, problem: dict, code: str, case: dict) -> dict:
        start = time.perf_counter()
        work_dir = Path(tempfile.mkdtemp(prefix="leetcode_", dir=self.runtime_dir))
        try:
            main_file = work_dir / "main.go"
            main_file.write_text(self._build_program(problem, code, case), encoding="utf-8")
            completed = subprocess.run(
                ["go", "run", main_file.name],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=4,
            )
            duration_ms = int((time.perf_counter() - start) * 1000)
            stdout = completed.stdout.strip()
            stderr = completed.stderr.strip()
            if completed.returncode != 0:
                return {
                    "caseId": case["id"],
                    "passed": False,
                    "status": "runtime_error",
                    "stdout": stdout,
                    "stderr": stderr,
                    "expected": case.get("expected"),
                    "actual": None,
                    "durationMs": duration_ms,
                }

            actual = json.loads(stdout) if stdout else None
            passed = actual == case.get("expected")
            return {
                "caseId": case["id"],
                "passed": passed,
                "status": "accepted" if passed else "wrong_answer",
                "stdout": stdout,
                "stderr": stderr,
                "expected": case.get("expected"),
                "actual": actual,
                "durationMs": duration_ms,
            }
        except subprocess.TimeoutExpired:
            duration_ms = int((time.perf_counter() - start) * 1000)
            return {
                "caseId": case["id"],
                "passed": False,
                "status": "timeout",
                "stdout": "",
                "stderr": "Execution timed out",
                "expected": case.get("expected"),
                "actual": None,
                "durationMs": duration_ms,
            }
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def run_raw_program(self, code: str) -> dict:
        """按编辑器原文执行 main.go（IDE 模式）：展示 fmt.Print 与编译/运行错误。"""
        start = time.perf_counter()
        work_dir = Path(tempfile.mkdtemp(prefix="leetcode_raw_", dir=self.runtime_dir))
        try:
            main_file = work_dir / "main.go"
            body = code if code.endswith("\n") else code + "\n"
            main_file.write_text(body, encoding="utf-8")
            try:
                completed = subprocess.run(
                    ["go", "run", main_file.name],
                    cwd=work_dir,
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
            except subprocess.TimeoutExpired:
                duration_ms = int((time.perf_counter() - start) * 1000)
                return {
                    "status": "timeout",
                    "exitCode": None,
                    "stdout": "",
                    "stderr": _truncate_output("Program execution timed out."),
                    "durationMs": duration_ms,
                }
            duration_ms = int((time.perf_counter() - start) * 1000)
            ok = completed.returncode == 0
            return {
                "status": "success" if ok else "error",
                "exitCode": completed.returncode,
                "stdout": _truncate_output(completed.stdout.rstrip("\n")),
                "stderr": _truncate_output(completed.stderr.rstrip("\n")),
                "durationMs": duration_ms,
            }
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def _summarize(self, results: list[dict]) -> dict:
        passed = sum(1 for item in results if item["passed"])
        total = len(results)
        if all(item["status"] == "accepted" for item in results):
            status = "accepted"
        elif any(item["status"] == "timeout" for item in results):
            status = "timeout"
        elif any(item["status"] == "runtime_error" for item in results):
            status = "runtime_error"
        else:
            status = "wrong_answer"
        return {
            "status": status,
            "summary": {"passed": passed, "total": total},
            "results": results,
        }

    def _build_program(self, problem: dict, user_code: str, case: dict) -> str:
        function_name = (
            problem.get("judge", {}).get("entry")
            or problem.get("functionName")
            or "solve"
        )
        arg_types, return_type = self._parse_signature(problem.get("signature", ""))
        input_data = case.get("input", {})
        declarations = []
        args = []
        for name, value in input_data.items():
            declarations.append(self._build_input_declaration(name, value, arg_types.get(name)))
            args.append(name)
        joined_declarations = "\n\t".join(declarations)
        joined_args = ", ".join(args)
        trimmed = self._normalize_user_code(user_code)
        helper_block = self._build_helper_block(trimmed, arg_types, return_type)
        result_encoding = self._build_result_encoding(return_type)
        return textwrap.dedent(
            f"""
            package main

            import (
            \t"encoding/json"
            \t"fmt"
            )

            {helper_block}

            {trimmed}

            func main() {{
            \t{joined_declarations}
            \tresult := {function_name}({joined_args})
            \t{result_encoding}
            \tif err != nil {{
            \t\tpanic(err)
            \t}}
            \tfmt.Println(string(encoded))
            }}
            """
        ).strip() + "\n"

    def _build_input_declaration(self, name: str, value, arg_type: str | None) -> str:
        json_value = json.dumps(value, ensure_ascii=False)
        if arg_type == "*ListNode":
            return (
                f"var __input_{name} []int\n\t"
                f'if err := json.Unmarshal([]byte(`{json_value}`), &__input_{name}); err != nil {{ panic(err) }}\n\t'
                f"{name} := __buildLinkedList(__input_{name})"
            )
        go_type = self._infer_go_type(value)
        return (
            f"var {name} {go_type}\n\t"
            f'if err := json.Unmarshal([]byte(`{json_value}`), &{name}); err != nil {{ panic(err) }}'
        )

    def _build_result_encoding(self, return_type: str | None) -> str:
        if return_type == "*ListNode":
            return "encoded, err := json.Marshal(__linkedListToSlice(result))"
        return "encoded, err := json.Marshal(result)"

    def _build_helper_block(self, user_code: str, arg_types: dict[str, str], return_type: str | None) -> str:
        needs_linked_list = return_type == "*ListNode" or any(value == "*ListNode" for value in arg_types.values())
        if not needs_linked_list:
            return ""
        has_list_node = re.search(r"\btype\s+ListNode\s+struct\s*\{", user_code) is not None
        list_node_type = "" if has_list_node else textwrap.dedent(
            """
            type ListNode struct {
            \tVal  int
            \tNext *ListNode
            }
            """
        ).strip()
        helpers = textwrap.dedent(
            """
            func __buildLinkedList(nums []int) *ListNode {
            \tdummy := &ListNode{}
            \tcur := dummy
            \tfor _, num := range nums {
            \t\tcur.Next = &ListNode{Val: num}
            \t\tcur = cur.Next
            \t}
            \treturn dummy.Next
            }

            func __linkedListToSlice(head *ListNode) []int {
            \tresult := make([]int, 0)
            \tfor head != nil {
            \t\tresult = append(result, head.Val)
            \t\thead = head.Next
            \t}
            \treturn result
            }
            """
        ).strip()
        return "\n\n".join(part for part in (list_node_type, helpers) if part)

    def _normalize_user_code(self, user_code: str) -> str:
        code = user_code.strip()
        code = re.sub(r"^package\s+main\s*", "", code, count=1, flags=re.MULTILINE).strip()
        code = re.sub(r'^import\s*\((?:.|\n)*?\)\s*', "", code, count=1, flags=re.MULTILINE)
        code = re.sub(r'^import\s+"[^"]+"\s*', "", code, count=1, flags=re.MULTILINE)
        code = self._strip_main_function(code)
        return code.strip()

    def _strip_main_function(self, code: str) -> str:
        match = re.search(r"\bfunc\s+main\s*\([^)]*\)\s*\{", code)
        if not match:
            return code
        start = match.start()
        index = match.end() - 1
        depth = 0
        while index < len(code):
            char = code[index]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return (code[:start] + code[index + 1 :]).strip()
            index += 1
        return code

    def _infer_go_type(self, value) -> str:
        if isinstance(value, bool):
            return "bool"
        if isinstance(value, int):
            return "int"
        if isinstance(value, float):
            return "float64"
        if isinstance(value, str):
            return "string"
        if isinstance(value, list):
            if not value:
                return "[]interface{}"
            return f"[]{self._infer_go_type(value[0])}"
        if isinstance(value, dict):
            return "map[string]interface{}"
        return "interface{}"

    def _parse_signature(self, signature: str) -> tuple[dict[str, str], str | None]:
        signature = signature.strip()
        match = re.match(r"func\s+\w+\s*\((.*)\)\s*(.*)", signature)
        if not match:
            return {}, None
        args_part = match.group(1).strip()
        return_type = match.group(2).strip() or None
        arg_types: dict[str, str] = {}
        if not args_part:
            return arg_types, return_type
        for chunk in [part.strip() for part in args_part.split(",") if part.strip()]:
            pieces = chunk.rsplit(" ", 1)
            if len(pieces) != 2:
                continue
            arg_name, arg_type = pieces[0].strip(), pieces[1].strip()
            arg_types[arg_name] = arg_type
        return arg_types, return_type
