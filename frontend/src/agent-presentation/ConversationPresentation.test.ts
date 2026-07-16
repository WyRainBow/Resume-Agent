import { describe, expect, it } from "vitest";

import {
  createConversationPresentationState,
  reduceConversationPresentation,
  selectConversationPresentation,
} from "./ConversationPresentation";
import { createConversationRunState } from "./ConversationRunReducer";

describe("ConversationPresentation", () => {
  it("holds a distinct Opening for every run even when source content is already buffered", () => {
    const run = {
      ...createConversationRunState("run-opening"),
      sourceStatus: "streaming" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "我先看看你现有的简历情况。",
          complete: true,
        },
      ],
    };
    const initial = createConversationPresentationState("run-opening");

    expect(selectConversationPresentation(run, initial)).toEqual(
      expect.objectContaining({
        runId: "run-opening",
        phase: "opening",
        showOpeningLoading: true,
        activeProcessNodeId: "thought:step-1",
      }),
    );

    const released = reduceConversationPresentation(initial, {
      type: "opening.elapsed",
      runId: "run-opening",
    });
    expect(selectConversationPresentation(run, released)).toEqual(
      expect.objectContaining({
        phase: "presenting_process",
        showOpeningLoading: false,
      }),
    );
  });

  it("releases a running Tool from the real Thought presentation signal, not a blind delay", () => {
    const run = {
      ...createConversationRunState("run-tool-release"),
      sourceStatus: "streaming" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "我先读取完整内容，确认有哪些证据可以支撑诊断。",
          complete: true,
        },
        {
          id: "tool:call-1",
          kind: "tool" as const,
          stepId: 1,
          toolCallId: "call-1",
          toolName: "get_resume_detail",
          status: "running" as const,
        },
      ],
    };
    const openingReleased = reduceConversationPresentation(
      createConversationPresentationState("run-tool-release"),
      { type: "opening.elapsed", runId: "run-tool-release" },
    );

    expect(
      selectConversationPresentation(run, openingReleased).process.map((node) => [
        node.id,
        node.presentationStatus,
      ]),
    ).toEqual([
      ["thought:step-1", "draining"],
      ["tool:call-1", "hidden"],
    ]);

    const acknowledged = reduceConversationPresentation(openingReleased, {
      type: "process.segmentPresented",
      runId: "run-tool-release",
      nodeId: "thought:step-1",
    });
    expect(
      selectConversationPresentation(run, acknowledged).process.map((node) => [
        node.id,
        node.presentationStatus,
      ]),
    ).toEqual([
      ["thought:step-1", "visible"],
      ["tool:call-1", "visible"],
    ]);
  });

  it("uses the Tool wait deadline only as a fallback when the presentation signal is missing", () => {
    const run = {
      ...createConversationRunState("run-tool-timeout"),
      sourceStatus: "streaming" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "我先说明接下来要做什么。",
          complete: true,
        },
        {
          id: "tool:call-1",
          kind: "tool" as const,
          stepId: 1,
          toolCallId: "call-1",
          toolName: "list_resumes",
          status: "running" as const,
        },
      ],
    };
    const openingReleased = reduceConversationPresentation(
      createConversationPresentationState("run-tool-timeout"),
      { type: "opening.elapsed", runId: "run-tool-timeout" },
    );
    const timedOut = reduceConversationPresentation(openingReleased, {
      type: "process.waitElapsed",
      runId: "run-tool-timeout",
      nodeId: "thought:step-1",
    });

    expect(
      selectConversationPresentation(run, timedOut).process.find(
        (node) => node.kind === "tool",
      )?.presentationStatus,
    ).toBe("visible");
  });

  it("releases Response after process acknowledgement and releases Artifacts after Response", () => {
    const run = {
      ...createConversationRunState("run-response"),
      sourceStatus: "completed" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "诊断已经完成，我来总结重点。",
          complete: true,
        },
      ],
      response: {
        sourceText: "整体基础不错，优先补强成果证据。",
        sourceComplete: true,
      },
      artifacts: [
        {
          artifactId: "diagnosis-1",
          kind: "resume_diagnosis",
          payload: { type: "resume_diagnosis", overall_score: 82 },
        },
      ],
    };
    let state = createConversationPresentationState("run-response");
    state = reduceConversationPresentation(state, {
      type: "opening.elapsed",
      runId: "run-response",
    });
    state = reduceConversationPresentation(state, {
      type: "process.segmentPresented",
      runId: "run-response",
      nodeId: "thought:step-1",
    });

    expect(selectConversationPresentation(run, state)).toEqual(
      expect.objectContaining({
        phase: "waiting_for_response",
        canPresentResponse: false,
        showArtifacts: false,
      }),
    );

    state = reduceConversationPresentation(state, {
      type: "response.bridgeElapsed",
      runId: "run-response",
    });
    expect(selectConversationPresentation(run, state)).toEqual(
      expect.objectContaining({
        phase: "presenting_response",
        canPresentResponse: true,
        showArtifacts: false,
      }),
    );

    state = reduceConversationPresentation(state, {
      type: "response.presented",
      runId: "run-response",
    });
    expect(selectConversationPresentation(run, state)).toEqual(
      expect.objectContaining({
        phase: "presenting_artifacts",
        canPresentResponse: true,
        showArtifacts: true,
      }),
    );
  });

  it("presents buffered ReAct thoughts sequentially instead of typing every step at once", () => {
    const run = {
      ...createConversationRunState("run-sequential"),
      sourceStatus: "streaming" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "先查看简历列表。",
          complete: true,
        },
        {
          id: "tool:step-1",
          kind: "tool" as const,
          stepId: 1,
          toolCallId: "call-1",
          toolName: "list_resumes",
          status: "success" as const,
        },
        {
          id: "thought:step-2",
          kind: "thought" as const,
          stepId: 2,
          content: "再读取完整简历。",
          complete: true,
        },
      ],
    };
    const openingReleased = reduceConversationPresentation(
      createConversationPresentationState(run.runId),
      { type: "opening.elapsed", runId: run.runId },
    );

    expect(
      selectConversationPresentation(run, openingReleased).process.map((node) => [
        node.id,
        node.presentationStatus,
      ]),
    ).toEqual([
      ["thought:step-1", "draining"],
      ["tool:step-1", "hidden"],
      ["thought:step-2", "hidden"],
    ]);
  });

  it("does not reveal the next thought or response while an earlier tool is running", () => {
    const run = {
      ...createConversationRunState("run-running-tool"),
      sourceStatus: "completed" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "先读取简历。",
          complete: true,
        },
        {
          id: "tool:step-1",
          kind: "tool" as const,
          stepId: 1,
          toolCallId: "call-1",
          toolName: "get_resume_detail",
          status: "running" as const,
        },
        {
          id: "thought:step-2",
          kind: "thought" as const,
          stepId: 2,
          content: "再开始诊断。",
          complete: true,
        },
      ],
      response: { sourceText: "诊断完成。", sourceComplete: true },
    };
    const state = {
      ...createConversationPresentationState(run.runId),
      openingReleased: true,
      presentedProcessNodeIds: ["thought:step-1"],
      responseBridgeReleased: true,
    };

    const presentation = selectConversationPresentation(run, state);

    expect(
      presentation.process.find((node) => node.id === "thought:step-2")
        ?.presentationStatus,
    ).toBe("hidden");
    expect(presentation.canPresentResponse).toBe(false);
  });

  it("releases suggestions at the tail even when the run has no artifacts", () => {
    const run = {
      ...createConversationRunState("run-suggestions"),
      sourceStatus: "completed" as const,
      response: { sourceText: "你好，我是 coco。", sourceComplete: true },
      suggestions: [{ text: "导入简历", msg: "我要导入简历" }],
    };
    const state = {
      ...createConversationPresentationState(run.runId),
      openingReleased: true,
      responseBridgeReleased: true,
      responsePresented: true,
    };

    expect(selectConversationPresentation(run, state)).toEqual(
      expect.objectContaining({
        phase: "presenting_artifacts",
        showArtifacts: true,
      }),
    );
  });

  it("shows an artifact-only tail once its process and source are complete", () => {
    const run = {
      ...createConversationRunState("run-artifact-only"),
      sourceStatus: "completed" as const,
      response: { sourceText: "", sourceComplete: true },
      artifacts: [
        {
          artifactId: "artifact-only",
          kind: "resume_diagnosis",
          payload: { type: "resume_diagnosis", overall_score: 82 },
        },
      ],
    };
    const ready = {
      ...createConversationPresentationState(run.runId),
      openingReleased: true,
      responseBridgeReleased: true,
    };

    expect(selectConversationPresentation(run, ready)).toEqual(
      expect.objectContaining({
        phase: "presenting_artifacts",
        canPresentResponse: true,
        showArtifacts: true,
      }),
    );
  });

  it("interrupts the opening immediately when the run fails", () => {
    const run = {
      ...createConversationRunState("run-failed"),
      sourceStatus: "failed" as const,
      error: "模型请求失败",
    };

    expect(
      selectConversationPresentation(
        run,
        createConversationPresentationState(run.runId),
      ),
    ).toEqual(
      expect.objectContaining({
        phase: "failed",
        showOpeningLoading: false,
        error: "模型请求失败",
      }),
    );
  });
});
