import React from "react";

interface AssistantPaperCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AI 回复容器：去卡片化的纯文本流（对齐 Claude 对话设计）。
 * 不再使用边框/背景/阴影/左竖条，让回答像文档一样铺在画布上，
 * 与右侧用户气泡形成「左文档 / 右气泡」对比。
 * 内部子卡片（搜索/简历/诊断）各自带边框背景，去掉外层卡片不影响其辨识度。
 */
export function AssistantPaperCard({
  children,
  className = "",
}: AssistantPaperCardProps) {
  return (
    <div className={`chat-message-enter group mb-6 ${className}`}>
      {children}
    </div>
  );
}
