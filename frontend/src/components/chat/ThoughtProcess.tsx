import { useEffect, useState } from "react";
import { ChevronDown, Brain } from "lucide-react";

function sanitizeThoughtDisplay(raw: string): string {
  if (!raw) return "";
  // 移除 Thought for Xs 这种时间标记
  const text = raw.replace(/^Thought for \d+s[:：]?\s*/i, "");
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface ThoughtProcessProps {
  content: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  isLatest?: boolean;
  className?: string;
}

export default function ThoughtProcess({
  content,
  isStreaming = false,
  defaultExpanded = true,
  isLatest,
  className = "",
  onComplete,
}: ThoughtProcessProps) {
  const [expanded, setExpanded] = useState(
    isLatest !== undefined ? isLatest : defaultExpanded,
  );

  useEffect(() => {
    if (isLatest !== undefined) {
      setExpanded(isLatest);
    }
  }, [isLatest]);

  const textToShow = sanitizeThoughtDisplay(content || "");
  if (!textToShow) return null;

  return (
    <div className={`mb-2 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="group inline-flex items-center gap-1.5 rounded-full border border-chat-border/60 bg-chat-canvas/60 px-2.5 py-1 text-chat-ink-muted transition-colors hover:bg-chat-canvas dark:border-slate-700/60 dark:bg-slate-800/50 dark:hover:bg-slate-800"
      >
        <Brain className="h-3.5 w-3.5 shrink-0 text-chat-accent/80" strokeWidth={2} />
        <span className="text-[13px] font-medium tracking-wide">思考过程</span>
        {isStreaming ? (
          <span className="ml-0.5 flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-chat-accent/60 [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-chat-accent/60 [animation-delay:120ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-chat-accent/60 [animation-delay:240ms]" />
          </span>
        ) : (
          <ChevronDown
            size={13}
            className={`text-chat-ink-muted/60 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {expanded && (
        <div className="mt-2 border-l-2 border-chat-border/50 pl-3 text-sm font-normal leading-relaxed text-chat-ink-muted whitespace-pre-wrap break-words dark:border-slate-700/50">
          {textToShow}
        </div>
      )}
    </div>
  );
}
