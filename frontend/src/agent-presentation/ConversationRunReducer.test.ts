import { describe, expect, it } from "vitest";

import {
  createConversationRunState,
  reduceConversationRun,
} from "./ConversationRunReducer";
import type { CanonicalConversationEvent } from "./events";

function canonical(
  event: Omit<CanonicalConversationEvent, "eventId" | "runId" | "seq" | "sequenceSource" | "at"> &
    Partial<Pick<CanonicalConversationEvent, "eventId" | "runId" | "seq">>,
): CanonicalConversationEvent {
  return {
    eventId: event.eventId ?? crypto.randomUUID(),
    runId: event.runId ?? "run-1",
    seq: event.seq ?? 1,
    sequenceSource: "arrival",
    at: 1,
    ...event,
  } as CanonicalConversationEvent;
}

describe("ConversationRunReducer", () => {
  it("does not let a late lower server sequence overwrite newer state", () => {
    const state = {
      ...createConversationRunState("run-server-order"),
      lastSeq: 12,
      nextServerSeq: 13,
      response: { sourceText: "新回答", sourceComplete: false },
    };

    const result = reduceConversationRun(state, {
      type: "response.updated",
      eventId: "evt-old",
      runId: "run-server-order",
      seq: 11,
      sequenceSource: "server",
      at: 1,
      content: "旧回答",
      complete: true,
    });

    expect(result).toBe(state);
  });

  it("buffers a server gap and reapplies tool events in sequence order", () => {
    const completed = {
      type: "tool.completed" as const,
      eventId: "evt-tool-completed",
      runId: "run-server-tool-order",
      seq: 12,
      sequenceSource: "server" as const,
      at: 1,
      stepId: 2,
      toolCallId: "call-1",
      toolName: "cv_analyzer_agent",
      outcome: "success" as const,
      result: "done",
    };
    const staleStart = {
      type: "tool.started" as const,
      eventId: "evt-tool-started",
      runId: "run-server-tool-order",
      seq: 11,
      sequenceSource: "server" as const,
      at: 1,
      stepId: 2,
      toolCallId: "call-1",
      toolName: "cv_analyzer_agent",
      args: {},
    };

    const state = reduceConversationRun(
      {
        ...createConversationRunState("run-server-tool-order"),
        nextServerSeq: 11,
      },
      completed,
    );
    expect(state.process).toEqual([]);
    expect(state.pendingServerEvents[12]).toEqual(completed);

    const result = reduceConversationRun(state, staleStart);

    expect(result.process[0]).toEqual(
      expect.objectContaining({ status: "success" }),
    );
    expect(result.pendingServerEvents).toEqual({});
    expect(result.nextServerSeq).toBe(13);
  });

  it("does not let done overwrite a failed terminal state", () => {
    const failed = canonical({
      eventId: "evt-failed",
      type: "run.failed",
      message: "upstream failed",
    });
    const done = canonical({
      eventId: "evt-done-after-failure",
      seq: 2,
      type: "run.sourceCompleted",
    });

    const state = [failed, done].reduce(
      reduceConversationRun,
      createConversationRunState("run-1"),
    );

    expect(state.sourceStatus).toBe("failed");
    expect(state.error).toBe("upstream failed");
    expect(state.response.sourceComplete).toBe(true);
  });

  it("does not let late content mutate a cancelled terminal run", () => {
    const cancelled = canonical({
      eventId: "evt-cancelled-terminal",
      type: "run.cancelled",
      reason: "user_stop",
      message: "stopped",
    });
    const lateResponse = canonical({
      eventId: "evt-late-response",
      seq: 2,
      type: "response.updated",
      content: "late content",
      complete: true,
    });

    const state = [cancelled, lateResponse].reduce(
      reduceConversationRun,
      createConversationRunState("run-1"),
    );

    expect(state.sourceStatus).toBe("cancelled");
    expect(state.response.sourceText).toBe("");
  });

  it("owns one ordered and idempotent Thought/Tool process for the active run", () => {
    const tool = canonical({
      eventId: "evt-tool",
      type: "tool.started",
      stepId: 2,
      toolCallId: "call-2",
      toolName: "cv_analyzer_agent",
      args: {},
    });
    const thought = canonical({
      eventId: "evt-thought",
      seq: 2,
      type: "thought.upserted",
      stepId: 2,
      nodeId: "thought:step-2",
      content: "我会从结构、证据、面试风险和岗位匹配四个方面检查。",
      complete: true,
    });

    const started = reduceConversationRun(
      createConversationRunState("run-1"),
      tool,
    );
    const ordered = reduceConversationRun(started, thought);
    const duplicate = reduceConversationRun(ordered, thought);

    expect(duplicate.process).toEqual([
      expect.objectContaining({
        id: "thought:step-2",
        kind: "thought",
        stepId: 2,
      }),
      expect.objectContaining({
        id: "tool:call-2",
        kind: "tool",
        stepId: 2,
        status: "running",
      }),
    ]);
    expect(duplicate.seenEventIds).toEqual([
      "evt-tool",
      "evt-thought",
    ]);
  });

  it("keeps response source completion separate from visual presentation completion", () => {
    const chunk = canonical({
      eventId: "evt-answer-chunk",
      type: "response.updated",
      content: "嘿～",
      delta: "嘿～",
      complete: false,
    });
    const answer = canonical({
      eventId: "evt-answer-complete",
      seq: 2,
      type: "response.updated",
      content: "嘿～我是 coco。",
      complete: true,
    });
    const done = canonical({
      eventId: "evt-done",
      seq: 3,
      type: "run.sourceCompleted",
    });

    const withChunk = reduceConversationRun(
      createConversationRunState("run-1"),
      chunk,
    );
    const withAnswer = reduceConversationRun(withChunk, answer);
    const completed = reduceConversationRun(withAnswer, done);

    expect(completed.response).toEqual({
      sourceText: "嘿～我是 coco。",
      sourceComplete: true,
    });
    expect(completed.sourceStatus).toBe("completed");
    expect(completed).not.toHaveProperty("presentationComplete", true);
  });

  it("updates one running tool monotonically when progress events arrive late", () => {
    const started = canonical({
      eventId: "evt-start",
      type: "tool.started",
      stepId: 2,
      toolCallId: "call-progress",
      toolName: "cv_analyzer_agent",
      args: {},
    });
    const stageThree = canonical({
      eventId: "evt-stage-3",
      seq: 2,
      type: "tool.progressed",
      toolCallId: "call-progress",
      stageId: "stage-3",
      current: 3,
      total: 5,
      label: "面试风险",
      summary: "正在检查面试追问风险。",
    });
    const lateStageTwo = canonical({
      eventId: "evt-stage-2",
      seq: 3,
      type: "tool.progressed",
      toolCallId: "call-progress",
      stageId: "stage-2",
      current: 2,
      total: 5,
      label: "成果证据",
      summary: "正在检查成果证据。",
    });

    const state = [started, stageThree, lateStageTwo].reduce(
      reduceConversationRun,
      createConversationRunState("run-1"),
    );
    const tool = state.process.find((node) => node.kind === "tool");

    expect(tool).toEqual(
      expect.objectContaining({
        status: "running",
        progress: expect.objectContaining({
          stageId: "stage-3",
          current: 3,
          label: "面试风险",
        }),
      }),
    );
  });

  it("keeps tool execution in the process and emits only business results as artifacts", () => {
    const started = canonical({
      eventId: "evt-diagnosis-start",
      type: "tool.started",
      stepId: 2,
      toolCallId: "call-diagnosis",
      toolName: "cv_analyzer_agent",
      args: {},
    });
    const completed = canonical({
      eventId: "evt-diagnosis-complete",
      seq: 2,
      type: "tool.completed",
      stepId: 2,
      toolCallId: "call-diagnosis",
      toolName: "cv_analyzer_agent",
      outcome: "success",
      result: "diagnosis ready",
      structuredData: {
        type: "resume_diagnosis",
        overall_score: 82,
      },
    });

    const state = [started, completed].reduce(
      reduceConversationRun,
      createConversationRunState("run-1"),
    );

    expect(state.process).toContainEqual(
      expect.objectContaining({
        id: "tool:call-diagnosis",
        status: "success",
      }),
    );
    expect(state.artifacts).toEqual([
      {
        artifactId: "call-diagnosis:resume_diagnosis",
        kind: "resume_diagnosis",
        payload: {
          type: "resume_diagnosis",
          overall_score: 82,
        },
        sourceToolCallId: "call-diagnosis",
      },
    ]);
  });

  it("does not duplicate artifacts that have a dedicated top-level event", () => {
    const toolResult = canonical({
      eventId: "evt-patch-tool-result",
      type: "tool.completed",
      stepId: 2,
      toolCallId: "call-patch",
      toolName: "cv_editor_agent",
      outcome: "success",
      result: "patch ready",
      structuredData: {
        type: "resume_patch",
        patch_id: "patch-1",
        summary: "补充量化成果",
      },
    });
    const patchEvent = canonical({
      eventId: "evt-patch",
      seq: 2,
      type: "artifact.upserted",
      artifactId: "patch-1",
      kind: "resume_patch",
      payload: { patch_id: "patch-1", summary: "补充量化成果" },
    });

    const state = [toolResult, patchEvent].reduce(
      reduceConversationRun,
      createConversationRunState("run-1"),
    );

    expect(state.artifacts).toEqual([
      expect.objectContaining({ artifactId: "patch-1", kind: "resume_patch" }),
    ]);
  });

  it("upserts run-scoped artifacts and suggestions without temporary message ids", () => {
    const patch = canonical({
      eventId: "evt-patch",
      type: "artifact.upserted",
      artifactId: "patch-1",
      kind: "resume_patch",
      payload: { patch_id: "patch-1", summary: "补充量化成果" },
    });
    const suggestions = canonical({
      eventId: "evt-suggestions",
      seq: 2,
      type: "suggestions.updated",
      items: [{ text: "继续优化", msg: "继续优化工作经历" }],
    });

    const state = [patch, suggestions].reduce(
      reduceConversationRun,
      createConversationRunState("run-1"),
    );

    expect(state.artifacts).toEqual([
      {
        artifactId: "patch-1",
        kind: "resume_patch",
        payload: { patch_id: "patch-1", summary: "补充量化成果" },
      },
    ]);
    expect(state.suggestions).toEqual([
      { text: "继续优化", msg: "继续优化工作经历" },
    ]);
  });

  it("isolates stale runs and preserves typed cancellation reasons", () => {
    const initial = createConversationRunState("run-current");
    const stale = canonical({
      eventId: "evt-stale",
      runId: "run-stale",
      type: "run.sourceCompleted",
    });
    const cancelled = canonical({
      eventId: "evt-cancelled",
      runId: "run-current",
      type: "run.cancelled",
      reason: "session_switch",
      message: "Execution stopped due to session switch",
    });

    expect(reduceConversationRun(initial, stale)).toBe(initial);
    expect(reduceConversationRun(initial, cancelled)).toEqual(
      expect.objectContaining({
        sourceStatus: "cancelled",
        cancelReason: "session_switch",
        error: "Execution stopped due to session switch",
      }),
    );
  });

  it("keeps private diagnosis evidence out of the public process timeline", () => {
    const trace = canonical({
      eventId: "evt-private-trace",
      type: "thought.upserted",
      stepId: 2,
      nodeId: "diagnosis:call-1:0",
      content: "教育经历为空，影响背景核验。",
      phase: "diagnosis_trace",
      complete: true,
    });

    const state = reduceConversationRun(
      createConversationRunState("run-1"),
      trace,
    );
    expect(state.process).toEqual([]);
    expect(state.seenEventIds).toEqual(["evt-private-trace"]);
  });
});
