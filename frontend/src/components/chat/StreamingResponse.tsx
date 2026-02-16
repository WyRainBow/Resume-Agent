import React from "react";
import EnhancedMarkdown from "./EnhancedMarkdown";

/**
 * StreamingResponseProps
 */
export interface StreamingResponseProps {
  /** 消息内容 */
  content: string;
  /** 是否可以开始显示 */
  canStart: boolean;
  /** CSS 类名 */
  className?: string;
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
  className = "text-gray-800 mb-6",
}: StreamingResponseProps) {
  // 如果不能开始或没有内容，不显示
  if (!canStart || !content) {
    return null;
  }

  return (
    <div className={className}>
      <EnhancedMarkdown>{content}</EnhancedMarkdown>
    </div>
  );
}
