/**
 * useTextStream Hook - 简化版
 *
 * 设计目标：
 * - 不做 burst smoothing / 补帧
 * - 直接贴近上游流式文本
 * - 保留原有 API 形状，降低调用方改造成本
 */

import { useState, useEffect, useRef, useCallback } from "react";

export type Mode = "typewriter" | "fade";
export type UseTextStreamOptions = {
  textStream: string | AsyncIterable<string>;
  speed?: number;
  mode?: Mode;
  onComplete?: () => void;
  fadeDuration?: number;
  segmentDelay?: number;
  characterChunkSize?: number;
  onError?: (error: unknown) => void;
};

export type UseTextStreamResult = {
  displayedText: string;
  isComplete: boolean;
  segments: { text: string; index: number }[];
  getFadeDuration: () => number;
  getSegmentDelay: () => number;
  reset: () => void;
  startStreaming: () => void;
  pause: () => void;
  resume: () => void;
};

function splitSegments(text: string): { text: string; index: number }[] {
  if (!text) return [];
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((word, index) => ({ text: word, index }));
}

function useTextStream({
  textStream,
  speed = 20,
  mode = "typewriter",
  onComplete,
  fadeDuration,
  segmentDelay,
  onError,
}: UseTextStreamOptions): UseTextStreamResult {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [segments, setSegments] = useState<{ text: string; index: number }[]>(
    [],
  );

  const isPausedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const getFadeDuration = useCallback(() => {
    if (typeof fadeDuration === "number") return Math.max(10, fadeDuration);
    const normalized = Math.min(100, Math.max(1, speed));
    return Math.round(1000 / Math.sqrt(normalized));
  }, [fadeDuration, speed]);

  const getSegmentDelay = useCallback(() => {
    if (typeof segmentDelay === "number") return Math.max(0, segmentDelay);
    const normalized = Math.min(100, Math.max(1, speed));
    return Math.max(1, Math.round(100 / Math.sqrt(normalized)));
  }, [segmentDelay, speed]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isPausedRef.current = false;
    setDisplayedText("");
    setSegments([]);
    setIsComplete(false);
  }, []);

  const updateDisplay = useCallback(
    (nextText: string) => {
      setDisplayedText(nextText);
      if (mode === "fade") {
        setSegments(splitSegments(nextText));
      }
    },
    [mode],
  );

  const runString = useCallback(
    (text: string) => {
      if (isPausedRef.current) return;
      updateDisplay(text);
      setIsComplete(true);
      onCompleteRef.current?.();
    },
    [updateDisplay],
  );

  const runAsync = useCallback(
    async (stream: AsyncIterable<string>) => {
      const controller = new AbortController();
      abortRef.current = controller;
      let aggregated = "";
      setIsComplete(false);
      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted || isPausedRef.current) return;
          aggregated += chunk;
          updateDisplay(aggregated);
        }
        setIsComplete(true);
        onCompleteRef.current?.();
      } catch (error) {
        onError?.(error);
        setIsComplete(true);
      }
    },
    [onError, updateDisplay],
  );

  const startStreaming = useCallback(() => {
    if (typeof textStream === "string") {
      runString(textStream || "");
      return;
    }
    reset();
    runAsync(textStream);
  }, [runAsync, runString, reset, textStream]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    startStreaming();
  }, [startStreaming]);

  useEffect(() => {
    startStreaming();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [startStreaming]);

  return {
    displayedText,
    isComplete,
    segments,
    getFadeDuration,
    getSegmentDelay,
    reset,
    startStreaming,
    pause,
    resume,
  };
}

export { useTextStream };
