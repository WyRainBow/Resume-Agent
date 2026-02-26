/**
 * ThoughtProcess 组件 - 显示 AI 的思考过程
 *
 * ThinkingMessage 组件
 * 样式：灰色文字、可折叠、简洁风格
 * 支持打字机效果
 */

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { useTextStream } from "@/hooks/useTextStream";

/**
 * ThoughtProcess 组件的 Props
 */
export interface ThoughtProcessProps {
  /** 思考内容 */
  content: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 是否是最新消息 */
  isLatest?: boolean;
  /** CSS 类名 */
  className?: string;
}

/**
 * ThoughtProcess 组件 - 显示 AI 的思考过程
 *
 * ThinkingMessage 组件样式
 * - 灰色文字（text-neutral-600）
 * - 可折叠/展开
 * - 简洁风格，无边框背景
 *
 * @param props - 组件属性
 * @returns React 组件
 */
export default function ThoughtProcess({
  content,
  isStreaming = false,
  defaultExpanded = true,
  isLatest,
  className = "",
}: ThoughtProcessProps) {
  const { displayedText, isComplete } = useTextStream({
    textStream: content || "",
    mode: "typewriter",
    speed: 2,
    streamMode: "burst-smoothed",
    burstThreshold: 0,
    maxCharsPerFrame: 1,
    smoothingWindowMs: 110,
  });

  // 如果传入了 isLatest，则使用 isLatest 来决定初始状态，否则使用 defaultExpanded
  const [expanded, setExpanded] = useState(
    isLatest !== undefined ? isLatest : defaultExpanded,
  );

  // 当 isLatest 状态变化时更新展开状态
  useEffect(() => {
    if (isLatest !== undefined) {
      setExpanded(isLatest);
    }
  }, [isLatest]);

  const textToShow = isStreaming ? displayedText : content;
  const showTypingTail = isStreaming && !isComplete && textToShow.length > 0;

  // 如果没有内容，不显示
  if (!textToShow || !textToShow.trim()) {
    return null;
  }

  const triggerText = "Thought Process";

  return (
    <div className={`thinking-message rounded-lg px-0 py-1 mb-2 ${className}`}>
      {/* Trigger */}
      <div
        className="cursor-pointer flex items-center gap-2 py-1"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex gap-1 items-center">
          <span className="text-neutral-500 text-sm font-normal">
            {triggerText}
          </span>
          <ChevronUp
            size={12}
            className={`text-neutral-400 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}
          />
        </div>
        {isStreaming && (
          <div className="flex gap-1 ml-1">
            <span
              className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></span>
            <span
              className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce"
              style={{ animationDelay: "100ms" }}
            ></span>
            <span
              className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce"
              style={{ animationDelay: "200ms" }}
            ></span>
          </div>
        )}
      </div>

      {/* Content：灰色文字，无背景 */}
      {expanded && (
        <div className="text-neutral-500 text-sm leading-relaxed pl-0 font-normal">
          <span className="whitespace-pre-wrap break-words">{textToShow}</span>
          {showTypingTail && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-neutral-400 align-middle">
              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
