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
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import { linkifyTextNodes } from "@/utils/linkifyText";
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
        <span>{linkifyTextNodes(line.text)}</span>
      </li>
    );
  }

  if (line.type === "label") {
    return (
      <div key={index} className="text-sm text-chat-ink-muted">
        <span className="font-medium text-chat-ink">{line.label}：</span>
        {linkifyTextNodes(line.text)}
      </div>
    );
  }

  return (
    <p key={index} className="text-sm leading-relaxed text-chat-ink">
      {linkifyTextNodes(line.text)}
    </p>
  );
}

function ResumeEntryBlock({ entry }: { entry: ParsedResumeEntry }) {
  const bullets = entry.lines.filter((line) => line.type === "bullet");
  const otherLines = entry.lines.filter((line) => line.type !== "bullet");

  return (
    <div className="rounded-xl border border-chat-border/60 bg-white/80 p-4 shadow-sm dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {entry.index !== undefined && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700">
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
          <span className="shrink-0 rounded-full bg-chat-canvas px-2 py-0.5 text-[11px] font-medium text-chat-ink-muted">
            {entry.period}
          </span>
        )}
      </div>

      {entry.rawBody ? (
        <div className="mt-3 resume-entry-markdown border-t border-chat-border/40 pt-3">
          <EnhancedMarkdown>{entry.rawBody}</EnhancedMarkdown>
        </div>
      ) : (
        <>
          {otherLines.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-chat-border/40 pt-3">
              {otherLines.map(renderLine)}
            </div>
          )}

          {bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-chat-border/40 pt-3">
              {bullets.map(renderLine)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeading({ section }: { section: ParsedResumeSection }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="text-blue-600/80">{sectionIcon(section.title)}</span>
      <h3 className="text-sm font-semibold text-chat-ink">{section.title}</h3>
      {section.pathHint && (
        <span className="text-[11px] text-chat-ink-muted/70">({section.pathHint})</span>
      )}
    </div>
  );
}

function ResumeSectionCard({ section }: { section: ParsedResumeSection }) {
  if (section.entries.length > 0) {
    return (
      <div className="space-y-3">
        <SectionHeading section={section} />
        <div className="space-y-3">
          {section.entries.map((entry, index) => (
            <ResumeEntryBlock key={`${entry.title}-${index}`} entry={entry} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionHeading section={section} />
      <div className="resume-entry-markdown rounded-xl border border-chat-border/60 bg-white/80 p-4 shadow-sm dark:bg-slate-900/40">
        <EnhancedMarkdown>{section.preamble || ""}</EnhancedMarkdown>
      </div>
    </div>
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
    <div className={`space-y-5 ${className}`}>
      {sections.map((section, index) => (
        <ResumeSectionCard key={`${section.title}-${index}`} section={section} />
      ))}
    </div>
  );
}
