import React from "react";
import {
  Award,
  Briefcase,
  FileText,
  FolderGit2,
  GitBranch,
  GraduationCap,
  User,
  Wrench,
} from "lucide-react";
import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";
import type {
  ParsedResumeEntry,
  ParsedResumeLine,
  ParsedResumeSection,
} from "@/utils/resumeMarkdownParser";

function sectionIcon(title: string): React.ReactNode {
  const text = title.toLowerCase();
  if (/education|教育/.test(text)) return <GraduationCap className="h-4 w-4" />;
  if (/project|项目/.test(text)) return <FolderGit2 className="h-4 w-4" />;
  if (/open source|开源/.test(text)) return <GitBranch className="h-4 w-4" />;
  if (/skill|技能/.test(text)) return <Wrench className="h-4 w-4" />;
  if (/award|奖项|荣誉/.test(text)) return <Award className="h-4 w-4" />;
  if (/basic|基本|个人信息/.test(text)) return <User className="h-4 w-4" />;
  if (/work|experience|intern|实习|工作/.test(text)) {
    return <Briefcase className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

function renderLine(line: ParsedResumeLine, index: number) {
  if (line.type === "bullet") {
    return (
      <li key={index} className="flex gap-2 text-sm leading-relaxed text-chat-ink">
        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-chat-accent" />
        <span>{line.text}</span>
      </li>
    );
  }

  if (line.type === "label") {
    return (
      <div key={index} className="text-sm text-chat-ink-muted">
        <span className="font-medium text-chat-ink">{line.label}：</span>
        {line.text}
      </div>
    );
  }

  return (
    <p key={index} className="text-sm leading-relaxed text-chat-ink">
      {line.text}
    </p>
  );
}

function ResumeEntryBlock({ entry }: { entry: ParsedResumeEntry }) {
  const bullets = entry.lines.filter((line) => line.type === "bullet");
  const otherLines = entry.lines.filter((line) => line.type !== "bullet");

  return (
    <div className="rounded-lg border border-chat-border/70 bg-chat-canvas/50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {entry.index !== undefined && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-chat-accent/15 px-1.5 text-[10px] font-semibold text-chat-accent-deep">
                {entry.index + 1}
              </span>
            )}
            <h4 className="truncate text-sm font-semibold text-chat-ink">{entry.title}</h4>
          </div>
          {entry.subtitle && (
            <p className="mt-0.5 text-sm text-chat-ink-muted">{entry.subtitle}</p>
          )}
        </div>
        {entry.period && (
          <span className="shrink-0 rounded-full bg-chat-accent/10 px-2 py-0.5 text-[11px] font-medium text-chat-accent-deep">
            {entry.period}
          </span>
        )}
      </div>

      {otherLines.length > 0 && (
        <div className="mt-2 space-y-1.5">{otherLines.map(renderLine)}</div>
      )}

      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1.5">{bullets.map(renderLine)}</ul>
      )}
    </div>
  );
}

function ResumeSectionCard({ section }: { section: ParsedResumeSection }) {
  return (
    <AgentSpecialCard
      icon={sectionIcon(section.title)}
      title={section.title}
      subtitle={section.pathHint ? `路径：${section.pathHint}` : undefined}
    >
      {section.entries.length > 0 ? (
        <div className="space-y-3">
          {section.entries.map((entry, index) => (
            <ResumeEntryBlock key={`${entry.title}-${index}`} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-chat-ink">
          {section.preamble || "暂无内容"}
        </div>
      )}
    </AgentSpecialCard>
  );
}

interface ResumeSectionBlockProps {
  sections: ParsedResumeSection[];
  className?: string;
}

export default function ResumeSectionBlock({
  sections,
  className = "",
}: ResumeSectionBlockProps) {
  if (!sections.length) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 px-1 text-xs font-medium tracking-wide text-chat-ink-muted">
        <FileText className="h-3.5 w-3.5 text-chat-accent" />
        <span>简历内容 · 只读</span>
      </div>
      {sections.map((section, index) => (
        <ResumeSectionCard key={`${section.title}-${index}`} section={section} />
      ))}
    </div>
  );
}
