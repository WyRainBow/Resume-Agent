// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "@/types/chat";
import ConversationFeedbackBar from "./ConversationFeedbackBar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const MESSAGES: Message[] = [
  { id: "u1", role: "user", content: "帮我优化简历", timestamp: "t1" },
  { id: "a1", role: "assistant", content: "第一轮回复", timestamp: "t2" },
  { id: "a2", role: "assistant", content: "最终回复内容", timestamp: "t3" },
];

describe("ConversationFeedbackBar", () => {
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

  it("renders one single bar bound to the latest assistant reply when idle", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    act(() => {
      root.render(
        <ConversationFeedbackBar
          messages={MESSAGES}
          isProcessing={false}
          onRegenerate={vi.fn()}
        />,
      );
    });

    const copyButton = container.querySelector<HTMLButtonElement>(
      'button[title="复制最新回复"]',
    );
    expect(copyButton).not.toBeNull();
    act(() => copyButton!.click());
    // 复制的是最后一条 assistant 的内容，不是中间轮次
    expect(writeText).toHaveBeenCalledWith("最终回复内容");
  });

  it("stays hidden while streaming and when no assistant reply exists", () => {
    act(() => {
      root.render(
        <ConversationFeedbackBar
          messages={MESSAGES}
          isProcessing={true}
          onRegenerate={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toBe("");

    act(() => {
      root.render(
        <ConversationFeedbackBar
          messages={[MESSAGES[0]]}
          isProcessing={false}
          onRegenerate={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toBe("");
  });
});
