from __future__ import annotations

from pathlib import Path

from backend.services.leetcode_runner import LeetCodeRunner


def make_problem() -> dict:
    return {
        "slug": "reverse-nodes-in-k-group-full-tail",
        "functionName": "reverseKGroup",
        "signature": "func reverseKGroup(head *ListNode, k int) *ListNode",
        "judge": {"entry": "reverseKGroup"},
        "visibleTestCases": [
            {"id": "case-1", "input": {"head": [1, 2, 3, 4, 5, 6, 7, 8], "k": 3}, "expected": [3, 2, 1, 6, 5, 4, 8, 7]}
        ],
        "hiddenTestCases": [
            {"id": "hidden-1", "input": {"head": [1, 2], "k": 3}, "expected": [2, 1]}
        ],
    }


GOOD_CODE = """package main

type ListNode struct {
\tVal  int
\tNext *ListNode
}

func reverseKGroup(head *ListNode, k int) *ListNode {
\tdummy := &ListNode{Next: head}
\tpre := dummy
\tcur := head
\tfor cur != nil {
\t\ttail := cur
\t\tcount := 1
\t\tfor count < k && tail.Next != nil {
\t\t\ttail = tail.Next
\t\t\tcount++
\t\t}
\t\tnextGroup := tail.Next
\t\tnewHead, newTail := reverse(cur, tail)
\t\tpre.Next = newHead
\t\tnewTail.Next = nextGroup
\t\tpre = newTail
\t\tcur = nextGroup
\t}
\treturn dummy.Next
}

func reverse(head, tail *ListNode) (*ListNode, *ListNode) {
\tprev := tail.Next
\tcur := head
\tfor prev != tail {
\t\tnext := cur.Next
\t\tcur.Next = prev
\t\tprev = cur
\t\tcur = next
\t}
\treturn tail, head
}
"""


BAD_CODE = """package main

type ListNode struct {
\tVal  int
\tNext *ListNode
}

func reverseKGroup(head *ListNode, k int) *ListNode {
\treturn head
}
"""


STANDALONE_PROGRAM_CODE = """package main

import "fmt"

type ListNode struct {
\tVal  int
\tNext *ListNode
}

func reverseKGroup(head *ListNode, k int) *ListNode {
\tdummy := &ListNode{Next: head}
\tpre := dummy
\tcur := head
\tfor cur != nil {
\t\ttail := cur
\t\tcount := 1
\t\tfor count < k && tail.Next != nil {
\t\t\ttail = tail.Next
\t\t\tcount++
\t\t}
\t\tnextGroup := tail.Next
\t\tnewHead, newTail := reverse(cur, tail)
\t\tpre.Next = newHead
\t\tnewTail.Next = nextGroup
\t\tpre = newTail
\t\tcur = nextGroup
\t}
\treturn dummy.Next
}

func reverse(head, tail *ListNode) (*ListNode, *ListNode) {
\tprev := tail.Next
\tcur := head
\tfor prev != tail {
\t\tnext := cur.Next
\t\tcur.Next = prev
\t\tprev = cur
\t\tcur = next
\t}
\treturn tail, head
}

func buildList(nums []int) *ListNode {
\tdummy := &ListNode{}
\tcur := dummy
\tfor _, num := range nums {
\t\tcur.Next = &ListNode{Val: num}
\t\tcur = cur.Next
\t}
\treturn dummy.Next
}

func printList(head *ListNode) {
\tfor head != nil {
\t\tfmt.Print(head.Val)
\t\tif head.Next != nil {
\t\t\tfmt.Print(" -> ")
\t\t}
\t\thead = head.Next
\t}
\tfmt.Println()
}

func main() {
\thead := buildList([]int{1, 2, 3, 4, 5, 6, 7, 8})
\tk := 3
\tnewHead := reverseKGroup(head, k)
\tprintList(newHead)
}
"""


def test_run_cases_returns_pass_result(tmp_path: Path):
    runner = LeetCodeRunner(runtime_dir=tmp_path)
    result = runner.run_cases(make_problem(), GOOD_CODE, make_problem()["visibleTestCases"])

    assert result["status"] == "accepted"
    assert result["summary"]["passed"] == 1
    assert result["results"][0]["passed"] is True


def test_submit_problem_uses_hidden_cases(tmp_path: Path):
    runner = LeetCodeRunner(runtime_dir=tmp_path)
    result = runner.submit_problem(make_problem(), GOOD_CODE)

    assert result["status"] == "accepted"
    assert result["summary"]["total"] == 2


def test_submit_problem_returns_wrong_answer(tmp_path: Path):
    runner = LeetCodeRunner(runtime_dir=tmp_path)
    result = runner.submit_problem(make_problem(), BAD_CODE)

    assert result["status"] == "wrong_answer"
    assert any(not item["passed"] for item in result["results"])


def test_run_cases_accepts_standalone_program_by_ignoring_user_main(tmp_path: Path):
    runner = LeetCodeRunner(runtime_dir=tmp_path)
    result = runner.run_cases(make_problem(), STANDALONE_PROGRAM_CODE, make_problem()["visibleTestCases"])

    assert result["status"] == "accepted"
    assert result["results"][0]["passed"] is True
