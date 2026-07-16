// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SSEEvent } from "@/transports/SSETransport";
import { useToolEventRouter } from "./useToolEventRouter";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

type Handler = (event: SSEEvent) => void;

function makeParams() {
  return {
    runId: 1,
    onDone: vi.fn(),
    onError: vi.fn(),
    onShowResumeSelector: vi.fn(),
    onResumeUpdated: vi.fn(),
    upsertSearchResult: vi.fn(),
    upsertLoadedResume: vi.fn(),
    upsertResumeEditDiff: vi.fn(),
    upsertDiagnosisToolEvent: vi.fn(),
    upsertStructuredEvent: vi.fn(),
    applyResumeEditDiff: vi.fn(),
  };
}

function Harness({
  params,
  onReady,
}: {
  params: ReturnType<typeof makeParams>;
  onReady: (handler: Handler) => void;
}) {
  const { handleSSEEvent } = useToolEventRouter(params);
  onReady(handleSSEEvent);
  return null;
}

describe("useToolEventRouter · show_resume 面板触发", () => {
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

  async function drive(params: ReturnType<typeof makeParams>, events: SSEEvent[]) {
    let handler: Handler = () => {};
    act(() => {
      root.render(<Harness params={params} onReady={(h) => (handler = h)} />);
    });
    await act(async () => {
      for (const event of events) handler(event);
      // done 分支经 setTimeout(0) 触发 onShowResumeSelector，等一个宏任务
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("opens the selector when show_resume returns a resume_selector structured payload", async () => {
    // 8de17bd3 回归锁：resume_selector 归 process_only 后，若 show_resume 的
    // 工具名分支排在 classify 早退之后，本事件会被吞、面板永远弹不出。
    const params = makeParams();
    await drive(params, [
      {
        type: "tool_result",
        id: "evt-selector",
        data: {
          tool: "show_resume",
          structured_data: {
            type: "resume_selector",
            required: true,
            message: "Please choose a resume: create new or select existing.",
          },
        },
      } as unknown as SSEEvent,
      { type: "done" } as unknown as SSEEvent,
    ]);

    expect(params.onShowResumeSelector).toHaveBeenCalledTimes(1);
    // 裸卡防线不回归：效果信号不进通用结构化卡管线
    expect(params.upsertStructuredEvent).not.toHaveBeenCalled();
  });

  it("opens the selector for show_resume regardless of structured payload shape", async () => {
    const withResume = makeParams();
    await drive(withResume, [
      {
        type: "tool_result",
        id: "evt-resume",
        data: {
          tool: "show_resume",
          structured_data: { type: "resume", resume_id: "r1", name: "张露巍" },
        },
      } as unknown as SSEEvent,
      { type: "done" } as unknown as SSEEvent,
    ]);
    expect(withResume.onShowResumeSelector).toHaveBeenCalledTimes(1);

    const noStructured = makeParams();
    await drive(noStructured, [
      {
        type: "tool_result",
        id: "evt-plain",
        data: { tool: "show_resume", content: "panel opened" },
      } as unknown as SSEEvent,
      { type: "done" } as unknown as SSEEvent,
    ]);
    expect(noStructured.onShowResumeSelector).toHaveBeenCalledTimes(1);
  });
});
