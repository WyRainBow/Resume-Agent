import { useCallback, useEffect, useMemo, useReducer } from "react";

import { useReducedMotion } from "@/hooks/useTemporalText";

import {
  createConversationPresentationState,
  reduceConversationPresentation,
  selectConversationPresentation,
  type ConversationPresentationAction,
  type ConversationPresentationState,
  type ConversationTurnPresentation,
} from "./ConversationPresentation";
import type { ConversationRunState } from "./model";

const INITIAL_THOUGHT_LOADING_MS = 960;
const TOOL_REVEAL_MAX_WAIT_MS = 350;
const RESPONSE_LOADING_BRIDGE_MS = 160;

export type PresentationSignal =
  | { type: "process.segmentPresented"; nodeId: string }
  | { type: "response.presented" };

interface UseConversationPresentationOptions {
  run: ConversationRunState;
}

export interface UseConversationPresentationResult {
  model: ConversationTurnPresentation;
  acknowledge(signal: PresentationSignal): void;
}

type HookAction =
  | ConversationPresentationAction
  | { type: "run.reset"; runId: string };

function reducer(
  state: ConversationPresentationState,
  action: HookAction,
): ConversationPresentationState {
  if (action.type === "run.reset") {
    return createConversationPresentationState(action.runId);
  }
  return reduceConversationPresentation(state, action);
}

export function useConversationPresentation({
  run,
}: UseConversationPresentationOptions): UseConversationPresentationResult {
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(
    reducer,
    run.runId,
    createConversationPresentationState,
  );
  const model = useMemo(
    () => selectConversationPresentation(run, state),
    [run, state],
  );

  useEffect(() => {
    if (state.runId !== run.runId) {
      dispatch({ type: "run.reset", runId: run.runId });
    }
  }, [run.runId, state.runId]);

  useEffect(() => {
    if (
      state.runId !== run.runId ||
      state.openingReleased ||
      run.sourceStatus === "failed" ||
      run.sourceStatus === "cancelled"
    ) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "opening.elapsed", runId: run.runId }),
      reducedMotion ? 0 : INITIAL_THOUGHT_LOADING_MS,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, run.runId, run.sourceStatus, state.openingReleased, state.runId]);

  useEffect(() => {
    const drainingThought = model.process.find(
      (node) =>
        node.kind === "thought" && node.presentationStatus === "draining",
    );
    if (!drainingThought) return undefined;
    const timer = window.setTimeout(
      () =>
        dispatch({
          type: "process.waitElapsed",
          runId: run.runId,
          nodeId: drainingThought.id,
        }),
      reducedMotion ? 0 : TOOL_REVEAL_MAX_WAIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [model.process, reducedMotion, run.runId]);

  useEffect(() => {
    const hasThought = model.process.some((node) => node.kind === "thought");
    const processReady = model.process
      .filter((node) => node.kind === "thought")
      .every((node) => node.presentationStatus === "visible");
    if (
      !hasThought ||
      !processReady ||
      !run.response.sourceComplete ||
      state.responseBridgeReleased ||
      !state.openingReleased
    ) {
      return undefined;
    }
    const timer = window.setTimeout(
      () =>
        dispatch({ type: "response.bridgeElapsed", runId: run.runId }),
      reducedMotion ? 0 : RESPONSE_LOADING_BRIDGE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [
    model.process,
    reducedMotion,
    run.response.sourceComplete,
    run.runId,
    state.openingReleased,
    state.responseBridgeReleased,
  ]);

  const acknowledge = useCallback(
    (signal: PresentationSignal) => {
      dispatch({ ...signal, runId: run.runId });
    },
    [run.runId],
  );

  return useMemo(() => ({ model, acknowledge }), [acknowledge, model]);
}
