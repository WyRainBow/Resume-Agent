"""Resolve resume guidance Skills from the user's product intent."""

from __future__ import annotations

from backend.agent.application.conversation.conversation_state import (
    ResumeRequestRoute,
    classify_resume_request,
    is_diagnosis_apply_query,
    is_view_suggestions_query,
)


class ResumeSkillResolver:
    """Small Interface for selecting the complete resume guidance rule set."""

    _DIAGNOSIS_SKILLS = ("resume-diagnosis", "resume-suggest")

    def resolve(self, user_input: str) -> tuple[str, ...]:
        # 显式 apply 轮（按建议动手改）是写入轮，不注入「read-only diagnosis
        # turn」规则集，否则 prompt 会与已放行的编辑工具互相打架。
        if is_diagnosis_apply_query(user_input):
            return ()
        # 查看建议轮（只读展示，走 cv_suggestions_agent）也不注入诊断规则集，
        # 否则 prompt 会引导 LLM 重新调 cv_analyzer_agent 全量诊断（慢）。
        if is_view_suggestions_query(user_input):
            return ()
        route = classify_resume_request(user_input)
        if route in {
            ResumeRequestRoute.BROAD_OPTIMIZE,
            ResumeRequestRoute.DIAGNOSE,
        }:
            return self._DIAGNOSIS_SKILLS
        return ()
