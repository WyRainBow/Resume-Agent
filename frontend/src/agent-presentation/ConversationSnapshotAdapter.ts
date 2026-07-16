import type {
  ConversationRunState,
  ConversationTurnSnapshot,
} from "./model";
import {
  selectConversationPresentation,
  type ConversationTurnPresentation,
} from "./ConversationPresentation";

interface SnapshotMetadata {
  messageId: string;
  completedAt: string;
}

export function buildConversationTurnSnapshot(
  run: ConversationRunState,
  metadata: SnapshotMetadata,
): ConversationTurnSnapshot {
  return {
    version: 1,
    runId: run.runId,
    messageId: metadata.messageId,
    role: "assistant",
    process: run.process,
    response: run.response.sourceText,
    artifacts: run.artifacts,
    suggestions: run.suggestions,
    completedAt: metadata.completedAt,
  };
}

export function parseConversationTurnSnapshot(
  value: unknown,
): ConversationTurnSnapshot | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== 1 ||
    value.role !== "assistant" ||
    typeof value.runId !== "string" ||
    typeof value.messageId !== "string" ||
    typeof value.response !== "string" ||
    typeof value.completedAt !== "string" ||
    !Array.isArray(value.process) ||
    !Array.isArray(value.artifacts) ||
    !Array.isArray(value.suggestions)
  ) {
    return null;
  }

  return value as unknown as ConversationTurnSnapshot;
}

export function parseConversationTurnSnapshotMap(
  value: unknown,
): Record<string, ConversationTurnSnapshot> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([messageId, snapshot]) => {
      const parsed = parseConversationTurnSnapshot(snapshot);
      return parsed ? [[messageId, parsed]] : [];
    }),
  );
}

export function createHistoryConversationPresentation(
  snapshot: ConversationTurnSnapshot,
): ConversationTurnPresentation {
  const run: ConversationRunState = {
    runId: snapshot.runId,
    sourceStatus: "completed",
    process: snapshot.process,
    response: { sourceText: snapshot.response, sourceComplete: true },
    artifacts: snapshot.artifacts,
    suggestions: snapshot.suggestions,
    toolProgressByCallId: {},
    seenEventIds: [],
    lastSeq: 0,
    nextServerSeq: 1,
    pendingServerEvents: {},
  };
  return selectConversationPresentation(run, {
    runId: snapshot.runId,
    openingReleased: true,
    presentedProcessNodeIds: snapshot.process.map((node) => node.id),
    responseBridgeReleased: true,
    responsePresented: true,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
