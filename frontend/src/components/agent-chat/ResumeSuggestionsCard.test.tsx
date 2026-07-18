// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ResumeSuggestionsCard from "./ResumeSuggestionsCard";
import type { ResumeSuggestion } from "@/types/resumeDiagnosis";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const base = (over: Partial<ResumeSuggestion>): ResumeSuggestion => ({
  suggestion_id: "s",
  assessment_id: "a",
  section: "experience",
  severity: "warning",
  title: "量化实习成果",
  original: "负责后端开发",
  recommendation: "补充具体指标",
  evidence: "经历里无量化数据",
  requires_facts: [],
  status: "proposed",
  ...over,
});

const PROPOSED = base({ suggestion_id: "s1", title: "量化实习成果", status: "proposed" });
const NEEDS_FACT = base({
  suggestion_id: "s2",
  section: "education",
  title: "教育经历缺院校",
  status: "needs_fact",
  requires_facts: ["院校全称", "专业名称"],
});

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find((b) =>
    (b.textContent || "").includes(text),
  );
}

describe("ResumeSuggestionsCard · 逐条改 / 一键改 三态按钮", () => {
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

  it("proposed 条渲染「帮我改这条」+「全部按建议修改」两个按钮", () => {
    act(() => {
      root.render(
        <ResumeSuggestionsCard suggestions={[PROPOSED]} onApply={() => {}} onApplyOne={() => {}} />,
      );
    });
    expect(findButton(container, "帮我改这条")).toBeTruthy();
    expect(findButton(container, "全部按建议修改")).toBeTruthy();
  });

  it("「帮我改这条」回传 1-based 序号 + 标题", () => {
    const oneCalls: Array<[number, string]> = [];
    act(() => {
      root.render(
        <ResumeSuggestionsCard
          suggestions={[PROPOSED]}
          onApply={() => {}}
          onApplyOne={(i, t) => oneCalls.push([i, t])}
        />,
      );
    });
    act(() => findButton(container, "帮我改这条")!.click());
    expect(oneCalls).toEqual([[1, "量化实习成果"]]);
  });

  it("「全部按建议修改」触发整体 apply 回调", () => {
    let all = 0;
    act(() => {
      root.render(
        <ResumeSuggestionsCard suggestions={[PROPOSED]} onApply={() => (all += 1)} onApplyOne={() => {}} />,
      );
    });
    act(() => findButton(container, "全部按建议修改")!.click());
    expect(all).toBe(1);
  });

  it("needs_fact 条只渲染「全部按建议修改」，不渲染「帮我改这条」", () => {
    act(() => {
      root.render(
        <ResumeSuggestionsCard suggestions={[NEEDS_FACT]} onApply={() => {}} onApplyOne={() => {}} />,
      );
    });
    expect(findButton(container, "帮我改这条")).toBeFalsy();
    expect(findButton(container, "全部按建议修改")).toBeTruthy();
    // needs_fact 的缺口清单仍展示
    expect(container.textContent).toContain("院校全称");
  });

  it("翻到 needs_fact 条时「帮我改这条」按钮消失（按当前分页条 status）", () => {
    act(() => {
      root.render(
        <ResumeSuggestionsCard
          suggestions={[PROPOSED, NEEDS_FACT]}
          onApply={() => {}}
          onApplyOne={() => {}}
        />,
      );
    });
    // 初始 proposed 条：有「帮我改这条」
    expect(findButton(container, "帮我改这条")).toBeTruthy();
    act(() => findButton(container, "下一条")!.click());
    // 翻到 needs_fact 条：消失
    expect(findButton(container, "帮我改这条")).toBeFalsy();
  });
});
