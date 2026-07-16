import { describe, expect, it } from "vitest";

import { createConversationRunState } from "./ConversationRunReducer";
import {
  buildConversationTurnSnapshot,
  createHistoryConversationPresentation,
  parseConversationTurnSnapshotMap,
  parseConversationTurnSnapshot,
} from "./ConversationSnapshotAdapter";

describe("ConversationSnapshotAdapter", () => {
  it("persists one completed run without temporal presentation state", () => {
    const run = {
      ...createConversationRunState("run-snapshot"),
      sourceStatus: "completed" as const,
      process: [
        {
          id: "thought:step-1",
          kind: "thought" as const,
          stepId: 1,
          content: "我已经完成诊断。",
          complete: true,
        },
      ],
      response: { sourceText: "优先补强成果证据。", sourceComplete: true },
      artifacts: [
        {
          artifactId: "diagnosis-1",
          kind: "resume_diagnosis",
          payload: { type: "resume_diagnosis", overall_score: 82 },
        },
      ],
      suggestions: [{ text: "逐项修改", msg: "按诊断结果逐项修改" }],
    };

    const snapshot = buildConversationTurnSnapshot(run, {
      messageId: "message-1",
      completedAt: "2026-07-14T12:00:00.000Z",
    });
    const restored = parseConversationTurnSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
    );

    expect(restored).toEqual({
      version: 1,
      runId: "run-snapshot",
      messageId: "message-1",
      role: "assistant",
      process: run.process,
      response: "优先补强成果证据。",
      artifacts: run.artifacts,
      suggestions: run.suggestions,
      completedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(restored).not.toHaveProperty("phase");
    expect(restored).not.toHaveProperty("showOpeningLoading");

    const presentation = createHistoryConversationPresentation(restored!);
    expect(presentation.showOpeningLoading).toBe(false);
    expect(presentation.process[0].presentationStatus).toBe("visible");
    expect(presentation.response).toBe("优先补强成果证据。");
    expect(presentation.showArtifacts).toBe(true);

    expect(
      parseConversationTurnSnapshotMap({
        "message-1": snapshot,
        broken: { version: 99 },
      }),
    ).toEqual({ "message-1": snapshot });
  });
});
