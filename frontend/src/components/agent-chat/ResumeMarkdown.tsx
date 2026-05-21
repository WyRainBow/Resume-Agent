import React from "react";
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import ResumeSectionBlock from "@/components/agent-chat/ResumeSectionBlock";
import {
  isResumeStructuredContent,
  parseResumeMarkdown,
} from "@/utils/resumeMarkdownParser";

interface ResumeMarkdownProps {
  children: string;
  className?: string;
}

/**
 * 智能 Markdown 渲染：检测到结构化简历内容时，用 ResumeSectionBlock 卡片化展示；
 * 否则回退到 EnhancedMarkdown。
 */
export default function ResumeMarkdown({
  children,
  className = "",
}: ResumeMarkdownProps) {
  const content = typeof children === "string" ? children : String(children || "");

  if (!content.trim()) {
    return <div className={className} />;
  }

  if (isResumeStructuredContent(content)) {
    const sections = parseResumeMarkdown(content);
    if (sections.length > 0) {
      return (
        <div className={className}>
          <ResumeSectionBlock sections={sections} />
        </div>
      );
    }
  }

  return (
    <div className={className}>
      <EnhancedMarkdown>{content}</EnhancedMarkdown>
    </div>
  );
}
