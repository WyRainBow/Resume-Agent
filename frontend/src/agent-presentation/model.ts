import type { CanonicalConversationEvent, RunCancelReason } from "./events";

export interface ConversationToolProgress {
  stageId: string;
  current?: number;
  total?: number;
  label?: string;
  summary?: string;
  stages?: string[];
}

export type ConversationProcessNode =
  | {
      id: string;
      kind: "thought";
      stepId: number;
      content: string;
      phase?: string;
      complete: boolean;
    }
  | {
      id: string;
      kind: "tool";
      stepId: number;
      toolCallId: string;
      toolName: string;
      status: "running" | "success" | "error";
      progress?: ConversationToolProgress;
      result?: unknown;
      structuredData?: Record<string, unknown>;
    };

export interface ConversationRunState {
  runId: string;
  sourceStatus: "idle" | "streaming" | "completed" | "failed" | "cancelled";
  process: ConversationProcessNode[];
  response: {
    sourceText: string;
    sourceComplete: boolean;
  };
  artifacts: Array<{
    artifactId: string;
    kind: string;
    payload: Record<string, unknown>;
    sourceToolCallId?: string;
  }>;
  suggestions: Array<Record<string, unknown>>;
  toolProgressByCallId: Record<string, ConversationToolProgress>;
  seenEventIds: string[];
  lastSeq: number;
  nextServerSeq: number;
  pendingServerEvents: Record<number, CanonicalConversationEvent>;
  error?: string;
  cancelReason?: RunCancelReason;
}

export interface ConversationTurnSnapshot {
  version: 1;
  runId: string;
  messageId: string;
  role: "assistant";
  process: ConversationProcessNode[];
  response: string;
  artifacts: ConversationRunState["artifacts"];
  suggestions: ConversationRunState["suggestions"];
  completedAt: string;
}
