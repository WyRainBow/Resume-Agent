import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

function sanitizeThoughtDisplay(raw: string): string {
  if (!raw) return "";
  return raw
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
    <div className={`thinking-message rounded-lg px-0 py-1 mb-2 ${className}`}>
      <div
        className="cursor-pointer flex items-center gap-2 py-1"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex gap-1 items-center">
          <span className="text-neutral-500 text-sm font-normal">Thought Process</span>
          <ChevronUp
            size={12}
            className={`text-neutral-400 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}
          />
        </div>
        {isStreaming && (
          <div className="flex gap-1 ml-1">
            <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "100ms" }} />
            <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
          </div>
        )}
      </div>

      {expanded && (
        <div className="text-neutral-500 text-sm leading-relaxed pl-0 font-normal whitespace-pre-wrap break-words">
          {textToShow}
        </div>
      )}
    </div>
  );
}
