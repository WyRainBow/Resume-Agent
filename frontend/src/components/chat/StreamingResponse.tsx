import React from "react";
import EnhancedMarkdown from "./EnhancedMarkdown";
import { useTextStream } from "@/hooks/useTextStream";

/**
 * StreamingResponseProps
 */
export interface StreamingResponseProps {
  /** 消息内容 */
  content: string;
  /** 是否可以开始显示 */
  canStart: boolean;
  /** 是否仍处于流式输出中 */
  isStreaming?: boolean;
  /** CSS 类名 */
  className?: string;
  /** 打字机完成回调 */
  onTypewriterComplete?: () => void;
}

/**
 * StreamingResponse 组件 - 显示 AI 的流式回答（带打字机效果）
 *
 * @param props - 组件属性
 * @returns React 组件
 */
export default function StreamingResponse({
  content,
  canStart,
  isStreaming = true,
  className = "text-gray-800 mb-6",
  onTypewriterComplete,
}: StreamingResponseProps) {
  const { displayedText } = useTextStream({
    textStream: content || "",
    mode: "typewriter",
    speed: 8,
    streamMode: "burst-smoothed",
    burstThreshold: 0,
    // 允许在掉帧时轻微追帧，减少“卡一下不动”的体感。
    maxCharsPerFrame: 2,
    smoothingWindowMs: 110,
    onComplete: onTypewriterComplete,
  });

  // 如果不能开始，不显示
  if (!canStart) {
    return null;
  }

  const textToShow = isStreaming ? displayedText : content;
  const showTypingTail = isStreaming;

  if (!textToShow && !showTypingTail) {
    return null;
  }

  return (
    <div className={className}>
      {isStreaming ? (
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {textToShow}
          {showTypingTail && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-slate-400 align-middle">
              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
            </span>
          )}
        </div>
      ) : (
        <EnhancedMarkdown>{textToShow}</EnhancedMarkdown>
      )}
    </div>
  );
}
