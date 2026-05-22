import React from "react";
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import ResumeSectionBlock from "@/components/agent-chat/ResumeSectionBlock";
import {
  isResumeStructuredContent,
  parseResumeMarkdown,
  splitResumeMessageFrame,
  stripDecorativeDividers,
} from "@/utils/resumeMarkdownParser";

interface ResumeMarkdownProps {
  children: string;
  className?: string;
}

const COMPACT_PROSE_CLASS =
  "prose-headings:mt-2 prose-headings:mb-1 prose-p:mb-1.5 prose-p:last:mb-0 prose-ul:mb-1.5 prose-ol:mb-1.5";

/**
 * 智能 Markdown 渲染：检测到结构化简历内容时，用 ResumeSectionBlock 卡片化展示；
 * 否则回退到 EnhancedMarkdown。
 */
export default function ResumeMarkdown({
  children,
  className = "",
}: ResumeMarkdownProps) {
  const content = typeof children === "string" ? children : String(children || "");
  const cleaned = stripDecorativeDividers(content);

  if (!cleaned.trim()) {
    return <div className={className} />;
  }

  const { prefix, core, suffix } = splitResumeMessageFrame(cleaned);

  if (isResumeStructuredContent(core)) {
    const sections = parseResumeMarkdown(core);
    if (sections.length > 0) {
      return (
        <div className={`space-y-2 ${className}`}>
          {prefix && (
            <EnhancedMarkdown className={COMPACT_PROSE_CLASS}>{prefix}</EnhancedMarkdown>
          )}
          <ResumeSectionBlock sections={sections} compact />
          {suffix && (
            <EnhancedMarkdown className={COMPACT_PROSE_CLASS}>{suffix}</EnhancedMarkdown>
          )}
        </div>
      );
    }
  }

  return (
    <div className={className}>
      <EnhancedMarkdown className={COMPACT_PROSE_CLASS}>{cleaned}</EnhancedMarkdown>
    </div>
  );
}
