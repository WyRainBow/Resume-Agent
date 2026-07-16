import type {
  ConversationProcessNode,
  ConversationRunState,
} from "./model";

export interface ConversationPresentationState {
  runId: string;
  openingReleased: boolean;
  presentedProcessNodeIds: string[];
  responseBridgeReleased: boolean;
  responsePresented: boolean;
}

export type ConversationPresentationAction =
  | { type: "opening.elapsed"; runId: string }
  | { type: "process.segmentPresented"; runId: string; nodeId: string }
  | { type: "process.waitElapsed"; runId: string; nodeId: string }
  | { type: "response.bridgeElapsed"; runId: string }
  | { type: "response.presented"; runId: string };

export type PresentedProcessNode = ConversationProcessNode & {
  presentationStatus: "hidden" | "typing" | "draining" | "visible";
};

export interface ConversationTurnPresentation {
  runId: string;
  phase:
    | "opening"
    | "presenting_process"
    | "waiting_for_response"
    | "presenting_response"
    | "presenting_artifacts"
    | "complete"
    | "failed";
  showOpeningLoading: boolean;
  activeProcessNodeId?: string;
  process: PresentedProcessNode[];
  response: string;
  artifacts: ConversationRunState["artifacts"];
  suggestions: ConversationRunState["suggestions"];
  sourceStatus: ConversationRunState["sourceStatus"];
  error?: string;
  canPresentResponse: boolean;
  showArtifacts: boolean;
}

export function createConversationPresentationState(
  runId: string,
): ConversationPresentationState {
  return {
    runId,
    openingReleased: false,
    presentedProcessNodeIds: [],
    responseBridgeReleased: false,
    responsePresented: false,
  };
}

export function reduceConversationPresentation(
  state: ConversationPresentationState,
  action: ConversationPresentationAction,
): ConversationPresentationState {
  if (action.runId !== state.runId) return state;
  if (action.type === "opening.elapsed") {
    return { ...state, openingReleased: true };
  }
  if (
    action.type === "process.segmentPresented" ||
    action.type === "process.waitElapsed"
  ) {
    return state.presentedProcessNodeIds.includes(action.nodeId)
      ? state
      : {
          ...state,
          presentedProcessNodeIds: [
            ...state.presentedProcessNodeIds,
            action.nodeId,
          ],
        };
  }
  if (action.type === "response.bridgeElapsed") {
    return { ...state, responseBridgeReleased: true };
  }
  if (action.type === "response.presented") {
    return { ...state, responsePresented: true };
  }
  return state;
}

export function selectConversationPresentation(
  run: ConversationRunState,
  presentation: ConversationPresentationState,
): ConversationTurnPresentation {
  const thoughts = run.process.filter((node) => node.kind === "thought");
  const activeThought = thoughts.find(
    (node) =>
      !presentation.presentedProcessNodeIds.includes(node.id) &&
      !run.process.some(
        (candidate) =>
          candidate.kind === "tool" &&
          candidate.stepId < node.stepId &&
          candidate.status === "running",
      ),
  );
  const interrupted =
    run.sourceStatus === "failed" || run.sourceStatus === "cancelled";
  const showOpeningLoading = !presentation.openingReleased && !interrupted;
  const process = run.process.map((node) => {
    if (showOpeningLoading) {
      return { ...node, presentationStatus: "hidden" as const };
    }
    if (node.kind === "thought") {
      if (presentation.presentedProcessNodeIds.includes(node.id)) {
        return { ...node, presentationStatus: "visible" as const };
      }
      if (node.id !== activeThought?.id) {
        return { ...node, presentationStatus: "hidden" as const };
      }
      const hasSameStepTool = run.process.some(
        (candidate) =>
          candidate.kind === "tool" &&
          candidate.stepId === node.stepId,
      );
      return {
        ...node,
        presentationStatus:
          hasSameStepTool
            ? ("draining" as const)
            : ("typing" as const),
      };
    }
    const sameStepThought = run.process.find(
      (candidate) =>
        candidate.kind === "thought" && candidate.stepId === node.stepId,
    );
    const waitsForThought = Boolean(
      sameStepThought &&
      !presentation.presentedProcessNodeIds.includes(sameStepThought.id),
    );
    const waitsForEarlierThought = thoughts.some(
      (thought) =>
        thought.stepId < node.stepId &&
        !presentation.presentedProcessNodeIds.includes(thought.id),
    );
    return {
      ...node,
      presentationStatus: waitsForThought || waitsForEarlierThought
        ? ("hidden" as const)
        : ("visible" as const),
    };
  });
  const processReady = process.every(
    (node) =>
      node.presentationStatus === "visible" &&
      (node.kind !== "tool" || node.status !== "running"),
  );
  const hasResponse = Boolean(run.response.sourceText.trim());
  const bridgeReady =
    !hasResponse || thoughts.length === 0 || presentation.responseBridgeReleased;
  const canPresentResponse = Boolean(
    presentation.openingReleased &&
      run.response.sourceComplete &&
      processReady &&
      bridgeReady,
  );
  const showArtifacts = Boolean(
    run.sourceStatus === "completed" &&
      (run.artifacts.length > 0 || run.suggestions.length > 0) &&
      (hasResponse ? presentation.responsePresented : canPresentResponse),
  );
  const phase: ConversationTurnPresentation["phase"] = interrupted
    ? "failed"
    : showOpeningLoading
      ? "opening"
      : !processReady
        ? "presenting_process"
        : hasResponse && !canPresentResponse
          ? "waiting_for_response"
          : hasResponse && !presentation.responsePresented
            ? "presenting_response"
            : showArtifacts
              ? "presenting_artifacts"
              : run.sourceStatus === "completed"
                ? "complete"
                : "waiting_for_response";
  return {
    runId: run.runId,
    phase,
    showOpeningLoading,
    activeProcessNodeId: activeThought?.id,
    process,
    response: run.response.sourceText,
    artifacts: run.artifacts,
    suggestions: run.suggestions,
    sourceStatus: run.sourceStatus,
    error: run.error,
    canPresentResponse,
    showArtifacts,
  };
}
