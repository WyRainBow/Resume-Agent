import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[2]))

from backend.core.logger import setup_logging

setup_logging(False, "INFO", "logs/test")

from backend.agent.application.resume_diagnosis_engine import (
    ResumeDiagnosisEngine,
    ResumeGuidanceModule,
)


RESUME = {
    "resume_id": "llm-diagnosis-test",
    "basic": {
        "name": "测试用户",
        "title": "后端开发工程师",
        "phone": "13800000000",
        "email": "secret@example.com",
        "avatarUrl": "https://private.example.com/avatar.png",
        "avatar_url": "https://private.example.com/avatar-snake.png",
        "location": "上海市浦东新区科苑路 88 号",
    },
    "personalInfo": {
        "name": "需隐藏姓名",
        "address": "杭州市西湖区文三路 99 号",
        "photo_url": "https://private.example.com/photo-snake.png",
    },
    "education": [],
    "experience": [
        {
            "company": "示例科技",
            "position": "后端开发实习生",
            "date": "2025.01 - 2025.06",
            "details": "使用 Go 和 Redis 重构订单接口，将耗时降低 35%。",
        }
    ],
    "projects": [],
    "skillContent": "Go、Python、Redis、MySQL",
}


class FakeDiagnosisLLM:
    def __init__(self, *, fail: bool = False, malformed_optional_fields: bool = False):
        self.fail = fail
        self.malformed_optional_fields = malformed_optional_fields
        self.calls = []

    async def ask_tool(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("upstream unavailable")
        arguments = {
            "public_trace": [
                "先核对结构完整度：当前教育经历为空，学历背景缺少可核验依据。",
                "再看成果证据：订单接口耗时降低 35%，这条量化结果能支撑贡献判断。",
                "接着检查面试风险：Redis 的使用场景出现了，但技术取舍和难点还没有展开。",
                "最后核对岗位匹配：Go、Redis 与后端方向一致，不过项目经历仍是证据缺口。",
            ],
            "overall_evaluation": "这份简历已有后端成果证据，但教育和项目两块会削弱可信度，建议先补齐硬缺口。",
            "strengths": ["订单接口耗时降低 35%，成果证据明确。"],
            "must_fix": ["教育经历为空，招聘方无法核验学历背景。"],
            "should_fix": ["Redis 的技术取舍和项目场景需要补充。"],
            "optional": ["技能栏可按熟练度重新分组。"],
            "dimension_descriptions": {
                "content": "主体经历可读，但教育和项目模块不完整。",
                "interview": "有量化结果，仍需补充技术决策依据。",
                "matching": "技术栈与后端方向基本一致。",
            },
            "suggestions": [
                {
                    "title": "补全教育经历",
                    "section": "教育经历",
                    "severity": "critical",
                    "original": "教育经历为空",
                    "recommendation": "补充真实的院校、专业、学历和在读时间。",
                    "evidence": "当前简历没有可核验的教育背景。",
                    "requires_facts": ["院校", "专业", "学历", "在读时间"],
                },
                {
                    "title": "补充 Redis 技术取舍",
                    "section": "工作经历",
                    "severity": "warning",
                    "original": "使用 Go 和 Redis 重构订单接口，将耗时降低 35%。",
                    "recommendation": "在保留 35% 结果的同时，说明 Redis 解决的瓶颈和关键取舍。",
                    "evidence": "当前条目有结果，但缺少技术决策依据。",
                    "requires_facts": [],
                },
                {
                    "title": "补充项目证据",
                    "section": "项目经历",
                    "severity": "warning",
                    "original": "项目经历为空",
                    "recommendation": "补充一段可核验的真实项目经历。",
                    "evidence": "当前简历没有项目模块内容。",
                    "requires_facts": ["项目背景", "个人贡献", "真实结果"],
                },
            ],
        }
        if self.malformed_optional_fields:
            arguments["public_trace"] = arguments["public_trace"][:3]
            arguments["dimension_descriptions"] = ["unexpected model shape"]
        return SimpleNamespace(
            tool_calls=[
                SimpleNamespace(
                    function=SimpleNamespace(arguments=json.dumps(arguments, ensure_ascii=False))
                )
            ]
        )


def test_engine_uses_real_llm_adapter_and_returns_curated_trace():
    llm = FakeDiagnosisLLM()
    payload = asyncio.run(
        ResumeDiagnosisEngine(llm=llm).diagnose(RESUME, "全面诊断当前简历")
    )

    assert len(llm.calls) == 1
    assert llm.calls[0]["tool_choice"].value == "required"
    assert payload["details"]["diagnosis_source"] == "llm"
    assert len(payload["details"]["public_trace"]) == 4
    assert "35%" in payload["details"]["public_trace"][1]
    assert payload["details"]["overall_evaluation"].startswith("这份简历已有")
    assert payload["details"]["dimensions"]["interview"]["description"].startswith(
        "有量化结果"
    )
    rendered = json.dumps(payload, ensure_ascii=False)
    assert "13800000000" not in rendered
    assert "secret@example.com" not in rendered
    assert "private.example.com/avatar.png" not in rendered
    llm_user_prompt = llm.calls[0]["messages"][0]["content"]
    assert "需隐藏姓名" not in llm_user_prompt
    assert "科苑路 88 号" not in llm_user_prompt
    assert "文三路 99 号" not in llm_user_prompt
    assert "avatar-snake.png" not in llm_user_prompt
    assert "photo-snake.png" not in llm_user_prompt


def test_engine_emits_evidence_progress_while_llm_is_still_running():
    async def scenario():
        release_llm = asyncio.Event()
        progress_updates = []

        class SlowDiagnosisLLM(FakeDiagnosisLLM):
            completed = False

            async def ask_tool(self, **kwargs):
                await release_llm.wait()
                response = await super().ask_tool(**kwargs)
                self.completed = True
                return response

        llm = SlowDiagnosisLLM()

        async def on_progress(update):
            progress_updates.append(
                (update.content, update.index, update.total, llm.completed)
            )
            if update.index == update.total - 1:
                release_llm.set()

        payload = await ResumeGuidanceModule(
            llm=llm,
            progress_interval_seconds=0.001,
        ).assess(
            RESUME,
            "全面诊断当前简历",
            on_progress=on_progress,
        )
        return payload, progress_updates

    payload, progress_updates = asyncio.run(scenario())

    assert len(progress_updates) == 5
    assert all(update[3] is False for update in progress_updates)
    assert [update[1] for update in progress_updates] == list(range(5))
    assert all(update[2] == 5 for update in progress_updates)
    assert "结构完整度" in progress_updates[0][0]
    assert "成果证据" in progress_updates[1][0]
    assert "面试风险" in progress_updates[2][0]
    assert "岗位匹配" in progress_updates[3][0]
    assert "诊断结论" in progress_updates[4][0]
    assert payload["details"]["diagnosis_source"] == "llm"


def test_guidance_module_returns_one_assessment_with_read_only_suggestions():
    llm = FakeDiagnosisLLM()
    payload = asyncio.run(
        ResumeGuidanceModule(llm=llm).assess(RESUME, "我要优化简历")
    )

    assert len(llm.calls) == 1
    system_prompt = llm.calls[0]["system_msgs"][0]["content"]
    assert "[Skill: resume-diagnosis]" in system_prompt
    assert "[Skill: resume-suggest]" in system_prompt
    assert payload["schema_version"] == "2.0"
    assert payload["assessment_id"].startswith("assessment_")
    assert payload["resume_ref"]["id"] == "llm-diagnosis-test"
    assert payload["resume_ref"]["revision"]
    assert payload["artifact_id"].startswith("diagnosis_")
    assert payload["source"] == {
        "skill": "resume-diagnosis",
        "assessment_id": payload["assessment_id"],
    }
    # 2026-07-16 拆分：诊断轮不再生成 suggestions（由 suggest() 按需生成）
    assert payload["details"]["suggestions"] == []
    assert "suggestions_artifact" not in payload["details"]


def test_engine_falls_back_to_valid_evidence_trace_when_llm_fails():
    payload = asyncio.run(
        ResumeDiagnosisEngine(llm=FakeDiagnosisLLM(fail=True)).diagnose(
            RESUME, "诊断这份简历"
        )
    )

    assert payload["details"]["diagnosis_source"] == "heuristic_fallback"
    assert len(payload["details"]["public_trace"]) == 4
    assert [step["label"] for step in payload["details"]["analysis_steps"]] == [
        "结构完整度",
        "成果证据",
        "面试风险",
        "岗位匹配",
    ]
    # 拆分后 fallback 诊断同样不带 suggestions（建议由 suggest() 按需生成）
    assert payload["details"]["suggestions"] == []


def test_engine_keeps_valid_llm_findings_when_one_optional_field_is_malformed():
    payload = asyncio.run(
        ResumeDiagnosisEngine(
            llm=FakeDiagnosisLLM(malformed_optional_fields=True)
        ).diagnose(RESUME, "诊断这份简历")
    )

    assert payload["details"]["diagnosis_source"] == "llm"
    assert payload["details"]["overall_evaluation"].startswith("这份简历已有")
    assert len(payload["details"]["public_trace"]) == 4
    assert payload["details"]["trace_source"] == "heuristic_calibration"


class FakeSuggestionsLLM:
    """suggest() 专用桩：只应答 submit_resume_suggestions。"""

    def __init__(self, *, fail: bool = False):
        self.fail = fail
        self.calls = []

    async def ask_tool(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("upstream unavailable")
        arguments = {
            "suggestions": [
                {
                    "title": "补全教育经历",
                    "section": "教育经历",
                    "severity": "critical",
                    "original": "教育经历为空",
                    "recommendation": "补充真实的院校、专业、学历和在读时间。",
                    "evidence": "当前简历没有可核验的教育背景。",
                    "requires_facts": ["院校", "专业", "学历"],
                },
                {
                    "title": "补充 Redis 技术取舍",
                    "section": "工作经历",
                    "severity": "warning",
                    "original": "使用 Go 和 Redis 重构订单接口，将耗时降低 35%。",
                    "recommendation": "说明 Redis 解决的瓶颈和关键取舍。",
                    "evidence": "当前条目有结果，但缺少技术决策依据。",
                    "requires_facts": [],
                },
                {
                    "title": "补充项目证据",
                    "section": "项目经历",
                    "severity": "warning",
                    "original": "项目经历为空",
                    "recommendation": "补充一段可核验的真实项目经历。",
                    "evidence": "当前简历没有项目模块内容。",
                    "requires_facts": ["项目背景", "个人贡献"],
                },
            ]
        }
        return SimpleNamespace(
            tool_calls=[
                SimpleNamespace(
                    function=SimpleNamespace(
                        name="submit_resume_suggestions",
                        arguments=json.dumps(arguments, ensure_ascii=False),
                    )
                )
            ]
        )


def test_suggest_generates_suggestions_and_writes_back_to_assessment():
    """2026-07-16 拆分：suggest() 基于已有诊断单独生成建议并回写。"""
    llm = FakeDiagnosisLLM()
    assessment = asyncio.run(ResumeGuidanceModule(llm=llm).assess(RESUME, "诊断"))
    assert assessment["details"]["suggestions"] == []

    suggest_llm = FakeSuggestionsLLM()
    envelope = asyncio.run(
        ResumeGuidanceModule(llm=suggest_llm).suggest(RESUME, assessment)
    )

    assert len(suggest_llm.calls) == 1
    assert envelope["kind"] == "resume_suggestions"
    assert envelope["source"]["assessment_id"] == assessment["assessment_id"]
    suggestions = envelope["payload"]["suggestions"]
    assert len(suggestions) == 3
    assert all(
        item["assessment_id"] == assessment["assessment_id"] for item in suggestions
    )
    # 回写：assessment 里现在有建议（供缓存命中/后续轮引用）
    assert assessment["details"]["suggestions"] == suggestions


def test_suggest_falls_back_to_baseline_when_llm_fails():
    assessment = asyncio.run(
        ResumeGuidanceModule(llm=FakeDiagnosisLLM()).assess(RESUME, "诊断")
    )
    envelope = asyncio.run(
        ResumeGuidanceModule(llm=FakeSuggestionsLLM(fail=True)).suggest(
            RESUME, assessment
        )
    )
    # LLM 失败回退结构基线建议（与诊断轮 heuristic_fallback 语义一致）
    suggestions = envelope["payload"]["suggestions"]
    assert suggestions, "baseline fallback should produce suggestions"
    assert all(
        item["assessment_id"] == assessment["assessment_id"] for item in suggestions
    )
