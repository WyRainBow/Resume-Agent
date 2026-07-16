// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StreamingOutputPanel from "./StreamingOutputPanel";
import StreamingResponse from "./StreamingResponse";
import { createConversationRunState } from "@/agent-presentation/ConversationRunReducer";
import type { ConversationRunState } from "@/agent-presentation/model";

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

function makeRun(
  runId: string,
  options: {
    thought?: string;
    answer?: string;
    sourceComplete?: boolean;
    artifacts?: boolean;
    process?: ConversationRunState["process"];
  } = {},
): ConversationRunState {
  return {
    ...createConversationRunState(runId),
    sourceStatus: options.sourceComplete ? "completed" : "streaming",
    process:
      options.process ??
      (options.thought
        ? [
            {
              id: `thought:${runId}`,
              kind: "thought",
              stepId: 1,
              content: options.thought,
              complete: true,
            },
          ]
        : []),
    response: {
      sourceText: options.answer || "",
      sourceComplete: Boolean(options.sourceComplete),
    },
    artifacts: options.artifacts
      ? [
          {
            artifactId: `artifact:${runId}`,
            kind: "search_result",
            payload: {
              query: "工具结果卡片",
              total_results: 1,
              results: [],
            },
          },
        ]
      : [],
  };
}

describe("streaming response temporal presentation", () => {
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

  it("holds a short initial loading window before revealing buffered thought", () => {
    const thought = "你只是先来打个招呼，我先轻松接住这句话。";
    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-1", { thought })}
        isProcessing
      />,
    );

    expect(container.textContent).toContain("正在思考…");
    expect(container.textContent).not.toContain(thought);

    act(() => vi.advanceTimersByTime(959));
    expect(container.textContent).toContain("正在思考…");
    expect(container.textContent).not.toContain(thought);

    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain("正在思考…");
    expect(container.textContent).not.toContain(thought);
    expect(container.textContent).toContain("思考过程");
  });

  it("restarts the loading and thought sequence for an identical next run", () => {
    const thought = "你只是先来打个招呼，我先轻松接住这句话。";
    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-10", { thought })}
        isProcessing
      />,
    );
    act(() => vi.advanceTimersByTime(960));
    act(() => vi.advanceTimersByTime(1_500));

    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-11", { thought })}
        isProcessing
      />,
    );
    expect(container.textContent).toContain("正在思考…");
    expect(container.textContent).not.toContain("思考过程");

    act(() => vi.advanceTimersByTime(960));
    expect(container.textContent).toContain("思考过程");
    expect(container.textContent).not.toContain(thought);
  });

  it("grows a completed response before notifying cards to continue", () => {
    const onComplete = vi.fn();
    const content =
      "嘿～我是 coco，你的简历搭子。看到你还没加载简历，是想从零开始写一份，还是一起打磨现有简历？";

    render(
      <StreamingResponse
        content={content}
        canStart
        isStreaming
        sourceComplete
        onTypewriterComplete={onComplete}
      />,
    );

    expect(container.textContent).not.toContain(content);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_500));
    expect(container.textContent).toContain(content);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("shows a genuine response loading state after thought and before answer", () => {
    const bufferedAnswer = "嘿～我是 coco，你的简历搭子。";
    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-2", {
          thought: "你只是先来打个招呼，我先轻松接住这句话。",
          answer: bufferedAnswer,
        })}
        isProcessing
      />,
    );

    expect(container.textContent).not.toContain("正在组织回复…");
    expect(container.textContent).not.toContain(bufferedAnswer);

    act(() => vi.advanceTimersByTime(960));
    act(() => vi.advanceTimersByTime(1_500));
    expect(container.textContent).toContain("正在组织回复…");
    expect(container.textContent).not.toContain(bufferedAnswer);
  });

  it("keeps artifact cards hidden while the response is still being presented", () => {
    const content = "我先把结论说清楚，再展示后续卡片。";
    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-3", {
          thought: "我已经整理好结果。",
          answer: content,
          sourceComplete: true,
          artifacts: true,
        })}
        isProcessing
      />,
    );

    expect(container.textContent).not.toContain("工具结果卡片");
    expect(container.textContent).not.toContain(content);
  });

  it("does not strand card-only turns when there is no visible response", () => {
    const onComplete = vi.fn();
    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-4", {
          thought: "工具结果已经准备好了。",
          sourceComplete: true,
          artifacts: true,
        })}
        isProcessing
        onResponseTypewriterComplete={onComplete}
      />,
    );

    expect(container.textContent).not.toContain("工具结果卡片");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(960));
    act(() => vi.advanceTimersByTime(1_500));
    expect(container.textContent).toContain("工具结果卡片");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not claim to organize a reply while a diagnosis tool is still running", () => {
    render(
      <StreamingOutputPanel
        conversationRun={makeRun("run-5", {
          process: [
            {
              id: "thought:diagnosis-stage-1",
              kind: "thought",
              stepId: 2,
              content: "先核对结构完整度：教育经历已加载。",
              complete: true,
            },
            {
              id: "tool:call-diagnosis",
              kind: "tool",
              stepId: 2,
              toolCallId: "call-diagnosis",
              toolName: "cv_analyzer_agent",
              status: "running",
            },
          ],
        })}
        isProcessing
      />,
    );

    act(() => vi.advanceTimersByTime(960));
    act(() => vi.advanceTimersByTime(1_500));

    expect(container.textContent).toContain("简历诊断");
    expect(container.textContent).not.toContain("正在组织回复…");
  });

  it("renders the canonical run directly without rebuilding it from legacy props", () => {
    mockReducedMotion(true);
    const run = {
      ...createConversationRunState("canonical-run"),
      sourceStatus: "streaming" as const,
      process: [
        {
          id: "tool:canonical",
          kind: "tool" as const,
          stepId: 1,
          toolCallId: "canonical",
          toolName: "cv_analyzer_agent",
          status: "running" as const,
        },
      ],
    };

    render(
      <StreamingOutputPanel
        conversationRun={run}
        isProcessing
      />,
    );

    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).toContain("简历诊断");
  });

  it("keeps a failed terminal run visible after network processing stops", () => {
    render(
      <StreamingOutputPanel
        conversationRun={{
          ...createConversationRunState("failed-run"),
          sourceStatus: "failed",
          error: "模型请求失败",
        }}
        isProcessing={false}
      />,
    );

    expect(container.textContent).toContain("模型请求失败");
    expect(container.textContent).not.toContain("正在思考");
  });
});
