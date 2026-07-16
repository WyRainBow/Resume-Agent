// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StructuredCards } from "./StructuredCardRegistry";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const SUGGESTIONS_EVENT = {
  type: "resume_suggestions",
  kind: "resume_suggestions",
  schema_version: "2.0",
  artifact_id: "suggestions_assessment_x",
  source: { skill: "resume-suggest", assessment_id: "assessment_x" },
  payload: {
    assessment_id: "assessment_x",
    suggestions: [
      {
        suggestion_id: "s1",
        assessment_id: "assessment_x",
        section: "basic",
        severity: "warning" as const,
        title: "更换更专业的联系邮箱",
        original: "3658043236@qq.com",
        recommendation: "建议替换为个人域名邮箱。",
        evidence: "纯数字 QQ 邮箱显随意。",
        requires_facts: [],
        status: "proposed" as const,
      },
    ],
  },
};

describe("StructuredCards · resume_suggestions 建议卡（2026-07-16 拆分）", () => {
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

  it("renders the suggestions card with an apply chip that sends a real turn", () => {
    const sent: string[] = [];
    act(() => {
      root.render(
        <StructuredCards
          items={[SUGGESTIONS_EVENT]}
          onAction={(m) => sent.push(m)}
        />,
      );
    });

    // 专属建议卡（不是裸 JSON 兜底）
    expect(container.textContent).toContain("简历修改建议");
    expect(container.textContent).toContain("更换更专业的联系邮箱");
    expect(container.textContent).not.toContain('"suggestion_id"');

    // apply chip → 发真实一轮 apply 消息
    const applyChip = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent || "").includes("帮我按建议修改"),
    );
    expect(applyChip).toBeTruthy();
    act(() => applyChip!.click());
    expect(sent).toEqual(["按照诊断建议帮我修改简历"]);
  });

  it("skips rendering gracefully when payload has no suggestions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => {
      root.render(
        <StructuredCards
          items={[{ ...SUGGESTIONS_EVENT, payload: { suggestions: [] } }]}
        />,
      );
    });
    // 数据缺失兜底：不崩、不渲染裸 JSON
    expect(container.textContent).not.toContain("简历修改建议");
    warn.mockRestore();
  });
});
