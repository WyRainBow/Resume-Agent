"""Ask user question tool.

整份优化流程中,agent 需要补全模块信息(教育背景的 GPA/时间、奖项有无等)
时,调用这个工具弹出前端选择框逐项确认——而不是在聊天气泡里列问题等用户
打字。工具本身不做实际工作,只是把 questions 数组原样包进 structured_data,
由现有 tool_result → StructuredCardRegistry 管线直达前端 AskQuestionCard。

设计见 knowledge-base/specs/2026-07-12-asking-mode-interaction-design.md:
- 每问两选项:直接填写(走 Other 输入)/ 直接跳过
- 一次问多项,批量弹
- 首期只覆盖整份优化场景
"""

from typing import Any, Dict, List, Optional

from backend.agent.tool.base import BaseTool, ToolResult


class AskUserQuestionTool(BaseTool):
    """向用户批量提问,前端弹选择框逐项确认。"""

    name: str = "ask_user_question"
    description: str = (
        "向用户批量提问,前端会弹出一个选择框逐项确认(每个问题只给"
        "'直接填写'和'直接跳过'两个选项)。适用于整份优化时补全模块"
        "信息——比如教育背景缺 GPA/时间、奖项模块空着问用户有没有。"
        "用户答完会自动继续,不要在聊天气泡里重复列同样的问题。"
    )

    parameters: dict = {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "description": (
                    "要问的问题列表,一次批量提问。每个问题给两个选项:"
                    "'直接填写'(用户点后在 Other 输入框自由填)和'直接跳过'。"
                    "不要给内容分类选项(如'有GPA/有排名/都有'),分类是后续"
                    "处理时该做的事。"
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "问题全文,如'你的 GPA 或专业排名是多少?'",
                        },
                        "header": {
                            "type": "string",
                            "description": "问题的简短标签(≤12字),如'GPA'、'奖学金'",
                        },
                    },
                    "required": ["question", "header"],
                },
                "minItems": 1,
                "maxItems": 4,
            }
        },
        "required": ["questions"],
    }

    class Config:
        arbitrary_types_allowed = True

    async def execute(self, questions: List[Dict[str, Any]]) -> ToolResult:
        """不做实际工作,把 questions 原样包进 structured_data 透传给前端。

        前端 StructuredCardRegistry 按 type='ask_question' 渲染 AskQuestionCard。
        auto_continue 检测到本工具调用会挂起,等用户点完选择框提交答案,
        答案作为下一轮 prompt 自动发回来,整份优化接着推进。
        """
        # 防御:questions 必须是非空数组,每项至少有 question+header
        if not isinstance(questions, list) or not questions:
            return ToolResult(error="questions 必须是非空数组")
        normalized: List[Dict[str, Any]] = []
        for idx, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            question_text = (q.get("question") or "").strip()
            header_text = (q.get("header") or "").strip()
            if not question_text:
                continue
            normalized.append({
                "question": question_text,
                "header": header_text or f"问题{idx + 1}",
                # 固定两选项,对齐设计稿(二元化,不做内容分类)
                "options": [
                    {"label": "直接填写", "description": "点此后在输入框里填写"},
                    {"label": "直接跳过", "description": "没有或不想加,该项保持原样"},
                ],
                "multiSelect": False,
            })
        if not normalized:
            return ToolResult(error="questions 里没有有效问题(缺 question 字段)")

        return ToolResult(
            output="已弹出选择框,等用户逐项确认。用户提交后会自动继续,不要重复提问。",
            structured_data={
                "type": "ask_question",
                "questions": normalized,
            },
        )
