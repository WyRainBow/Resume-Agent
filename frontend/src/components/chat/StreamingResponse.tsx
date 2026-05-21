import { useEffect, useRef } from "react";
import ResumeMarkdown from "@/components/agent-chat/ResumeMarkdown";

export interface StreamingResponseProps {
  content: string;
  canStart: boolean;
  isStreaming?: boolean;
  className?: string;
  onTypewriterComplete?: () => void;
}

export default function StreamingResponse({
  content,
  canStart,
  isStreaming = true,
  className = "text-chat-ink mb-6",
  onTypewriterComplete,
}: StreamingResponseProps) {
  const completeNotifiedRef = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      completeNotifiedRef.current = false;
      return;
    }
    if (!content?.trim()) return;
    if (completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    onTypewriterComplete?.();
  }, [isStreaming, content, onTypewriterComplete]);

  if (!canStart) return null;
  if (!content?.trim() && !isStreaming) return null;

  return (
    <div className={className}>
      <ResumeMarkdown>{content || ""}</ResumeMarkdown>
      {isStreaming && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-slate-400 align-middle">
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
        </span>
      )}
    </div>
  );
}
