// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentProcessTimeline from "./AgentProcessTimeline";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import type { AgentProcessNode } from "@/types/chat";

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function thoughtBody(container: HTMLElement): HTMLElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-controls]',
  );
  const contentId = button?.getAttribute("aria-controls");
  const body = contentId ? document.getElementById(contentId) : null;
  if (!body) throw new Error("Thought body was not rendered");
  return body;
}

describe("agent thought temporal presentation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function render(ui: ReactNode) {
    act(() => root.render(ui));
  }

  it("grows an active thought instead of displaying the full burst immediately", () => {
    const content =
      "你想整体优化简历，但我还没拿到可以判断的正文。我先查看简历库，确认有哪些版本可以用来诊断。";

    render(
      <ThoughtProcess
        content={content}
        animateText
        isStreaming
        isLatest
      />,
    );

    const firstFrame = thoughtBody(container).textContent || "";
    expect(firstFrame.length).toBeGreaterThan(0);
    expect(firstFrame).not.toBe(content);

    act(() => vi.advanceTimersByTime(1_300));
    expect(thoughtBody(container).textContent).toBe(content);
  });

  it("paces a replacement from its common prefix instead of flashing the new text", () => {
    const opening = "好，我先看看当前简历。";
    const narration = "好，我来仔细看看这份简历，确认最值得优先处理的问题。";

    render(<ThoughtProcess content={opening} animateText isLatest />);
    act(() => vi.advanceTimersByTime(1_300));
    expect(thoughtBody(container).textContent).toBe(opening);

    render(<ThoughtProcess content={narration} animateText isLatest />);
    const reconciledFrame = thoughtBody(container).textContent || "";
    expect(reconciledFrame).not.toBe(narration);
    expect(narration.startsWith(reconciledFrame)).toBe(true);

    act(() => vi.advanceTimersByTime(1_300));
    expect(thoughtBody(container).textContent).toBe(narration);
  });

  it("shows the complete thought immediately when reduced motion is requested", () => {
    mockReducedMotion(true);
    const content = "这段思考不应该播放逐字动画。";

    render(<ThoughtProcess content={content} animateText isLatest />);

    expect(thoughtBody(container).textContent).toBe(content);
  });

  it("never delays a completed tool result", () => {
    const thought: AgentProcessNode = {
      id: "thought:step-1",
      kind: "thought",
      stepId: 1,
      content: "我先读取这份简历，再根据完整内容判断问题。".repeat(8),
    };
    const runningTool: AgentProcessNode = {
      id: "tool:call-1",
      kind: "tool",
      stepId: 1,
      toolCallId: "call-1",
      toolName: "get_resume_detail",
      label: "获取简历详情",
      status: "running",
    };

    const completedTool: AgentProcessNode = {
      ...runningTool,
      status: "success",
      summary: "简历详情已加载",
    };
    render(
      <AgentProcessTimeline
        nodes={[thought, completedTool]}
        isProcessing
      />,
    );
    expect(container.textContent).toContain("执行成功");
    expect(container.textContent).toContain("简历详情已加载");
  });

  it("does not run a second Tool timer when the Presentation Module owns visibility", () => {
    const thought: AgentProcessNode = {
      id: "thought:step-1",
      kind: "thought",
      stepId: 1,
      content: "我先说明接下来要做什么。",
    };
    const tool: AgentProcessNode = {
      id: "tool:call-1",
      kind: "tool",
      stepId: 1,
      toolCallId: "call-1",
      toolName: "list_resumes",
      label: "查看简历列表",
      status: "running",
    };

    render(
      <AgentProcessTimeline
        nodes={[thought, tool]}
        isProcessing
        presentationNodes={[
          { ...thought, complete: true, presentationStatus: "draining" },
          { ...tool, presentationStatus: "hidden" },
        ]}
      />,
    );
    act(() => vi.advanceTimersByTime(500));
    expect(container.textContent).not.toContain("执行中");

    render(
      <AgentProcessTimeline
        nodes={[thought, tool]}
        isProcessing
        presentationNodes={[
          { ...thought, complete: true, presentationStatus: "visible" },
          { ...tool, presentationStatus: "visible" },
        ]}
      />,
    );
    expect(container.textContent).toContain("执行中");
  });

  it("updates the running diagnosis card as each evidence stage arrives", () => {
    const diagnosisTool: AgentProcessNode = {
      id: "tool:call-diagnosis",
      kind: "tool",
      stepId: 2,
      toolCallId: "call-diagnosis",
      toolName: "cv_analyzer_agent",
      label: "简历诊断",
      status: "running",
      progress: {
        current: 3,
        total: 5,
        label: "面试风险",
        summary: "腾讯段有量化证据，另一段经历还需要补强结果数据。",
        stages: [
          "结构完整度",
          "成果证据",
          "面试风险",
          "岗位匹配",
          "汇总建议",
        ],
      },
    };

    render(
      <AgentProcessTimeline nodes={[diagnosisTool]} isProcessing />,
    );

    expect(container.textContent).toContain("诊断中 3/5");
    expect(container.textContent).toContain("当前：面试风险");
    expect(container.textContent).toContain("腾讯段有量化证据");
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it("keeps the diagnosis card mounted while newer progress thoughts arrive", () => {
    const stages = [
      "结构完整度",
      "成果证据",
      "面试风险",
      "岗位匹配",
      "汇总建议",
    ];
    const progressThought = (stage: number): AgentProcessNode => ({
      id: `tool-progress:call-diagnosis:stage-${stage}`,
      kind: "thought",
      stepId: 2,
      content: `第 ${stage} 阶段诊断结论。`,
    });
    const progressTool = (stage: number): AgentProcessNode => ({
      id: "tool:call-diagnosis",
      kind: "tool",
      stepId: 2,
      toolCallId: "call-diagnosis",
      toolName: "cv_analyzer_agent",
      label: "简历诊断",
      status: "running",
      progress: {
        current: stage,
        total: stages.length,
        label: stages[stage - 1],
        summary: `第 ${stage} 阶段诊断结论。`,
        stages,
      },
    });

    render(
      <AgentProcessTimeline
        nodes={[progressThought(1), progressTool(1)]}
        isProcessing
      />,
    );
    const initialCard = container.querySelector(
      '[data-tool-call-id="call-diagnosis"]',
    );
    expect(initialCard).not.toBeNull();

    render(
      <AgentProcessTimeline
        nodes={[progressThought(1), progressThought(2), progressTool(2)]}
        isProcessing
      />,
    );
    expect(
      container.querySelector('[data-tool-call-id="call-diagnosis"]'),
    ).toBe(initialCard);
    expect(container.textContent).toContain("诊断中 2/5");
  });
});
