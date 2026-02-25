import { useRef } from "react";

export interface CompletionSnapshot {
  thought: string;
  answer: string;
  at: number;
  run: number;
}

export interface FinalizedContent {
  thought: string;
  answer: string;
  canUseFallback: boolean;
  fallbackRun?: number;
}

export function useStreamRunController() {
  const streamRunRef = useRef(0);
  const isFinalizedRef = useRef(false);
  const lastCompletedRef = useRef<CompletionSnapshot | null>(null);
  const currentThoughtRef = useRef("");
  const currentAnswerRef = useRef("");

  const startNewRun = () => {
    streamRunRef.current += 1;
    isFinalizedRef.current = false;
    lastCompletedRef.current = null;
    currentThoughtRef.current = "";
    currentAnswerRef.current = "";
    return streamRunRef.current;
  };

  const captureCompletionSnapshot = (thought: string, answer: string) => {
    if (!thought.trim() && !answer.trim()) return;
    lastCompletedRef.current = {
      thought: thought.trim(),
      answer: answer.trim(),
      at: Date.now(),
      run: streamRunRef.current,
    };
  };

  const resolveFinalizedContent = (
    thoughtStateValue: string,
    answerStateValue: string,
  ): FinalizedContent => {
    const thoughtRefValue = currentThoughtRef.current.trim();
    const answerRefValue = currentAnswerRef.current.trim();
    const fallback = lastCompletedRef.current;
    const canUseFallback =
      Boolean(fallback) && fallback!.run === streamRunRef.current;

    const thought =
      thoughtRefValue ||
      thoughtStateValue.trim() ||
      (canUseFallback ? fallback?.thought || "" : "");
    const answer =
      answerRefValue ||
      answerStateValue.trim() ||
      (canUseFallback ? fallback?.answer || "" : "");

    return {
      thought,
      answer,
      canUseFallback,
      fallbackRun: fallback?.run,
    };
  };

  return {
    streamRunRef,
    isFinalizedRef,
    currentThoughtRef,
    currentAnswerRef,
    lastCompletedRef,
    startNewRun,
    captureCompletionSnapshot,
    resolveFinalizedContent,
  };
}
