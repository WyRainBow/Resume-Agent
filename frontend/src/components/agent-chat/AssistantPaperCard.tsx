import React from "react";

interface AssistantPaperCardProps {
  children: React.ReactNode;
  className?: string;
}

/** AI 回复的「纸张卡片」容器，统一墨香纸感视觉 */
export function AssistantPaperCard({
  children,
  className = "",
}: AssistantPaperCardProps) {
  return (
    <div
      className={`chat-message-enter mb-4 group border border-chat-border/80 dark:border-slate-800 bg-chat-surface dark:bg-slate-900 rounded-2xl px-3 py-2.5 shadow-sm relative overflow-hidden ${className}`}
    >
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-chat-accent/35 dark:bg-amber-500/20" />
      <div className="pl-2">{children}</div>
    </div>
  );
}
