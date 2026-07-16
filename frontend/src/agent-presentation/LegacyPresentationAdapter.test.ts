import { describe, expect, it } from "vitest";

import {
  createConversationRunState,
  reduceConversationRun,
} from "./ConversationRunReducer";
import { projectLegacyStreamState } from "./LegacyPresentationAdapter";
import type { CanonicalConversationEvent } from "./events";

function event(
  value: Omit<CanonicalConversationEvent, "runId" | "sequenceSource" | "at">,
): CanonicalConversationEvent {
  return {
    runId: "run-legacy-view",
    sequenceSource: "arrival",
    at: 1,
    ...value,
  } as CanonicalConversationEvent;
}

describe("LegacyPresentationAdapter", () => {
  it("projects the canonical run into the existing Thought and white tool-card UI", () => {
    const state = [
      event({
        eventId: "evt-thought",
        seq: 1,
        type: "thought.upserted",
        stepId: 1,
        nodeId: "thought:step-1",
        content: "我先查看简历库，确认有哪些简历可以诊断。",
        complete: true,
      }),
      event({
        eventId: "evt-tool-start",
        seq: 2,
        type: "tool.started",
        stepId: 1,
        toolCallId: "call-list",
        toolName: "list_resumes",
        args: {},
      }),
      event({
        eventId: "evt-tool-result",
        seq: 3,
        type: "tool.completed",
        stepId: 1,
        toolCallId: "call-list",
        toolName: "list_resumes",
        outcome: "success",
        result: "1 resume",
        structuredData: {
          type: "resume_list",
          resumes: [{ id: "resume-1" }],
        },
      }),
    ].reduce(
      reduceConversationRun,
      createConversationRunState("run-legacy-view"),
    );

    expect(projectLegacyStreamState(state)).toEqual({
      thought: "我先查看简历库，确认有哪些简历可以诊断。",
      answer: "",
      processNodes: [
        {
          id: "thought:step-1",
          kind: "thought",
          stepId: 1,
          content: "我先查看简历库，确认有哪些简历可以诊断。",
        },
        {
          id: "tool:call-list",
          kind: "tool",
          stepId: 1,
          toolCallId: "call-list",
          toolName: "list_resumes",
          label: "查看简历列表",
          status: "success",
          summary: "找到 1 份可用简历",
        },
      ],
    });
  });

  it("preserves the existing diagnosis progress card model", () => {
    const state = [
      event({
        eventId: "evt-tool-start",
        seq: 1,
        type: "tool.started",
        stepId: 2,
        toolCallId: "call-diagnosis",
        toolName: "cv_analyzer_agent",
        args: {},
      }),
      event({
        eventId: "evt-progress",
        seq: 2,
        type: "tool.progressed",
        toolCallId: "call-diagnosis",
        stageId: "stage-2",
        current: 2,
        total: 5,
        label: "成果证据",
        summary: "正在核对量化结果。",
        stages: ["结构完整度", "成果证据", "面试风险", "岗位匹配", "汇总建议"],
      }),
    ].reduce(
      reduceConversationRun,
      createConversationRunState("run-legacy-view"),
    );

    const tool = projectLegacyStreamState(state).processNodes.find(
      (node) => node.kind === "tool",
    );
    expect(tool?.kind === "tool" ? tool.progress : undefined).toEqual({
      current: 2,
      total: 5,
      label: "成果证据",
      summary: "正在核对量化结果。",
      stages: ["结构完整度", "成果证据", "面试风险", "岗位匹配", "汇总建议"],
    });
  });

  it("surfaces the concrete patch summary on each edit tool card (issue D)", () => {
    const state = [
      event({
        eventId: "evt-edit-start",
        seq: 1,
        type: "tool.started",
        stepId: 3,
        toolCallId: "call-edit",
        toolName: "cv_editor_agent",
        args: {},
      }),
      event({
        eventId: "evt-edit-done",
        seq: 2,
        type: "tool.completed",
        stepId: 3,
        toolCallId: "call-edit",
        toolName: "cv_editor_agent",
        outcome: "success",
        result: "ok",
        structuredData: {
          type: "resume_patch",
          patch_id: "patch-1",
          summary: "修改了 实习经历「联想」的描述",
        },
      }),
    ].reduce(
      reduceConversationRun,
      createConversationRunState("run-legacy-view"),
    );

    const tool = projectLegacyStreamState(state).processNodes.find(
      (node) => node.kind === "tool",
    );
    expect(tool?.kind === "tool" ? tool.summary : undefined).toBe(
      "修改了 实习经历「联想」的描述",
    );
  });

  it("maps ask_human to a friendly label and omits the redundant status summary", () => {
    const state = [
      event({
        eventId: "evt-ask-start",
        seq: 1,
        type: "tool.started",
        stepId: 4,
        toolCallId: "call-ask",
        toolName: "ask_human",
        args: {},
      }),
      event({
        eventId: "evt-ask-done",
        seq: 2,
        type: "tool.completed",
        stepId: 4,
        toolCallId: "call-ask",
        toolName: "ask_human",
        outcome: "success",
        result: "ok",
      }),
    ].reduce(
      reduceConversationRun,
      createConversationRunState("run-legacy-view"),
    );

    const tool = projectLegacyStreamState(state).processNodes.find(
      (node) => node.kind === "tool",
    );
    expect(tool?.kind === "tool" ? tool.label : undefined).toBe("确认补充信息");
    // badge 已显示「执行成功」，摘要行不再重复同文案
    expect(tool?.kind === "tool" ? tool.summary : undefined).toBeUndefined();
  });
});
