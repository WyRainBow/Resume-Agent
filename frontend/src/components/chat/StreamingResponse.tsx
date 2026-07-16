import { useEffect, useRef } from "react";
import ResumeMarkdown from "@/components/agent-chat/ResumeMarkdown";
import { useTemporalText } from "@/hooks/useTemporalText";

export interface StreamingResponseProps {
  content: string;
  canStart: boolean;
  isStreaming?: boolean;
  sourceComplete?: boolean;
  className?: string;
  onTypewriterComplete?: () => void;
}

export default function StreamingResponse({
  content,
  canStart,
  isStreaming = true,
  sourceComplete = false,
  className = "text-chat-ink mb-6",
  onTypewriterComplete,
}: StreamingResponseProps) {
  const completeNotifiedRef = useRef(false);
  const temporalText = useTemporalText({
    text: content || "",
    active: canStart && Boolean(content?.trim()),
    maxPresentationMs: 1400,
  });

  useEffect(() => {
    if (!sourceComplete) {
      completeNotifiedRef.current = false;
      return;
    }
    if (!content?.trim()) return;
    if (!temporalText.isCaughtUp) return;
    if (completeNotifiedRef.current) return;
    completeNotifiedRef.current = true;
    onTypewriterComplete?.();
  }, [
    content,
    onTypewriterComplete,
    sourceComplete,
    temporalText.isCaughtUp,
  ]);

  if (!canStart) return null;
  if (!content?.trim() && !isStreaming) return null;

  return (
    <div className={className}>
      <ResumeMarkdown>{temporalText.displayedText}</ResumeMarkdown>
      {isStreaming && (!sourceComplete || !temporalText.isCaughtUp) && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-slate-400 align-middle">
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
        </span>
      )}
    </div>
  );
}
