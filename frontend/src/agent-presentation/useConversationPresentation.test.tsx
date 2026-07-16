// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConversationRunState } from "./ConversationRunReducer";
import {
  useConversationPresentation,
  type UseConversationPresentationResult,
} from "./useConversationPresentation";
import type { ConversationRunState } from "./model";

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({
  run,
  onChange,
}: {
  run: ConversationRunState;
  onChange: (value: UseConversationPresentationResult) => void;
}) {
  const value = useConversationPresentation({ run });
  useEffect(() => {
    onChange(value);
  }, [onChange, value]);
  return null;
}

describe("useConversationPresentation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("drives the 960ms Opening through the presentation Interface", () => {
    const run: ConversationRunState = {
      ...createConversationRunState("run-hook"),
      sourceStatus: "streaming",
      process: [
        {
          id: "thought:step-1",
          kind: "thought",
          stepId: 1,
          content: "我先看看你现有的简历情况。",
          complete: true,
        },
      ],
    };
    let latest!: UseConversationPresentationResult;
    act(() => {
      root.render(
        <Harness
          run={run}
          onChange={(value) => {
            latest = value;
          }}
        />,
      );
    });

    expect(latest.model.phase).toBe("opening");
    act(() => vi.advanceTimersByTime(959));
    expect(latest.model.phase).toBe("opening");
    act(() => vi.advanceTimersByTime(1));
    expect(latest.model.phase).toBe("presenting_process");
  });

  it("falls back after 350ms when a draining Thought never acknowledges presentation", () => {
    const run: ConversationRunState = {
      ...createConversationRunState("run-tool-wait"),
      sourceStatus: "streaming",
      process: [
        {
          id: "thought:step-1",
          kind: "thought",
          stepId: 1,
          content: "我先说明下一步动作。",
          complete: true,
        },
        {
          id: "tool:call-1",
          kind: "tool",
          stepId: 1,
          toolCallId: "call-1",
          toolName: "list_resumes",
          status: "running",
        },
      ],
    };
    let latest!: UseConversationPresentationResult;
    act(() => {
      root.render(
        <Harness
          run={run}
          onChange={(value) => {
            latest = value;
          }}
        />,
      );
    });
    act(() => vi.advanceTimersByTime(960));
    const toolStatus = () =>
      latest.model.process.find((node) => node.kind === "tool")
        ?.presentationStatus;

    expect(toolStatus()).toBe("hidden");
    act(() => vi.advanceTimersByTime(349));
    expect(toolStatus()).toBe("hidden");
    act(() => vi.advanceTimersByTime(1));
    expect(toolStatus()).toBe("visible");
  });

  it("uses a 160ms bridge after the real Thought acknowledgement before Response", () => {
    const run: ConversationRunState = {
      ...createConversationRunState("run-response-bridge"),
      sourceStatus: "completed",
      process: [
        {
          id: "thought:step-1",
          kind: "thought",
          stepId: 1,
          content: "诊断完成，我来总结。",
          complete: true,
        },
      ],
      response: {
        sourceText: "整体基础不错，先补强成果证据。",
        sourceComplete: true,
      },
    };
    let latest!: UseConversationPresentationResult;
    act(() => {
      root.render(
        <Harness
          run={run}
          onChange={(value) => {
            latest = value;
          }}
        />,
      );
    });
    act(() => vi.advanceTimersByTime(960));
    act(() =>
      latest.acknowledge({
        type: "process.segmentPresented",
        nodeId: "thought:step-1",
      }),
    );

    expect(latest.model.phase).toBe("waiting_for_response");
    act(() => vi.advanceTimersByTime(159));
    expect(latest.model.phase).toBe("waiting_for_response");
    act(() => vi.advanceTimersByTime(1));
    expect(latest.model.phase).toBe("presenting_response");
  });
});
