import React from 'react';
import { useTextStream } from '@/hooks/useTextStream';
import EnhancedMarkdown from './EnhancedMarkdown';

/**
 * StreamingResponseProps
 */
export interface StreamingResponseProps {
  /** 消息内容 */
  content: string;
  /** 是否可以开始打字机效果 */
  canStart: boolean;
  /** 打字机效果完成时的回调 */
  onComplete?: () => void;
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
  onComplete,
  className = "text-gray-800 mb-6",
}: StreamingResponseProps) {
  const completedRef = React.useRef(false);

  // 只有当 canStart 为 true 时才开始打字机效果
  const { displayedText, isComplete } = useTextStream({
    textStream: canStart ? content : "",
    speed: 5,
    mode: "typewriter",
    onComplete: () => {
      // 打字机完成时调用 onComplete
      if (!completedRef.current && onComplete) {
        completedRef.current = true;
        console.log("[StreamingResponse] 打字机效果完成");
        onComplete();
      }
    },
  });

  // 重置 completedRef 当 content 变化时
  React.useEffect(() => {
    if (content) {
      completedRef.current = false;
    }
  }, [content]);

  // 如果不能开始或没有内容，不显示
  if (!canStart || !content) {
    return null;
  }

  // 显示打字机效果的文本
  const textToShow = displayedText;

  if (!textToShow) {
    return null;
  }

  return (
    <div className={className}>
      <EnhancedMarkdown>{textToShow}</EnhancedMarkdown>
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
      )}
    </div>
  );
}
