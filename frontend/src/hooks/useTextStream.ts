/**
 * useTextStream Hook - 处理文本流式输出
 *
 * 从 ResponseStream.tsx 中提取的独立 Hook
 * 支持打字机效果和增量更新
 *
 * 关键功能：
 * - 支持增量更新（新内容追加时不重置）
 * - 使用 requestAnimationFrame 实现流畅动画（60fps）
 * - 支持顺序控制（Thought → Response）
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type Mode = 'typewriter' | 'fade';

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

function useTextStream({
  textStream,
  speed = 20,
  mode = 'typewriter',
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
  onError,
}: UseTextStreamOptions): UseTextStreamResult {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [segments, setSegments] = useState<{ text: string; index: number }[]>(
    []
  );

  const speedRef = useRef(speed);
  const modeRef = useRef(mode);
  const currentIndexRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const fadeDurationRef = useRef(fadeDuration);
  const segmentDelayRef = useRef(segmentDelay);
  const characterChunkSizeRef = useRef(characterChunkSize);
  const streamRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const isPausedRef = useRef(false);
  // 用于跟踪增量更新的 refs
  const prevTextLengthRef = useRef(0);  // 之前的文本长度，用于检测增量更新
  const fullTextRef = useRef('');       // 完整的目标文本，用于增量更新时的打字机效果

  useEffect(() => {
    speedRef.current = speed;
    modeRef.current = mode;
    fadeDurationRef.current = fadeDuration;
    segmentDelayRef.current = segmentDelay;
    characterChunkSizeRef.current = characterChunkSize;
  }, [speed, mode, fadeDuration, segmentDelay, characterChunkSize]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const getChunkSize = useCallback(() => {
    if (typeof characterChunkSizeRef.current === 'number') {
      return Math.max(1, characterChunkSizeRef.current);
    }

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));

    if (modeRef.current === 'typewriter') {
      if (normalizedSpeed < 25) return 1;
      return Math.max(1, Math.round((normalizedSpeed - 25) / 10));
    } else if (modeRef.current === 'fade') {
      return 1;
    }

    return 1;
  }, []);

  const getProcessingDelay = useCallback(() => {
    if (typeof segmentDelayRef.current === 'number') {
      return Math.max(0, segmentDelayRef.current);
    }

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
  }, []);

  const getFadeDuration = useCallback(() => {
    if (typeof fadeDurationRef.current === 'number')
      return Math.max(10, fadeDurationRef.current);

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.round(1000 / Math.sqrt(normalizedSpeed));
  }, []);

  const getSegmentDelay = useCallback(() => {
    if (typeof segmentDelayRef.current === 'number')
      return Math.max(0, segmentDelayRef.current);

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
  }, []);

  const updateSegments = useCallback((text: string) => {
    if (modeRef.current === 'fade') {
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
          .map((word, index) => ({
            text: word,
            index,
          }));
        setSegments(newSegments);
        onError?.(error);
      }
    }
  }, [onError]);

  const markComplete = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      setIsComplete(true);
      onCompleteRef.current?.();
    }
  }, []);

  const reset = useCallback(() => {
    currentIndexRef.current = 0;
    setDisplayedText('');
    setSegments([]);
    setIsComplete(false);
    completedRef.current = false;
    isPausedRef.current = false;
    prevTextLengthRef.current = 0;
    fullTextRef.current = '';

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (isPausedRef.current && typeof textStream === 'string') {
      isPausedRef.current = false;
      processStringTypewriter(textStream);
    }
  }, [textStream]);

  const processStringTypewriter = useCallback(
    (text: string) => {
      let lastFrameTime = 0;

      const streamContent = (timestamp: number) => {
        const delay = getProcessingDelay();
        if (delay > 0 && timestamp - lastFrameTime < delay) {
          animationRef.current = requestAnimationFrame(streamContent);
          return;
        }
        lastFrameTime = timestamp;

        // 使用最新的文本（支持动态变化）
        const currentText = fullTextRef.current || text;

        if (currentIndexRef.current >= currentText.length) {
          // 如果是增量更新，检查是否有新内容
          const latestText = fullTextRef.current;
          if (latestText && latestText.length > currentIndexRef.current) {
            // 有新内容，继续打字（使用最新文本）
            animationRef.current = requestAnimationFrame(streamContent);
            return;
          }
          // 没有新内容了，标记完成
          markComplete();
          return;
        }

        const chunkSize = getChunkSize();
        const endIndex = Math.min(
          currentIndexRef.current + chunkSize,
          currentText.length
        );
        const newDisplayedText = currentText.slice(0, endIndex);

        setDisplayedText(newDisplayedText);
        if (modeRef.current === 'fade') {
          updateSegments(newDisplayedText);
        }

        currentIndexRef.current = endIndex;

        if (endIndex < currentText.length) {
          animationRef.current = requestAnimationFrame(streamContent);
        } else {
          markComplete();
        }
      };

      animationRef.current = requestAnimationFrame(streamContent);
    },
    [getProcessingDelay, getChunkSize, updateSegments, markComplete]
  );

  const processAsyncIterable = useCallback(
    async (stream: AsyncIterable<string>) => {
      const controller = new AbortController();
      streamRef.current = controller;

      let displayed = '';

      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted || isPausedRef.current) return;

          displayed += chunk;
          setDisplayedText(displayed);
          updateSegments(displayed);
        }

        markComplete();
      } catch (error) {
        console.error('Error processing text stream:', error);
        markComplete();
      }
    },
    [updateSegments, markComplete]
  );

  const startStreaming = useCallback(() => {
    if (typeof textStream === 'string') {
      // 检查是否是增量更新（流式传输）
      // 增量更新：新长度 > 旧长度 且 旧长度 > 0
      const isIncremental = textStream.length > prevTextLengthRef.current && prevTextLengthRef.current > 0;

      // 更新目标文本
      fullTextRef.current = textStream;

      if (isIncremental) {
        // 增量更新：只更新目标文本，继续打字机效果
        // 如果还没有开始打字机效果，现在开始
        if (!animationRef.current && !completedRef.current) {
          processStringTypewriter(textStream);
        }
        // 如果打字机效果已经完成但文本还在增长，继续打字
        if (completedRef.current && textStream.length > currentIndexRef.current) {
          setIsComplete(false);
          completedRef.current = false;
          // 不要重置 currentIndexRef，继续从当前位置打字
          if (!animationRef.current) {
            processStringTypewriter(textStream);
          }
        }
        // 更新长度记录
        prevTextLengthRef.current = textStream.length;
      } else {
        // 全新文本：重置并开始打字机效果
        if (textStream.length > 0 && prevTextLengthRef.current === 0) {
          // 从空字符串变为有内容，重置并开始
          reset();
          processStringTypewriter(textStream);
          prevTextLengthRef.current = textStream.length;
        } else if (textStream.length === 0 && prevTextLengthRef.current > 0) {
          // 从有内容变为空，可能是消息完成，不重置，让打字机效果继续完成
          // 不执行任何操作，让打字机效果自然完成
          prevTextLengthRef.current = 0;
        } else if (textStream.length < prevTextLengthRef.current) {
          // 文本变短：重置
          reset();
          prevTextLengthRef.current = textStream.length;
        } else if (textStream.length === prevTextLengthRef.current && textStream.length > 0) {
          // 文本长度不变但内容可能变了，需要重新开始
          reset();
          processStringTypewriter(textStream);
          prevTextLengthRef.current = textStream.length;
        } else {
          prevTextLengthRef.current = textStream.length;
        }
      }
    } else if (textStream) {
      reset();
      processAsyncIterable(textStream);
    }
  }, [textStream, reset, processStringTypewriter, processAsyncIterable]);

  useEffect(() => {
    startStreaming();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.abort();
      }
    };
  }, [textStream, startStreaming]);

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
