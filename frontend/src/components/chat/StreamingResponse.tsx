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
  // 如果不能开始或没有内容，不显示
  if (!canStart || !content) {
    return null;
  }

  const { displayedText } = useTextStream({
    textStream: content,
    mode: "typewriter",
    speed: 12,
    streamMode: "burst-smoothed",
    burstThreshold: 0,
    maxCharsPerFrame: 1,
    smoothingWindowMs: 140,
    onComplete: onTypewriterComplete,
  });

  const textToShow = isStreaming ? displayedText : content;

  return (
    <div className={className}>
      {isStreaming ? (
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {textToShow}
        </div>
      ) : (
        <EnhancedMarkdown>{textToShow}</EnhancedMarkdown>
      )}
    </div>
  );
}
