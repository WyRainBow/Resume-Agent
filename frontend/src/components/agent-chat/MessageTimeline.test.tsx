// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "@/types/chat";
import MessageTimeline from "./MessageTimeline";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const BASE_PROPS = {
  loadedResumes: [],
  searchResults: [],
  resumeEditDiffs: [],
  diagnosisToolEvents: [],
  structuredEvents: [],
  copiedId: null,
  stripResumeEditMarkdown: (content: string) => content,
  onSetCopiedId: vi.fn(),
  onOpenSearchPanel: vi.fn(),
  onOpenResume: vi.fn(),
  onOpenResumeSelector: vi.fn(),
};

describe("MessageTimeline · 用户气泡长文折叠", () => {
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

  it("collapses JD optimize messages into a one-line summary (issue P3)", () => {
    const jdBody = "负责 AI Agent 平台研发……".repeat(20);
    const messages: Message[] = [
      {
        id: "u-jd",
        role: "user",
        content: `我的目标岗位 JD 如下，请对照它逐条优化我的整份简历：重写各段经历。\n\n【目标岗位 JD】\n${jdBody}`,
        timestamp: "t1",
      },
    ];

    act(() => {
      root.render(<MessageTimeline {...BASE_PROPS} messages={messages} />);
    });

    expect(container.textContent).toContain(
      "我提供了目标岗位 JD，请按它优化整份简历",
    );
    // JD 全文不再刷屏进气泡
    expect(container.textContent).not.toContain(jdBody.slice(0, 40));
  });

  it("keeps ordinary user messages verbatim", () => {
    const messages: Message[] = [
      { id: "u-1", role: "user", content: "帮我优化实习经历", timestamp: "t1" },
    ];
    act(() => {
      root.render(<MessageTimeline {...BASE_PROPS} messages={messages} />);
    });
    expect(container.textContent).toContain("帮我优化实习经历");
  });
});
