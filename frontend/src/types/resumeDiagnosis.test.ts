import { describe, expect, it } from "vitest";

import { isResumeDiagnosisStructuredData } from "./resumeDiagnosis";

function diagnosisPayload() {
  return {
    type: "resume_diagnosis",
    schema_version: "2.0",
    assessment_id: "assessment_test",
    resume_ref: { id: "resume_test", revision: "revision_test" },
    status: "success",
    tool: "cv_analyzer_agent",
    resume: { id: "resume_test", name: "测试简历", updated_at: "", language: "中文" },
    summary: {
      overall_score: 80,
      screening_score: 78,
      content_score: 81,
      quality_score: 81,
      interview_score: 79,
      competitiveness_score: 79,
      matching_score: 80,
    },
    details: {
      overall_evaluation: "主体框架可用。",
      strengths: ["经历中有量化证据。"],
      issues: { must_fix: [], should_fix: ["教育信息不足。"], optional: [] },
      dimensions: {
        content: { score: 81, description: "可读。", action_label: "查看建议", action_message: "查看建议" },
        interview: { score: 79, description: "可讲。", action_label: "查看风险", action_message: "查看风险" },
        matching: { score: 80, description: "匹配。", action_label: "查看依据", action_message: "查看依据" },
      },
      analysis_steps: [
        { label: "结构完整度", status: "done", summary: "已检查。" },
      ],
      public_trace: ["教育信息不足，影响背景核验。"],
      diagnosis_source: "llm",
      actions: [],
      top_actions: [],
      next_steps: [],
      suggestions: [
        {
          suggestion_id: "suggestion_test",
          assessment_id: "assessment_test",
          section: "education",
          severity: "critical",
          title: "补全教育信息",
          original: "教育经历为空",
          recommendation: "补充真实院校和时间。",
          evidence: "当前没有可核验教育信息。",
          requires_facts: ["院校", "时间"],
          status: "needs_fact",
        },
      ],
    },
  };
}

describe("isResumeDiagnosisStructuredData", () => {
  it("accepts one assessment containing a read-only suggestion artifact", () => {
    expect(isResumeDiagnosisStructuredData(diagnosisPayload())).toBe(true);
  });

  it("rejects an already-applied suggestion in the diagnosis-only protocol", () => {
    const payload = diagnosisPayload();
    payload.details.suggestions[0].status = "applied";

    expect(isResumeDiagnosisStructuredData(payload)).toBe(false);
  });

  it("rejects an unknown diagnosis source instead of labeling it as LLM", () => {
    const payload = diagnosisPayload();
    payload.details.diagnosis_source = "legacy_unknown";

    expect(isResumeDiagnosisStructuredData(payload)).toBe(false);
  });

  it("rejects drift between the legacy suggestion adapter and artifact", () => {
    const payload = diagnosisPayload();
    (payload.details as any).suggestions_artifact = {
      schema_version: "2.0",
      artifact_id: "suggestions_assessment_test",
      kind: "resume_suggestions",
      payload: {
        assessment_id: "assessment_test",
        suggestions: [{ ...payload.details.suggestions[0], title: "已漂移" }],
      },
    };

    expect(isResumeDiagnosisStructuredData(payload)).toBe(false);
  });
});
