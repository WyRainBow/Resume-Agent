import { useEffect, useRef, useState } from "react";

import {
  longestCommonPrefixLength,
  temporalChunkSize,
  temporalDelayMs,
} from "@/utils/temporalPacing";

export type TemporalTextPhase =
  | "idle"
  | "typing"
  | "draining"
  | "complete";

interface UseTemporalTextOptions {
  text: string;
  active: boolean;
  drain?: boolean;
  maxPresentationMs?: number;
  maxDrainMs?: number;
  onDrainComplete?: () => void;
}

interface UseTemporalTextResult {
  displayedText: string;
  phase: TemporalTextPhase;
  isCaughtUp: boolean;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return hidden;
}

/**
 * Presentation-only pacing for the latest public Thought.  The source text
 * remains authoritative; this hook only controls how quickly its prefix is
 * revealed and never changes the underlying timeline event.
 */
export function useTemporalText({
  text,
  active,
  drain = false,
  maxPresentationMs = 1200,
  maxDrainMs = 320,
  onDrainComplete,
}: UseTemporalTextOptions): UseTemporalTextResult {
  const reducedMotion = useReducedMotion();
  const documentHidden = useDocumentHidden();
  const [displayedText, setDisplayedText] = useState(active ? "" : text);
  const [phase, setPhase] = useState<TemporalTextPhase>(
    active ? "idle" : "complete",
  );
  const displayedRef = useRef(displayedText);
  const sourceRef = useRef(text);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const drainStartedAtRef = useRef<number | null>(null);
  const drainCompletedRef = useRef(false);
  const onDrainCompleteRef = useRef(onDrainComplete);

  onDrainCompleteRef.current = onDrainComplete;
  sourceRef.current = text;

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const finish = (nextText: string) => {
      displayedRef.current = nextText;
      setDisplayedText(nextText);
      setPhase("complete");
      if (drain && !drainCompletedRef.current) {
        drainCompletedRef.current = true;
        onDrainCompleteRef.current?.();
      }
    };

    if (!active || reducedMotion || documentHidden || !text) {
      startedAtRef.current = null;
      drainStartedAtRef.current = null;
      finish(text);
      return undefined;
    }

    // The reducer can replace a deterministic opening with richer LLM copy
    // under the same node id. Keep the stable prefix, then pace the new suffix.
    if (displayedRef.current && !text.startsWith(displayedRef.current)) {
      const prefixLength = longestCommonPrefixLength(
        displayedRef.current,
        text,
      );
      const stablePrefix = text.slice(0, prefixLength);
      displayedRef.current = stablePrefix;
      setDisplayedText(stablePrefix);
      startedAtRef.current = null;
      drainStartedAtRef.current = null;
    }

    if (displayedRef.current.length >= text.length) {
      finish(text);
      return undefined;
    }

    const now = performance.now();
    if (startedAtRef.current === null) startedAtRef.current = now;
    if (drain && drainStartedAtRef.current === null) {
      drainStartedAtRef.current = now;
    }
    if (!drain) drainStartedAtRef.current = null;
    setPhase(drain ? "draining" : "typing");

    const revealNextChunk = () => {
      const source = sourceRef.current;
      const elapsed = performance.now() - (startedAtRef.current || now);
      const drainElapsed = drainStartedAtRef.current === null
        ? 0
        : performance.now() - drainStartedAtRef.current;

      if (
        elapsed >= maxPresentationMs ||
        (drain && drainElapsed >= maxDrainMs)
      ) {
        finish(source);
        return;
      }

      const currentLength = displayedRef.current.length;
      const backlog = Math.max(0, source.length - currentLength);
      if (backlog === 0) {
        finish(source);
        return;
      }

      const chunkSize = temporalChunkSize({ backlog, draining: drain });
      const nextLength = Math.min(source.length, currentLength + chunkSize);
      const chunk = source.slice(currentLength, nextLength);
      const nextText = source.slice(0, nextLength);
      displayedRef.current = nextText;
      setDisplayedText(nextText);

      if (nextLength >= source.length) {
        finish(source);
        return;
      }
      timerRef.current = window.setTimeout(
        revealNextChunk,
        temporalDelayMs(chunk, drain),
      );
    };

    revealNextChunk();
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    active,
    documentHidden,
    drain,
    maxDrainMs,
    maxPresentationMs,
    reducedMotion,
    text,
  ]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    displayedText,
    phase,
    isCaughtUp: phase === "complete",
  };
}
