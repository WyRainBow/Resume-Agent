import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";
import DiffRichContent from "@/components/agent-chat/DiffRichContent";
import { getDiffDisplayContent } from "@/utils/resumePatch";

interface ResumeEditDiffCardProps {
  before: string;
  after: string;
}

const COLLAPSE_THRESHOLD = 300;

export default function ResumeEditDiffCard({
  before,
  after,
}: ResumeEditDiffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const beforeDisplay = getDiffDisplayContent(before);
  const afterDisplay = getDiffDisplayContent(after);
  const isLong = before.length > COLLAPSE_THRESHOLD || after.length > COLLAPSE_THRESHOLD;
  const showFull = expanded || !isLong;

  return (
    <AgentSpecialCard
      variant="accent"
      title="简历修改对比"
      subtitle="查看修改前后的差异"
      badge={
        isLong ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-chat-accent-deep transition-colors hover:text-chat-accent"
          >
            {expanded ? (
              <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>展开全部 <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 divide-x divide-chat-border/70">
        <div className="pr-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-chat-ink-muted">
            修改前
          </div>
          <div className={`${!showFull ? "relative max-h-48 overflow-hidden" : ""}`}>
            <DiffRichContent display={beforeDisplay} variant="before" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-chat-surface to-transparent" />
            )}
          </div>
        </div>
        <div className="bg-blue-50/40 pl-4 dark:bg-blue-950/20">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-700">
            修改后
          </div>
          <div className={`${!showFull ? "relative max-h-48 overflow-hidden" : ""}`}>
            <DiffRichContent display={afterDisplay} variant="after" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-blue-50/40 to-transparent" />
            )}
          </div>
        </div>
      </div>
    </AgentSpecialCard>
  );
}
