import React from "react";
import type { DiffDisplayContent } from "@/utils/resumePatch";

interface DiffRichContentProps {
  display: DiffDisplayContent;
  variant: "before" | "after";
}

function PlainDiffLines({ text, variant }: { text: string; variant: "before" | "after" }) {
  if (!text.trim()) {
    return (
      <div className="text-sm italic text-chat-ink-muted">
        {variant === "before" ? "（原先无内容）" : "（无内容）"}
      </div>
    );
  }

  const lines = text.split("\n");
  const textColor = variant === "before" ? "text-chat-ink-muted" : "text-chat-ink";

  return (
    <div className={`text-sm leading-relaxed ${textColor}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        const isBullet = /^[-•]\s/.test(trimmed);
        const isNumbered = /^\d+[.)]\s/.test(trimmed);
        const isHeading = /[:：]$/.test(trimmed) && trimmed.length < 30;

        if (isBullet) {
          return (
            <div key={i} className="flex gap-1.5 py-0.5 pl-2">
              <span className="shrink-0 text-chat-accent">•</span>
              <span>{trimmed.replace(/^[-•]\s*/, "")}</span>
            </div>
          );
        }
        if (isNumbered) {
          return (
            <div key={i} className="py-0.5 font-medium">
              {trimmed}
            </div>
          );
        }
        if (isHeading) {
          return (
            <div key={i} className="pb-0.5 pt-2 font-medium text-chat-ink">
              {trimmed}
            </div>
          );
        }
        return (
          <div key={i} className="py-0.5">
            {trimmed}
          </div>
        );
      })}
    </div>
  );
}

export default function DiffRichContent({ display, variant }: DiffRichContentProps) {
  if (display.mode === "html") {
    if (!display.content.trim()) {
      return (
        <div className="text-sm italic text-chat-ink-muted">
          {variant === "before" ? "（原先无内容）" : "（无内容）"}
        </div>
      );
    }

    return (
      <div
        className={`diff-rich-content text-sm leading-relaxed ${
          variant === "before" ? "text-chat-ink-muted" : "text-chat-ink"
        }`}
        dangerouslySetInnerHTML={{ __html: display.content }}
      />
    );
  }

  return <PlainDiffLines text={display.content} variant={variant} />;
}
