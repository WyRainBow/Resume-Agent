// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHistoryConversationPresentation } from "@/agent-presentation/ConversationSnapshotAdapter";
import type { ConversationTurnSnapshot } from "@/agent-presentation/model";
import { ResumeProvider } from "@/contexts/ResumeContext";
import ConversationTurnView from "./ConversationTurnView";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("ConversationTurnView", () => {
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

  it("renders one history snapshot in process-response-artifact order", () => {
    const snapshot: ConversationTurnSnapshot = {
      version: 1,
      runId: "run-history",
      messageId: "message-history",
      role: "assistant",
      process: [
        {
          id: "thought:1",
          kind: "thought",
          stepId: 1,
          content: "先核对简历证据。",
          complete: true,
        },
      ],
      response: "优先补强成果证据。",
      artifacts: [
        {
          artifactId: "artifact-1",
          kind: "custom_evidence",
          payload: { type: "custom_evidence", value: 1 },
        },
      ],
      suggestions: [],
      completedAt: "2026-07-14T12:00:00.000Z",
    };

    act(() => {
      root.render(
        <ConversationTurnView
          model={createHistoryConversationPresentation(snapshot)}
          mode="history"
          onAction={vi.fn()}
          onPresentationSignal={vi.fn()}
        />,
      );
    });

    const text = container.textContent || "";
    expect(text.indexOf("思考过程")).toBeLessThan(
      text.indexOf("优先补强成果证据。"),
    );
    expect(text.indexOf("优先补强成果证据。")).toBeLessThan(
      text.indexOf("custom_evidence"),
    );
  });

  it("shows a failed run immediately instead of leaving the opening loader visible", () => {
    act(() => {
      root.render(
        <ConversationTurnView
          model={{
            runId: "run-failed",
            phase: "failed",
            showOpeningLoading: false,
            process: [],
            response: "",
            artifacts: [],
            suggestions: [],
            sourceStatus: "failed",
            error: "模型请求失败",
            canPresentResponse: false,
            showArtifacts: false,
          }}
          mode="live"
          onAction={vi.fn()}
          onPresentationSignal={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("模型请求失败");
    expect(container.textContent).not.toContain("正在思考");
  });

  it("fills the thought-to-response gap with a waiting indicator when the response has not arrived yet", () => {
    // 空窗复现：思考已呈现完（visible），但回复尚未到达（response 为空、
    // 不可呈现）。此时不能裸露空白，应显示「正在组织回复…」占位。
    // 对应 2026-07-15 强制开场 thought 空窗 bug 的验收。
    act(() => {
      root.render(
        <ConversationTurnView
          model={{
            runId: "run-waiting",
            phase: "waiting_for_response",
            showOpeningLoading: false,
            process: [
              {
                id: "thought:1",
                kind: "thought",
                stepId: 1,
                content: "先轻松接住这句招呼。",
                complete: true,
                presentationStatus: "visible",
              },
            ],
            response: "",
            artifacts: [],
            suggestions: [],
            sourceStatus: "streaming",
            canPresentResponse: false,
            showArtifacts: false,
          }}
          mode="live"
          onAction={vi.fn()}
          onPresentationSignal={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("正在组织回复");
    // 思考 pill 仍在，但下方不是空白而是占位指示器
    expect(container.textContent).toContain("思考过程");
  });

  it("renders resume patches through the shared artifact registry", () => {
    const snapshot: ConversationTurnSnapshot = {
      version: 1,
      runId: "run-patch",
      messageId: "message-patch",
      role: "assistant",
      process: [],
      response: "我整理了一条可确认的修改建议。",
      artifacts: [
        {
          artifactId: "patch-1",
          kind: "resume_patch",
          payload: {
            patch_id: "patch-1",
            message_id: "message-patch",
            paths: ["experience.0.details"],
            before: { "experience.0.details": "负责接口开发" },
            after: { "experience.0.details": "完成接口重构，延迟降低 30%" },
            summary: "补充量化成果",
            operation: "set",
            status: "pending",
          },
        },
      ],
      suggestions: [],
      completedAt: "2026-07-14T12:00:00.000Z",
    };

    act(() => {
      root.render(
        <ResumeProvider>
          <ConversationTurnView
            model={createHistoryConversationPresentation(snapshot)}
            mode="history"
            onAction={vi.fn()}
            onPresentationSignal={vi.fn()}
          />
        </ResumeProvider>,
      );
    });

    expect(container.textContent).toContain("补充量化成果");
    expect(container.textContent).toContain("应用");
    expect(container.textContent).toContain("拒绝");
  });
});
