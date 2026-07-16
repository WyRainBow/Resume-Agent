import { describe, expect, it } from "vitest";
import type { AgentStreamEvent } from "@/services/agentStream";

import { createAgentEventAdapter } from "./AgentEventAdapter";

function serverEvent(
  runId: string,
  seq: number,
  event: Omit<AgentStreamEvent, "runId" | "seq">,
): AgentStreamEvent {
  return { ...event, runId, seq };
}

describe("AgentEventAdapter", () => {
  it("rejects transport events that do not carry the canonical run envelope", () => {
    const adapter = createAgentEventAdapter();

    expect(
      adapter.normalize({
        id: "legacy-thought",
        type: "thought",
        data: { content: "legacy", step_id: 1 },
        timestamp: "2026-07-14T12:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("preserves sequence continuity for canonical non-visual events", () => {
    const adapter = createAgentEventAdapter();

    expect(
      adapter.normalize(
        serverEvent("run-status", 1, {
          id: "evt-status",
          type: "status",
          data: { content: "processing" },
          timestamp: "2026-07-14T12:00:00.000Z",
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        type: "run.observed",
        sourceType: "status",
        seq: 1,
      }),
    ]);
  });

  it("normalizes one transport thought into one run-scoped canonical event", () => {
    const adapter = createAgentEventAdapter();

    const events = adapter.normalize(serverEvent("run-1", 1, {
      id: "evt-thought-1",
      type: "thought",
      data: {
        content: "我先读取这份简历，再从招聘者角度逐项诊断。",
        step_id: 2,
        node_id: "thought:step-2",
        phase: "public_reasoning",
        is_complete: false,
      },
      timestamp: "2026-07-14T12:00:00.000Z",
    }));

    expect(events).toEqual([
      {
        type: "thought.upserted",
        eventId: "evt-thought-1",
        runId: "run-1",
        seq: 1,
        sequenceSource: "server",
        at: Date.parse("2026-07-14T12:00:00.000Z"),
        stepId: 2,
        nodeId: "thought:step-2",
        content: "我先读取这份简历，再从招聘者角度逐项诊断。",
        phase: "public_reasoning",
        complete: false,
      },
    ]);
  });

  it("normalizes one tool lifecycle without interpreting its business artifact", () => {
    const adapter = createAgentEventAdapter();

    const started = adapter.normalize(serverEvent("run-tools", 1, {
      id: "evt-tool-start",
      type: "tool_call",
      data: {
        tool: "list_resumes",
        args: {},
        step_id: 1,
        tool_call_id: "call-1",
      },
      timestamp: "2026-07-14T12:00:01.000Z",
    }));
    const completed = adapter.normalize(serverEvent("run-tools", 2, {
      id: "evt-tool-result",
      type: "tool_result",
      data: {
        tool: "list_resumes",
        result: "1 resume",
        step_id: 1,
        tool_call_id: "call-1",
        structured_data: {
          type: "resume_list",
          resumes: [{ id: "resume-1" }],
        },
      },
      timestamp: "2026-07-14T12:00:02.000Z",
    }));

    expect(started).toEqual([
      expect.objectContaining({
        type: "tool.started",
        eventId: "evt-tool-start",
        runId: "run-tools",
        seq: 1,
        stepId: 1,
        toolCallId: "call-1",
        toolName: "list_resumes",
        args: {},
      }),
    ]);
    expect(completed).toEqual([
      expect.objectContaining({
        type: "tool.completed",
        eventId: "evt-tool-result",
        runId: "run-tools",
        seq: 2,
        stepId: 1,
        toolCallId: "call-1",
        toolName: "list_resumes",
        outcome: "success",
        result: "1 resume",
        structuredData: {
          type: "resume_list",
          resumes: [{ id: "resume-1" }],
        },
      }),
    ]);
  });

  it("keeps formal tool progress generic and treats stageId as opaque", () => {
    const adapter = createAgentEventAdapter();

    const events = adapter.normalize(serverEvent("run-progress", 1, {
      id: "evt-progress-1",
      type: "tool_progress",
      data: {
        tool_call_id: "call-progress",
        stage_id: "evidence-scan",
        current: 2,
        total: 5,
        label: "成果证据",
        summary: "正在核对量化结果。",
      },
      timestamp: "2026-07-14T12:00:03.000Z",
    }));

    expect(events).toEqual([
      expect.objectContaining({
        type: "tool.progressed",
        toolCallId: "call-progress",
        stageId: "evidence-scan",
        current: 2,
        total: 5,
        label: "成果证据",
        summary: "正在核对量化结果。",
      }),
    ]);
  });

  it("uses server event identity and sequence from the canonical envelope", () => {
    const adapter = createAgentEventAdapter();

    const events = adapter.normalize({
      id: "evt-server-12",
      type: "thought",
      data: {
        content: "这是服务端有序事件。",
        step_id: 3,
        is_complete: true,
      },
      runId: "run-server",
      seq: 12,
      timestamp: "2026-07-14T12:00:03.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        eventId: "evt-server-12",
        runId: "run-server",
        seq: 12,
        sequenceSource: "server",
      }),
    ]);
  });

  it("separates response source updates, resets, and source completion", () => {
    const adapter = createAgentEventAdapter();

    const reset = adapter.normalize(serverEvent("run-answer", 1, {
      id: "evt-reset",
      type: "answer_reset",
      data: {},
      timestamp: "2026-07-14T12:00:04.000Z",
    }));
    const chunk = adapter.normalize(serverEvent("run-answer", 2, {
      id: "evt-answer-1",
      type: "answer",
      data: { content: "嘿～", delta: "嘿～", is_complete: false },
      timestamp: "2026-07-14T12:00:05.000Z",
    }));
    const complete = adapter.normalize(serverEvent("run-answer", 3, {
      id: "evt-answer-2",
      type: "answer",
      data: { content: "嘿～我是 coco。", is_complete: true },
      timestamp: "2026-07-14T12:00:06.000Z",
    }));
    const done = adapter.normalize(serverEvent("run-answer", 4, {
      id: "evt-done",
      type: "done",
      data: {},
      timestamp: "2026-07-14T12:00:07.000Z",
    }));

    expect(reset).toEqual([
      expect.objectContaining({ type: "response.reset", seq: 1 }),
    ]);
    expect(chunk).toEqual([
      expect.objectContaining({
        type: "response.updated",
        seq: 2,
        content: "嘿～",
        delta: "嘿～",
        complete: false,
      }),
    ]);
    expect(complete).toEqual([
      expect.objectContaining({
        type: "response.updated",
        seq: 3,
        content: "嘿～我是 coco。",
        complete: true,
      }),
    ]);
    expect(done).toEqual([
      expect.objectContaining({ type: "run.sourceCompleted", seq: 4 }),
    ]);
  });

  it("normalizes top-level business artifacts and suggestions without messageId current", () => {
    const adapter = createAgentEventAdapter();

    const patch = adapter.normalize(serverEvent("run-artifacts", 1, {
      id: "evt-patch",
      type: "resume_patch",
      data: {
        patch_id: "patch-1",
        paths: ["experience.0.details"],
        before: { "experience.0.details": "负责接口开发" },
        after: { "experience.0.details": "完成接口重构，延迟降低 30%" },
        summary: "补充量化成果",
        operation: "set",
      },
      timestamp: "2026-07-14T12:00:08.000Z",
    }));
    const suggestions = adapter.normalize(serverEvent("run-artifacts", 2, {
      id: "evt-suggestions",
      type: "suggestions",
      data: { items: [{ text: "继续优化", msg: "继续优化工作经历" }] },
      timestamp: "2026-07-14T12:00:09.000Z",
    }));
    const generated = adapter.normalize(serverEvent("run-artifacts", 3, {
      id: "evt-generated",
      type: "resume_generated",
      data: {
        resume: { basic: { name: "张三" } },
        summary: "已生成简历",
      },
      timestamp: "2026-07-14T12:00:09.500Z",
    }));

    expect(patch).toEqual([
      expect.objectContaining({
        type: "artifact.upserted",
        runId: "run-artifacts",
        artifactId: "patch-1",
        kind: "resume_patch",
        payload: expect.objectContaining({ summary: "补充量化成果" }),
      }),
    ]);
    expect(suggestions).toEqual([
      expect.objectContaining({
        type: "suggestions.updated",
        items: [{ text: "继续优化", msg: "继续优化工作经历" }],
      }),
    ]);
    expect(generated).toEqual([
      expect.objectContaining({
        type: "artifact.upserted",
        artifactId: "evt-generated",
        kind: "resume_generated",
        payload: expect.objectContaining({ summary: "已生成简历" }),
      }),
    ]);
  });

  it("preserves cancellation reasons instead of collapsing every interruption into failure", () => {
    const adapter = createAgentEventAdapter();

    const sessionSwitch = adapter.normalize(serverEvent("run-cancel", 1, {
      id: "evt-cancel",
      type: "agent_error",
      data: { error_message: "Execution stopped due to session switch" },
      timestamp: "2026-07-14T12:00:10.000Z",
    }));
    const failure = adapter.normalize(serverEvent("run-cancel", 2, {
      id: "evt-failure",
      type: "agent_error",
      data: { error_message: "Model request failed" },
      timestamp: "2026-07-14T12:00:11.000Z",
    }));

    expect(sessionSwitch).toEqual([
      expect.objectContaining({
        type: "run.cancelled",
        reason: "session_switch",
        message: "Execution stopped due to session switch",
      }),
    ]);
    expect(failure).toEqual([
      expect.objectContaining({
        type: "run.failed",
        message: "Model request failed",
      }),
    ]);
  });

});
