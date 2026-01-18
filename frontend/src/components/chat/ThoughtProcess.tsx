/**
 * ThoughtProcess 组件 - 显示 AI 的思考过程
 *
 * 完全复刻自 sophia-pro 项目的 ThinkingMessage 组件
 * 样式：灰色文字、可折叠、简洁风格
 * 支持打字机效果
 */

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { useTextStream } from '@/hooks/useTextStream';

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
    /** 打字机效果完成时的回调 */
    onComplete?: () => void;
}

/**
 * ThoughtProcess 组件 - 显示 AI 的思考过程
 *
 * 完全复刻自 sophia-pro 的 ThinkingMessage 组件样式
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
    className = '',
    onComplete,
}: ThoughtProcessProps) {
    // 如果传入了 isLatest，则使用 isLatest 来决定初始状态，否则使用 defaultExpanded
    const [expanded, setExpanded] = useState(
        isLatest !== undefined ? isLatest : defaultExpanded
    );

    // 当 isLatest 状态变化时更新展开状态
    useEffect(() => {
        if (isLatest !== undefined) {
            setExpanded(isLatest);
        }
    }, [isLatest]);

    // 如果没有内容，不显示
    if (!content || !content.trim()) {
        return null;
    }

    // 流式传输时使用打字机效果，非流式传输时直接显示
    const shouldUseTypewriter = isLatest && isStreaming;
    const { displayedText, isComplete } = useTextStream({
        textStream: shouldUseTypewriter ? content : '',
        speed: 15, // 与 response 相同的速度
        mode: 'typewriter',
        onComplete: () => {
            // 打字机效果完成时，通知父组件
            if (shouldUseTypewriter && onComplete) {
                console.log('[ThoughtProcess] 打字机效果完成');
                onComplete();
            }
        },
    });

    // 流式传输时使用打字机效果显示，否则直接显示完整内容
    const textToShow = shouldUseTypewriter ? displayedText : content;

    const triggerText = 'Thought Process';

    return (
        <div className={`thinking-message rounded-lg px-0 py-1 mb-2 ${className}`}>
            {/* Trigger - 复刻 sophia-pro 样式 */}
            <div
                className="cursor-pointer flex items-center gap-2 py-1"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex gap-1 items-center">
                    <span className="text-neutral-500 text-sm font-normal">{triggerText}</span>
                    <ChevronUp
                        size={12}
                        className={`text-neutral-400 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`}
                    />
                </div>
                {isStreaming && (
                    <div className="flex gap-1 ml-1">
                        <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                        <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                    </div>
                )}
            </div>

            {/* Content - 复刻 sophia-pro 样式：灰色文字，无背景 */}
            {expanded && (
                <div className="text-neutral-500 text-sm leading-relaxed pl-0 font-normal">
                    {textToShow}
                    {shouldUseTypewriter && !isComplete && (
                        <span className="inline-block w-0.5 h-3 bg-neutral-400 animate-pulse ml-0.5" />
                    )}
                </div>
            )}
        </div>
    );
}

