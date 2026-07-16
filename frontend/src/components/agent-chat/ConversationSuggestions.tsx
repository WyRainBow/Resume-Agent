import { useState } from "react";

export interface ConversationSuggestion {
  text: string;
  msg: string;
  template?: string;
}

export default function ConversationSuggestions({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: ConversationSuggestion[];
  onSuggestionClick?: (message: string) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [templateInput, setTemplateInput] = useState("");

  const submitTemplate = (item: ConversationSuggestion) => {
    const composed = (item.template || "").replace(
      "{input}",
      templateInput.trim(),
    );
    if (!composed.trim()) return;
    onSuggestionClick?.(composed);
    setExpandedIdx(null);
    setTemplateInput("");
  };

  if (suggestions.length === 0) return null;
  return (
    <div className="chat-message-enter mb-2 mt-3">
      <p className="mb-2.5 px-1 text-xs font-medium tracking-wide text-chat-ink-muted">
        下一步建议
      </p>
      <div className="flex flex-col gap-2">
        {suggestions.map((item, index) => {
          const expanded = expandedIdx === index;
          const hasTemplate = Boolean(item.template);
          if (expanded && hasTemplate) {
            const parts = item.template!.split("{input}");
            return (
              <div
                key={`${item.text}-${index}`}
                className="flex items-center gap-2 rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-chat-surface px-4 py-3.5 text-sm font-medium shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm dark:border-white dark:bg-slate-900 dark:shadow-[2px_2px_0px_0px_#ffffff]"
              >
                <span className="whitespace-nowrap text-chat-ink">{parts[0]}</span>
                <input
                  type="text"
                  autoFocus
                  value={templateInput}
                  onChange={(event) => setTemplateInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && templateInput.trim()) {
                      event.preventDefault();
                      submitTemplate(item);
                    }
                  }}
                  placeholder="输入岗位名称..."
                  className="min-w-[80px] flex-1 rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-chat-canvas px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-chat-accent/30"
                />
                {parts[1] && (
                  <span className="whitespace-nowrap text-chat-ink">{parts[1]}</span>
                )}
                <button
                  type="button"
                  onClick={() => submitTemplate(item)}
                  disabled={!templateInput.trim()}
                  className="shrink-0 rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-chat-accent-deep px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-chat-accent-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  发送
                </button>
              </div>
            );
          }
          return (
            <button
              key={`${item.text}-${index}`}
              type="button"
              onClick={() => {
                if (hasTemplate) {
                  setExpandedIdx(index);
                  setTemplateInput("");
                } else {
                  onSuggestionClick?.(item.msg);
                }
              }}
              className="flex w-full items-center justify-between rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-chat-surface px-4 py-3.5 text-sm font-medium text-chat-ink shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none dark:border-white dark:bg-slate-900 dark:shadow-[2px_2px_0px_0px_#ffffff]"
            >
              <span>{item.text}</span>
              <svg className="ml-3 h-4 w-4 shrink-0 text-chat-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
