import type { CanonicalConversationEvent } from "./events";
import type {
  ConversationProcessNode,
  ConversationRunState,
  ConversationToolProgress,
} from "./model";

export function createConversationRunState(runId: string): ConversationRunState {
  return {
    runId,
    sourceStatus: "idle",
    process: [],
    response: { sourceText: "", sourceComplete: false },
    artifacts: [],
    suggestions: [],
    toolProgressByCallId: {},
    seenEventIds: [],
    lastSeq: 0,
    nextServerSeq: 1,
    pendingServerEvents: {},
  };
}

function upsertProcessNode(
  nodes: ConversationProcessNode[],
  node: ConversationProcessNode,
): ConversationProcessNode[] {
  const existing = nodes.findIndex((item) => item.id === node.id);
  const next = [...nodes];
  if (existing < 0) next.push(node);
  else next[existing] = node;
  return next.sort((left, right) => {
    if (left.stepId !== right.stepId) return left.stepId - right.stepId;
    if (left.kind === right.kind) return 0;
    return left.kind === "thought" ? -1 : 1;
  });
}

function applyConversationEvent(
  state: ConversationRunState,
  event: CanonicalConversationEvent,
): ConversationRunState {
  const terminal =
    state.sourceStatus === "failed" || state.sourceStatus === "cancelled";
  const terminalEvent =
    event.type === "run.failed" ||
    event.type === "run.cancelled" ||
    event.type === "run.sourceCompleted";
  if (terminal && !terminalEvent) {
    return {
      ...state,
      seenEventIds: [...state.seenEventIds, event.eventId],
      lastSeq: Math.max(state.lastSeq, event.seq),
    };
  }

  let process = state.process;
  let response = state.response;
  let artifacts = state.artifacts;
  let suggestions = state.suggestions;
  let toolProgressByCallId = state.toolProgressByCallId;
  let error = state.error;
  let cancelReason = state.cancelReason;
  let sourceStatus: ConversationRunState["sourceStatus"] =
    state.sourceStatus === "idle" ? "streaming" : state.sourceStatus;
  if (event.type === "thought.upserted") {
    if (event.phase !== "diagnosis_trace") {
      process = upsertProcessNode(process, {
        id: event.nodeId,
        kind: "thought",
        stepId: event.stepId,
        content: event.content,
        phase: event.phase,
        complete: event.complete,
      });
    }
  } else if (event.type === "tool.started") {
    process = upsertProcessNode(process, {
      id: `tool:${event.toolCallId}`,
      kind: "tool",
      stepId: event.stepId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      status: "running",
      progress: state.toolProgressByCallId[event.toolCallId],
    });
  } else if (event.type === "tool.progressed") {
    const previous = state.toolProgressByCallId[event.toolCallId];
    const nextProgress: ConversationToolProgress = {
      stageId: event.stageId,
      current: event.current,
      total: event.total,
      label: event.label,
      summary: event.summary,
      stages: event.stages,
    };
    const movesBackward = Boolean(
      previous?.current != null &&
        nextProgress.current != null &&
        nextProgress.current < previous.current,
    );
    if (!movesBackward) {
      toolProgressByCallId = {
        ...state.toolProgressByCallId,
        [event.toolCallId]: nextProgress,
      };
      process = state.process.map((node) =>
        node.kind === "tool" && node.toolCallId === event.toolCallId
          ? { ...node, progress: nextProgress }
          : node,
      );
    }
  } else if (event.type === "tool.completed") {
    const existing = state.process.find(
      (node) => node.kind === "tool" && node.toolCallId === event.toolCallId,
    );
    process = upsertProcessNode(process, {
      id: `tool:${event.toolCallId}`,
      kind: "tool",
      stepId: event.stepId,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      status: event.outcome,
      progress: existing?.kind === "tool" ? existing.progress : undefined,
      result: event.result,
      structuredData: event.structuredData,
    });
    const structuredType = event.structuredData?.type;
    const processOnly =
      structuredType === "resume_list" ||
      structuredType === "resume_detail" ||
      structuredType === "resume_loaded" ||
      structuredType === "resume_patch" ||
      structuredType === "resume_generated";
    if (typeof structuredType === "string" && !processOnly) {
      const artifactId = `${event.toolCallId}:${structuredType}`;
      const artifact = {
        artifactId,
        kind: structuredType,
        payload: event.structuredData!,
        sourceToolCallId: event.toolCallId,
      };
      const existingArtifact = state.artifacts.findIndex(
        (item) => item.artifactId === artifactId,
      );
      artifacts = [...state.artifacts];
      if (existingArtifact < 0) artifacts.push(artifact);
      else artifacts[existingArtifact] = artifact;
    }
  } else if (event.type === "response.reset") {
    response = { sourceText: "", sourceComplete: false };
  } else if (event.type === "response.updated") {
    const sourceText = event.complete
      ? event.content || state.response.sourceText
      : event.delta
        ? state.response.sourceText + event.delta
        : event.content.startsWith(state.response.sourceText)
          ? event.content
          : state.response.sourceText + event.content;
    response = {
      sourceText,
      sourceComplete: event.complete,
    };
  } else if (event.type === "run.sourceCompleted") {
    response = { ...state.response, sourceComplete: true };
    if (state.sourceStatus !== "failed" && state.sourceStatus !== "cancelled") {
      sourceStatus = "completed";
    }
  } else if (event.type === "artifact.upserted") {
    const artifact = {
      artifactId: event.artifactId,
      kind: event.kind,
      payload: event.payload,
    };
    const existingArtifact = state.artifacts.findIndex(
      (item) => item.artifactId === event.artifactId,
    );
    artifacts = [...state.artifacts];
    if (existingArtifact < 0) artifacts.push(artifact);
    else artifacts[existingArtifact] = artifact;
  } else if (event.type === "suggestions.updated") {
    suggestions = event.items;
  } else if (event.type === "run.cancelled") {
    sourceStatus = "cancelled";
    cancelReason = event.reason;
    error = event.message;
    response = { ...state.response, sourceComplete: true };
  } else if (event.type === "run.failed") {
    sourceStatus = "failed";
    error = event.message;
    response = { ...state.response, sourceComplete: true };
  }

  return {
    ...state,
    sourceStatus,
    process,
    response,
    artifacts,
    suggestions,
    toolProgressByCallId,
    error,
    cancelReason,
    seenEventIds: [...state.seenEventIds, event.eventId],
    lastSeq: Math.max(state.lastSeq, event.seq),
  };
}

export function reduceConversationRun(
  state: ConversationRunState,
  event: CanonicalConversationEvent,
): ConversationRunState {
  if (event.runId !== state.runId) return state;
  if (state.seenEventIds.includes(event.eventId)) return state;
  if (
    Object.values(state.pendingServerEvents).some(
      (pending) => pending.eventId === event.eventId,
    )
  ) {
    return state;
  }
  if (event.sequenceSource !== "server") {
    return applyConversationEvent(state, event);
  }
  if (event.seq < state.nextServerSeq) return state;
  if (state.pendingServerEvents[event.seq]) return state;

  let nextState: ConversationRunState = {
    ...state,
    pendingServerEvents: {
      ...state.pendingServerEvents,
      [event.seq]: event,
    },
  };
  while (nextState.pendingServerEvents[nextState.nextServerSeq]) {
    const nextEvent = nextState.pendingServerEvents[nextState.nextServerSeq];
    const pendingServerEvents = { ...nextState.pendingServerEvents };
    delete pendingServerEvents[nextState.nextServerSeq];
    nextState = applyConversationEvent(
      {
        ...nextState,
        nextServerSeq: nextState.nextServerSeq + 1,
        pendingServerEvents,
      },
      nextEvent,
    );
  }
  return nextState;
}
