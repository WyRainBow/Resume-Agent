/**
 * ResponseStream 组件 - 流式输出和打字机效果
 *
 * 复刻自 sophia-pro 项目的流式输出功能，支持：
 * - 流式文本输出
 * - 打字机效果
 * - 淡入效果
 * - 暂停/恢复功能
 * - AsyncIterable 流式输入
 */

import React, { useEffect } from 'react';
import { useTextStream } from '@/hooks/useTextStream';

// useTextStream Hook 已提取到 @/hooks/useTextStream
// 这里保留导出以保持向后兼容
export { useTextStream } from '@/hooks/useTextStream';
export type { UseTextStreamOptions, UseTextStreamResult } from '@/hooks/useTextStream';

/**
 * ResponseStream 组件的 Props
 */
export interface ResponseStreamProps {
  /** 文本流（字符串或异步迭代器） */
  textStream: string | AsyncIterable<string>;
  /** 显示模式：打字机或淡入 */
  mode?: 'typewriter' | 'fade';
  /** 速度（1-100，默认20） */
  speed?: number;
  /** CSS 类名 */
  className?: string;
  /** 完成回调函数 */
  onComplete?: () => void;
  /** 渲染的 HTML 标签 */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * ResponseStream 组件 - 流式文本显示组件
 *
 * 支持打字机效果和淡入效果两种模式
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <ResponseStream
 *   textStream="Hello World"
 *   mode="typewriter"
 *   speed={20}
 *   onComplete={() => console.log('Done!')}
 * />
 * ```
 */
export default function ResponseStream({
  textStream,
  mode = 'typewriter',
  speed = 20,
  className = '',
  onComplete,
  as: Container = 'div',
}: ResponseStreamProps) {
  const {
    displayedText,
    isComplete,
    segments,
  } = useTextStream({
    textStream,
    speed,
    mode,
    onComplete,
  });

  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // 淡入样式
  const fadeStyle = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .fade-segment {
      display: inline-block;
      opacity: 0;
      animation: fadeIn 300ms ease-out forwards;
    }

    .fade-segment-space {
      white-space: pre;
    }
  `;

  const renderContent = () => {
    switch (mode) {
      case 'typewriter':
        return <>{displayedText}</>;

      case 'fade':
        return (
          <>
            <style>{fadeStyle}</style>
            <div className="relative">
              {segments.map((segment, idx) => {
                const isWhitespace = /^\s+$/.test(segment.text);

                return (
                  <span
                    key={`${segment.text}-${idx}`}
                    className={`fade-segment ${isWhitespace ? 'fade-segment-space' : ''}`}
                    style={{
                      animationDelay: `${idx * 50}ms`,
                    }}
                  >
                    {segment.text}
                  </span>
                );
              })}
            </div>
          </>
        );

      default:
        return <>{displayedText}</>;
    }
  };

  return React.createElement(Container, { className }, renderContent());
}

