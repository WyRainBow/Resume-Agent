"""Curated, user-visible reasoning copy.

This is product narration, not hidden chain-of-thought.  It states the observed
conversation state, the next decision, and the evidence the action should seek.
"""

from dataclasses import dataclass
from typing import Any

from backend.agent.application.conversation.conversation_state import (
    ResumeRequestRoute,
    classify_resume_request,
)


@dataclass(frozen=True)
class PublicReasoning:
    content: str
    phase: str = "turn_opening"
    node_id: str = ""
    is_complete: bool = True
    tool_progress: dict[str, Any] | None = None


def compose_turn_opening(
    *,
    user_input: str,
    intent: object,
    has_resume: bool,
    step_id: int,
) -> PublicReasoning:
    """Build a safe opening narration with coverage and evidence expectations."""
    intent_value = str(getattr(intent, "value", intent) or "").lower()
    route = classify_resume_request(user_input or "")

    if "greeting" in intent_value:
        if has_resume:
            content = (
                "你先来打个招呼，右侧这份简历也已经在了。"
                "我先轻松接住这句话，再把下一步落回这份简历，免得你重新交代一遍背景。"
            )
        else:
            content = (
                "你只是先来打个招呼，而且当前还没有加载简历。"
                "我先轻松接住这句话，再给你一个自然的起点，不急着把聊天变成填表。"
            )
    elif route is ResumeRequestRoute.BROAD_OPTIMIZE:
        if has_resume:
            content = (
                "你想把整份简历打磨得更有竞争力，当前简历内容已经加载。"
                "我先从结构完整度、成果证据、面试风险和岗位匹配四个方向看一遍，"
                "找出最值得优先动的地方，再决定怎么改。"
            )
        else:
            content = (
                "你想整体优化简历，但我手上还没有可供判断的正文。"
                "我先找到并读取可用简历，拿到教育、经历、项目和技能等证据后，"
                "再判断哪些地方最值得优先优化。"
            )
    elif route is ResumeRequestRoute.DIAGNOSE:
        if has_resume:
            content = (
                "你想先判断这份简历到底哪里强、哪里会卡住，当前正文已经可用。"
                "我会围绕结构、成果证据、面试风险和岗位匹配逐项核对，"
                "每个结论都尽量落到简历里的具体信息上。"
            )
        else:
            content = (
                "你想先诊断简历，但我还没拿到能作为依据的正文。"
                "我先找到并读取简历，再从结构、成果证据、面试风险和岗位匹配四个方向给出有证据的判断。"
            )
    elif route is ResumeRequestRoute.SPECIFIC_EDIT:
        content = (
            "你已经给出了比较具体的修改方向。"
            + (
                "我先在当前简历里定位对应内容，核对上下文和事实边界，再选择合适的修改工具。"
                if has_resume
            else "我还没拿到正文，先找到对应简历和原文，避免脱离上下文直接改写。"
            )
        )
    else:
        content = (
            "我先结合你这句话和右侧已加载的简历判断真正要解决的问题，"
            "再基于现有内容给出回应；需要行动时，我会说明依据并选择合适的工具。"
            if has_resume
            else "我先判断你这句话真正想解决什么；眼下手边还没有简历，"
            "如果需要具体内容，我会先找到可用材料，再给你有依据的回应。"
        )

    return PublicReasoning(
        content=content,
        phase="turn_opening",
        node_id=f"thought:step-{step_id}",
    )
