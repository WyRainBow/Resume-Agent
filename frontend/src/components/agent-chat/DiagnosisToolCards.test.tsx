// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DiagnosisToolCards from "./DiagnosisToolCards";
import type {
  DiagnosisDimension,
  ResumeDiagnosisStructuredData,
} from "@/types/resumeDiagnosis";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const dim = (score: number, actionMessage: string): DiagnosisDimension => ({
  score,
  description: "维度说明",
  action_label: "查看修改建议",
  action_message: actionMessage,
});

const DIAGNOSIS: ResumeDiagnosisStructuredData = {
  type: "resume_diagnosis",
  status: "success",
  tool: "cv_analyzer_agent",
  resume: { id: "r1", name: "韦宇", updated_at: "", language: "中文" },
  summary: {
    overall_score: 79,
    screening_score: 65,
    content_score: 72,
    quality_score: 70,
    interview_score: 78,
    competitiveness_score: 79,
    matching_score: 82,
  },
  details: {
    overall_evaluation: "经历扎实，技术堆叠清晰。",
    strengths: [],
    issues: { must_fix: [], should_fix: [], optional: [] },
    dimensions: {
      // 2026-07-16 拆分：content 维度 chip 的 action_message 是后端下发的
      // view 文案（只读建议轮），不再是会触发 apply 的"帮我处理…问题"
      content: dim(72, "查看这次诊断的修改建议"),
      interview: dim(78, "帮我强化简历里的面试证据"),
      matching: dim(82, "查看这次诊断的岗位匹配依据"),
    },
    analysis_steps: [],
    actions: [],
    top_actions: [],
    next_steps: [],
    // 诊断轮不再产出 suggestions（由 cv_suggestions_agent 按需生成）
    suggestions: [],
  },
};

describe("DiagnosisToolCards · 诊断只出评分卡，建议走对话轮", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the score card only; no inline suggestions", () => {
    act(() => {
      root.render(<DiagnosisToolCards items={[DIAGNOSIS]} />);
    });
    expect(container.textContent).toContain("简历诊断报告");
    expect(container.textContent).toContain("79");
    // 建议不随诊断铺开（诊断轮也不再有建议数据）
    expect(container.textContent).not.toContain("诊断出");
  });

  it("查看修改建议 chip sends the view message as a real conversation turn", () => {
    const sent: string[] = [];
    act(() => {
      root.render(
        <DiagnosisToolCards items={[DIAGNOSIS]} onActionClick={(m) => sent.push(m)} />,
      );
    });

    const chip = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent || "").includes("查看修改建议"),
    );
    expect(chip).toBeTruthy();
    act(() => chip!.click());
    // 点 chip = 发只读 view 消息（后端路由到 cv_suggestions_agent 建议轮），
    // 建议作为正常对话轮返回——自带思考 loading
    expect(sent).toEqual(["查看这次诊断的修改建议"]);
  });
});
