/**
 * useTextStream Hook - 处理文本流式输出
 *
 * 默认策略：真实流优先（realtime）
 * 可选策略：burst-smoothed（仅在突发大块增量时做短时平滑）
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type Mode = 'typewriter' | 'fade';
export type StreamMode = 'realtime' | 'burst-smoothed';

export type UseTextStreamOptions = {
  textStream: string | AsyncIterable<string>;
  speed?: number;
  mode?: Mode;
  onComplete?: () => void;
  fadeDuration?: number;
  segmentDelay?: number;
  characterChunkSize?: number;
  onError?: (error: unknown) => void;
  streamMode?: StreamMode;
  burstThreshold?: number;
  smoothingWindowMs?: number;
  maxCharsPerFrame?: number;
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

const IS_DEV = import.meta.env.DEV;

function getLongestCommonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i += 1;
  return i;
}

function useTextStream({
  textStream,
  speed = 20,
  mode = 'typewriter',
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
  onError,
  streamMode = 'realtime',
  burstThreshold = 24,
  smoothingWindowMs = 120,
  maxCharsPerFrame = 12,
}: UseTextStreamOptions): UseTextStreamResult {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [segments, setSegments] = useState<{ text: string; index: number }[]>(
    []
  );

  const speedRef = useRef(speed);
  const modeRef = useRef(mode);
  const streamModeRef = useRef(streamMode);
  const burstThresholdRef = useRef(burstThreshold);
  const smoothingWindowMsRef = useRef(smoothingWindowMs);
  const maxCharsPerFrameRef = useRef(maxCharsPerFrame);

  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<AbortController | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  const targetTextRef = useRef('');
  const displayedLengthRef = useRef(0);
  const frameTsRef = useRef(0);
  const carryCharsRef = useRef(0);
  const isPausedRef = useRef(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  const metricsRef = useRef({
    smoothingActivations: 0,
    smoothedChars: 0,
    instantUpdates: 0,
  });

  useEffect(() => {
    speedRef.current = speed;
    modeRef.current = mode;
    streamModeRef.current = streamMode;
    burstThresholdRef.current = burstThreshold;
    smoothingWindowMsRef.current = smoothingWindowMs;
    maxCharsPerFrameRef.current = Math.max(1, maxCharsPerFrame);
  }, [speed, mode, streamMode, burstThreshold, smoothingWindowMs, maxCharsPerFrame]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const getFadeDuration = useCallback(() => {
    if (typeof fadeDuration === 'number') return Math.max(10, fadeDuration);
    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.round(1000 / Math.sqrt(normalizedSpeed));
  }, [fadeDuration]);

  const getSegmentDelay = useCallback(() => {
    if (typeof segmentDelay === 'number') return Math.max(0, segmentDelay);
    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
  }, [segmentDelay]);

  const updateSegments = useCallback(
    (text: string) => {
      if (modeRef.current !== 'fade') return;
      try {
        const segmenter = new (Intl as any).Segmenter(navigator.language, {
          granularity: 'word',
        });
        const segmentIterator = segmenter.segment(text);
        const newSegments = Array.from(segmentIterator).map(
          (segment: any, index: number) => ({
            text: segment.segment,
            index,
          })
        );
        setSegments(newSegments);
      } catch (error) {
        const newSegments = text
          .split(/(\s+)/)
          .filter(Boolean)
          .map((word, index) => ({ text: word, index }));
        setSegments(newSegments);
        onError?.(error);
      }
    },
    [onError]
  );

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const markComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsComplete(true);
    onCompleteRef.current?.();
    if (IS_DEV) {
      console.debug('[TextStreamMetrics]', {
        streamMode: streamModeRef.current,
        smoothingActivations: metricsRef.current.smoothingActivations,
        smoothedChars: metricsRef.current.smoothedChars,
        instantUpdates: metricsRef.current.instantUpdates,
        finalLength: targetTextRef.current.length,
      });
    }
  }, []);

  const scheduleComplete = useCallback(() => {
    clearSettleTimer();
    const settleMs = streamModeRef.current === 'realtime' ? 140 : 180;
    settleTimerRef.current = window.setTimeout(() => {
      if (displayedLengthRef.current >= targetTextRef.current.length) {
        markComplete();
      }
    }, settleMs);
  }, [clearSettleTimer, markComplete]);

  const setDisplayedLength = useCallback(
    (nextLen: number) => {
      const nextText = targetTextRef.current.slice(0, nextLen);
      displayedLengthRef.current = nextLen;
      setDisplayedText(nextText);
      if (modeRef.current === 'fade') updateSegments(nextText);
    },
    [updateSegments]
  );

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const getSmoothCharsPerSecond = useCallback(() => {
    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    const base = 160 + normalizedSpeed * 4.2;
    const windowFactor = Math.max(0.6, Math.min(1.8, 120 / Math.max(40, smoothingWindowMsRef.current)));
    return base * windowFactor;
  }, []);

  const runSmoothing = useCallback(() => {
    if (animationRef.current !== null) return;

    metricsRef.current.smoothingActivations += 1;

    const tick = (ts: number) => {
      if (isPausedRef.current) {
        animationRef.current = null;
        return;
      }

      if (frameTsRef.current === 0) {
        frameTsRef.current = ts;
      }
      const dt = ts - frameTsRef.current;
      frameTsRef.current = ts;

      const cps = getSmoothCharsPerSecond();
      carryCharsRef.current += (dt / 1000) * cps;
      let step = Math.floor(carryCharsRef.current);
      if (step <= 0) step = 1;
      carryCharsRef.current -= step;
      step = Math.min(step, maxCharsPerFrameRef.current);

      const targetLen = targetTextRef.current.length;
      const currentLen = displayedLengthRef.current;

      if (currentLen >= targetLen) {
        animationRef.current = null;
        scheduleComplete();
        return;
      }

      const nextLen = Math.min(targetLen, currentLen + step);
      metricsRef.current.smoothedChars += nextLen - currentLen;
      setDisplayedLength(nextLen);

      if (nextLen >= targetLen) {
        animationRef.current = null;
        scheduleComplete();
        return;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    frameTsRef.current = 0;
    animationRef.current = requestAnimationFrame(tick);
  }, [getSmoothCharsPerSecond, scheduleComplete, setDisplayedLength]);

  const reset = useCallback(() => {
    stopAnimation();
    clearSettleTimer();
    targetTextRef.current = '';
    displayedLengthRef.current = 0;
    frameTsRef.current = 0;
    carryCharsRef.current = 0;
    completedRef.current = false;
    isPausedRef.current = false;
    setDisplayedText('');
    setSegments([]);
    setIsComplete(false);
    metricsRef.current = {
      smoothingActivations: 0,
      smoothedChars: 0,
      instantUpdates: 0,
    };
  }, [stopAnimation, clearSettleTimer]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    stopAnimation();
    clearSettleTimer();
  }, [stopAnimation, clearSettleTimer]);

  const resume = useCallback(() => {
    if (!isPausedRef.current || typeof textStream !== 'string') return;
    isPausedRef.current = false;
    if (streamModeRef.current === 'burst-smoothed') {
      runSmoothing();
    } else {
      scheduleComplete();
    }
  }, [runSmoothing, scheduleComplete, textStream]);

  const processAsyncIterable = useCallback(
    async (stream: AsyncIterable<string>) => {
      const controller = new AbortController();
      streamRef.current = controller;

      let displayed = '';
      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted || isPausedRef.current) return;
          displayed += chunk;
          targetTextRef.current = displayed;
          setDisplayedLength(displayed.length);
          completedRef.current = false;
          setIsComplete(false);
        }
        scheduleComplete();
      } catch (error) {
        console.error('Error processing text stream:', error);
        onError?.(error);
        scheduleComplete();
      }
    },
    [onError, scheduleComplete, setDisplayedLength]
  );

  const processStringInput = useCallback((incomingText: string) => {
    const prevTarget = targetTextRef.current;

    if (incomingText.length === 0) {
      if (!prevTarget) reset();
      return;
    }

    completedRef.current = false;
    setIsComplete(false);
    clearSettleTimer();

    const isAppend = prevTarget.length > 0 && incomingText.startsWith(prevTarget);
    const isSame = incomingText === prevTarget;

    if (!isAppend && !isSame) {
      stopAnimation();
      frameTsRef.current = 0;
      carryCharsRef.current = 0;
      // 非 append 场景（例如上游修正文本）保留公共前缀，避免从 0 重打造成卡顿感。
      const lcpLen = getLongestCommonPrefixLength(prevTarget, incomingText);
      setDisplayedLength(Math.min(displayedLengthRef.current, lcpLen));
    }

    targetTextRef.current = incomingText;

    if (streamModeRef.current === 'realtime') {
      metricsRef.current.instantUpdates += 1;
      stopAnimation();
      setDisplayedLength(incomingText.length);
      scheduleComplete();
      return;
    }

    // burst-smoothed mode
    const remaining = incomingText.length - displayedLengthRef.current;
    if (remaining <= 0) {
      scheduleComplete();
      return;
    }

    // 小增量不平滑，直接贴近真实流；突发大块才启动平滑
    if (remaining <= burstThresholdRef.current && animationRef.current === null) {
      metricsRef.current.instantUpdates += 1;
      setDisplayedLength(incomingText.length);
      scheduleComplete();
      return;
    }

    runSmoothing();
  }, [clearSettleTimer, reset, runSmoothing, scheduleComplete, setDisplayedLength, stopAnimation]);

  const startStreaming = useCallback(() => {
    if (typeof textStream === 'string') {
      processStringInput(textStream);
      return;
    }
    if (textStream) {
      reset();
      processAsyncIterable(textStream);
    }
  }, [processAsyncIterable, processStringInput, reset, textStream]);

  useEffect(() => {
    startStreaming();

    return () => {
      stopAnimation();
      clearSettleTimer();
      if (streamRef.current) {
        streamRef.current.abort();
      }
    };
  }, [startStreaming, stopAnimation, clearSettleTimer]);

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
