import React, { useEffect, useRef } from 'react';
import ThoughtProcess from './ThoughtProcess';
import StreamingResponse from './StreamingResponse';
import { AssistantPaperCard } from '@/components/agent-chat/AssistantPaperCard';
import { ThinkingIndicator } from '@/components/agent-chat/ThinkingIndicator';

export interface StreamRenderModel {
  thought: string;
  answer: string;
  isProcessing: boolean;
}

/**
 * StreamingOutputPanelProps
 */
export interface StreamingOutputPanelProps {
  /** 统一渲染模型（优先） */
  streamModel?: StreamRenderModel;
  /** 当前思考内容 */
  currentThought: string;
  /** 当前回答内容 */
  currentAnswer: string;
  /** 是否正在处理中 */
  isProcessing: boolean;
  /** 是否在聊天中隐藏回答（例如正在生成报告时） */
  shouldHideResponseInChat?: boolean;
  /** 搜索结果（可选） */
  currentSearch?: {
    data: {
      query: string;
      total_results: number;
      results: any[];
      metadata?: {
        search_time?: string | number;
      };
    };
  };
  /** 简历修改前后对比（可选） */
  currentEditDiff?: {
    before?: string;
    after?: string;
  };
  /** 渲染搜索卡片的回调（可选） */
  renderSearchCard?: (searchData: any) => React.ReactNode;
  /** 渲染简历修改卡片的回调（可选） */
  renderEditDiffCard?: (diff: { before?: string; after?: string }) => React.ReactNode;
  /** 额外的渲染内容（可选） */
  children?: React.ReactNode;
}

/**
 * StreamingOutputPanel 组件 - 整合思考、搜索和回答的流式展示
 * 
 * 按照顺序显示：
 * 1. Thought Process (优先)
 * 2. Search Card (在 Thought 完成后显示)
 * 3. Streaming Response (在 Thought 完成后显示)
 * 4. Children (额外的检测器或卡片)
 */
export default function StreamingOutputPanel({
  streamModel,
  currentThought,
  currentAnswer,
  isProcessing,
  shouldHideResponseInChat = false,
  currentSearch,
  currentEditDiff,
  renderSearchCard,
  renderEditDiffCard,
  children,
}: StreamingOutputPanelProps) {
  const processingStartRef = useRef(0);
  const firstVisibleLoggedRef = useRef(false);
  const thought = streamModel?.thought ?? currentThought;
  const answer = streamModel?.answer ?? currentAnswer;
  const processing = streamModel?.isProcessing ?? isProcessing;
  const thoughtContent = thought.trim() === "正在思考..." ? "" : thought.trim();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (processing) {
      if (processingStartRef.current === 0) {
        processingStartRef.current = performance.now();
        firstVisibleLoggedRef.current = false;
      }
      if (!firstVisibleLoggedRef.current && (thought.length > 0 || answer.length > 0)) {
        firstVisibleLoggedRef.current = true;
        console.debug('[StreamMetrics]', {
          type: 'first_visible_char',
          latencyMs: Math.round(performance.now() - processingStartRef.current),
          thoughtLength: thought.length,
          answerLength: answer.length,
        });
      }
      return;
    }
    processingStartRef.current = 0;
    firstVisibleLoggedRef.current = false;
  }, [processing, thought.length, answer.length]);
  
  if (!processing) {
    return null;
  }

  // 处理中但还没有任何可见内容（思考首字未到 / 该轮回答不在对话区显示）：用星芒占位，避免空白
  if (!thoughtContent && (!answer || shouldHideResponseInChat)) {
    return (
      <AssistantPaperCard>
        <ThinkingIndicator label={shouldHideResponseInChat ? "正在整理…" : "思考中…"} />
      </AssistantPaperCard>
    );
  }

  const canShowSubsequentContent = true;

  const hasSubsequentContent =
    currentSearch ||
    answer.trim() ||
    currentEditDiff ||
    children;

  return (
    <>
      {/* 1. Thought Process 优先显示 */}
      {thoughtContent && (
        <ThoughtProcess
          content={thoughtContent}
          isStreaming={true}
          isLatest={true}
          defaultExpanded={true}
        />
      )}

      {/* 统一的纸张卡片容器，包裹所有 Assistant 输出内容 */}
      {hasSubsequentContent && (
        <AssistantPaperCard>
            {canShowSubsequentContent && currentSearch && renderSearchCard && (
              <div className="my-4">
                {renderSearchCard(currentSearch.data)}
              </div>
            )}

            <StreamingResponse
              content={answer}
              canStart={!shouldHideResponseInChat}
              isStreaming={processing}
            />

            {canShowSubsequentContent && currentEditDiff && renderEditDiffCard && (
              <div className="my-4">
                {renderEditDiffCard(currentEditDiff)}
              </div>
            )}

            {canShowSubsequentContent && children}
        </AssistantPaperCard>
      )}
    </>
  );
}
