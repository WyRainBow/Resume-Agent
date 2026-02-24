import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTextStream } from './useTextStream';

interface UseTypewriterOptions {
  initialDelay?: number;
  baseDelay?: number;
  punctuationDelay?: number;
  enableSmartTokenization?: boolean;
  speedVariation?: number;
  maxBufferSize?: number;
  speed?: number;
  enabled?: boolean;
  onComplete?: () => void;
  delay?: number;
}

interface UseTypewriterResult {
  text: string;
  isTyping: boolean;
  appendContent: (content: string) => void;
  skipToEnd: () => void;
  reset: () => void;
}

function toStreamSpeed(speed: number): number {
  // legacy speed 默认 1-5，这里映射到 useTextStream 1-100 区间
  const normalized = Math.max(1, Math.min(5, speed || 1));
  return Math.max(5, normalized * 20);
}

/**
 * 兼容层：历史 API (`appendContent/reset/skipToEnd`) 统一转到 useTextStream。
 */
export function useTypewriter(
  options: UseTypewriterOptions = {},
): UseTypewriterResult {
  const {
    speed = 1,
    enabled = true,
    onComplete,
    initialDelay = 100,
    delay = 30,
    baseDelay: _baseDelay,
    punctuationDelay: _punctuationDelay,
    enableSmartTokenization: _enableSmartTokenization,
    speedVariation: _speedVariation,
    maxBufferSize: _maxBufferSize,
  } = options;

  const [targetText, setTargetText] = useState('');
  const [skipMode, setSkipMode] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const { displayedText, reset: resetStream } = useTextStream({
    textStream: enabled ? targetText : targetText,
    mode: 'typewriter',
    speed: toStreamSpeed(speed),
    segmentDelay: delay,
    // initialDelay 通过第一次 append 时延后注入处理
  });

  const text = useMemo(() => {
    if (!enabled) return targetText;
    if (skipMode) return targetText;
    return displayedText;
  }, [displayedText, enabled, skipMode, targetText]);

  const isTyping = useMemo(() => {
    if (!enabled) return false;
    if (skipMode) return false;
    return text.length < targetText.length;
  }, [enabled, skipMode, targetText.length, text.length]);

  const appendContent = useCallback(
    (content: string) => {
      if (!content) return;
      completedRef.current = false;
      setSkipMode(false);
      if (!enabledRef.current) {
        setTargetText((prev) => prev + content);
        return;
      }
      if (initialDelay > 0 && !targetText) {
        window.setTimeout(() => {
          setTargetText((prev) => prev + content);
        }, initialDelay);
      } else {
        setTargetText((prev) => prev + content);
      }
    },
    [initialDelay, targetText],
  );

  const reset = useCallback(() => {
    setSkipMode(false);
    setTargetText('');
    completedRef.current = false;
    resetStream();
  }, [resetStream]);

  const skipToEnd = useCallback(() => {
    setSkipMode(true);
    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!skipMode && targetText.length > 0 && text.length >= targetText.length && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, [enabled, skipMode, targetText.length, text.length]);

  return {
    text,
    isTyping,
    appendContent,
    skipToEnd,
    reset,
  };
}

interface UseTypewriterSimpleOptions {
  speed?: number;
  enabled?: boolean;
  onComplete?: () => void;
  delay?: number;
}

export function useTypewriterSimple(
  targetContent: string,
  options: UseTypewriterSimpleOptions = {},
) {
  const { speed = 1, enabled = true, onComplete, delay = 30 } = options;

  const { displayedText } = useTextStream({
    textStream: targetContent,
    mode: 'typewriter',
    speed: toStreamSpeed(speed),
    segmentDelay: delay,
    onComplete,
  });

  if (!enabled) return targetContent;
  return displayedText;
}
