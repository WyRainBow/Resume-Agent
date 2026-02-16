import React from 'react';
import ThoughtProcess from './ThoughtProcess';
import StreamingResponse from './StreamingResponse';

/**
 * StreamingOutputPanelProps
 */
export interface StreamingOutputPanelProps {
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
  /** 渲染搜索卡片的回调（可选） */
  renderSearchCard?: (searchData: any) => React.ReactNode;
  /** 额外的渲染内容（可选，如 ReportGenerationDetector） */
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
  currentThought,
  currentAnswer,
  isProcessing,
  shouldHideResponseInChat = false,
  currentSearch,
  renderSearchCard,
  children,
}: StreamingOutputPanelProps) {
  
  if (!isProcessing || (!currentThought && (!currentAnswer || shouldHideResponseInChat))) {
    return null;
  }

  const canShowSubsequentContent = true;

  return (
    <>
      {/* 1. Thought Process 优先显示 */}
      {currentThought && (
        <ThoughtProcess
          content={currentThought}
          isStreaming={true}
          isLatest={true}
          defaultExpanded={true}
        />
      )}

      {/* 2. 搜索卡片在 Thought Process 完成后、Response 之前显示 */}
      {canShowSubsequentContent && currentSearch && renderSearchCard && (
        <div className="my-4">
          {renderSearchCard(currentSearch.data)}
        </div>
      )}

      {/* 3. Response 最后显示 */}
      <StreamingResponse
        content={currentAnswer}
        canStart={!shouldHideResponseInChat}
      />

      {/* 4. 额外的检测器或卡片 */}
      {canShowSubsequentContent && children}
    </>
  );
}
