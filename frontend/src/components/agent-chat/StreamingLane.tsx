import React, { useState } from "react";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import DiagnosisToolCards, {
  type DiagnosisToolStructuredData,
} from "@/components/agent-chat/DiagnosisToolCards";
import {
  formatResumeDiffPreview,
  sanitizeAssistantMessageContent,
  stripReasoningTags,
} from "@/utils/resumePatch";

interface SearchData {
  query: string;
  total_results: number;
  results: Array<unknown>;
  metadata?: {
    search_time?: string;
  };
}

interface StreamingLaneProps {
  currentThought: string;
  currentAnswer: string;
  isProcessing: boolean;
  shouldHideResponseInChat: boolean;
  currentSearch?: {
    data: SearchData;
  };
  currentEditDiff?: {
    data: {
      before?: string;
      after?: string;
    };
  };
  suggestions?: Array<{ text: string; msg: string; template?: string }>;
  currentDiagnosisTools?: DiagnosisToolStructuredData[];
  hasPendingPatchCards?: boolean;
  onSuggestionClick?: (msg: string) => void;
  stripResumeEditMarkdown: (content: string) => string;
  onOpenSearchPanel: (data: SearchData) => void;
  onResponseTypewriterComplete: () => void;
}

function splitEmbeddedResponseFromThought(thought: string): {
  cleanedThought: string;
  embeddedResponse: string;
} {
  const raw = (thought || "").trim();
  const markerMatch = raw.match(
    /^(.*?)(?:[:：\-\s]*\*{0,2}\s*Response\s*\*{0,2}[:：]\s*)([\s\S]*)$/im,
  );
  if (!markerMatch) {
    return { cleanedThought: raw, embeddedResponse: "" };
  }

  const before = markerMatch[1].trim();
  const after = markerMatch[2].trim();
  if (!after) {
    return { cleanedThought: before, embeddedResponse: "" };
  }

  const [responseLine, ...restLines] = after.split("\n");
  const remainingThought = restLines.join("\n").trim();
  const mergedThought = [before, remainingThought].filter(Boolean).join("\n");
  return {
    cleanedThought: mergedThought,
    embeddedResponse: responseLine.trim(),
  };
}

function getDiffFallbackResponse(
  hasDiff: boolean,
  content: string,
  diff?: { before?: string; after?: string } | null,
): string {
  if (!hasDiff) return content;
  const trimmed = (content || "").trim();
  if (trimmed) return trimmed;
  const before = (diff?.before || "").split("\n")[0]?.trim();
  const after = (diff?.after || "").split("\n")[0]?.trim();
  if (before || after) {
    return `已完成修改：${before || "原内容"} -> ${after || "新内容"}。`;
  }
  return "";
}

function sanitizeResumeDiffData(diff?: { before?: string; after?: string } | null) {
  if (!diff) return diff;
  return {
    before: formatResumeDiffPreview(diff.before),
    after: formatResumeDiffPreview(diff.after),
  };
}

export default function StreamingLane({
  currentThought,
  currentAnswer,
  isProcessing,
  shouldHideResponseInChat,
  currentSearch,
  currentEditDiff,
  suggestions,
  currentDiagnosisTools,
  hasPendingPatchCards = false,
  onSuggestionClick,
  stripResumeEditMarkdown,
  onOpenSearchPanel,
  onResponseTypewriterComplete,
}: StreamingLaneProps) {
  const { cleanedThought, embeddedResponse } = splitEmbeddedResponseFromThought(
    stripReasoningTags(currentThought),
  );
  const answerCandidate = (currentAnswer || "").trim() ? currentAnswer : embeddedResponse;
  const effectiveCurrentDiff = sanitizeResumeDiffData(currentEditDiff?.data);
  const sanitizedCurrentAnswerRaw = sanitizeAssistantMessageContent(
    hasPendingPatchCards || effectiveCurrentDiff
      ? stripResumeEditMarkdown(answerCandidate || "")
      : answerCandidate || "",
    { suppressWhenPatchCard: hasPendingPatchCards },
  );
  const sanitizedCurrentAnswer = hasPendingPatchCards
    ? ""
    : getDiffFallbackResponse(
        Boolean(effectiveCurrentDiff),
        sanitizedCurrentAnswerRaw.trim(),
        effectiveCurrentDiff,
      );

  const hasActiveContent = isProcessing || cleanedThought || sanitizedCurrentAnswer;

  return (
    <>
      {hasActiveContent && (
        <StreamingOutputPanel
          currentThought={cleanedThought}
          currentAnswer={sanitizedCurrentAnswer}
          isProcessing={isProcessing}
          onResponseTypewriterComplete={onResponseTypewriterComplete}
          shouldHideResponseInChat={shouldHideResponseInChat}
          currentEditDiff={effectiveCurrentDiff}
          currentSearch={currentSearch}
          renderSearchCard={(searchData) => (
            <>
              <SearchCard
                query={searchData.query}
                totalResults={searchData.total_results}
                searchTime={searchData.metadata?.search_time}
                onOpen={() => onOpenSearchPanel(searchData)}
              />
              <SearchSummary
                query={searchData.query}
                results={searchData.results}
                searchTime={searchData.metadata?.search_time}
              />
            </>
          )}
          renderEditDiffCard={(diff) => (
            <ResumeEditDiffCard before={diff.before || ""} after={diff.after || ""} />
          )}
        >
          {currentDiagnosisTools && currentDiagnosisTools.length > 0 && (
            <DiagnosisToolCards items={currentDiagnosisTools} className="mb-3" />
          )}
        </StreamingOutputPanel>
      )}
      {/* 建议按钮 - 渲染在 StreamingOutputPanel 外部，确保流结束后仍可见 */}
      {!isProcessing && suggestions && suggestions.length > 0 && (
        <SuggestionButtons suggestions={suggestions} onSuggestionClick={onSuggestionClick} />
      )}
    </>
  );
}

interface SuggestionItem {
  text: string;
  msg: string;
  template?: string;
}

function SuggestionButtons({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: SuggestionItem[];
  onSuggestionClick?: (msg: string) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [templateInput, setTemplateInput] = useState("");

  const handleSubmitTemplate = (item: SuggestionItem) => {
    const composed = (item.template || "").replace("{input}", templateInput.trim());
    if (composed.trim()) {
      onSuggestionClick?.(composed);
      setExpandedIdx(null);
      setTemplateInput("");
    }
  };

  return (
    <div className="mt-3 mb-2 chat-message-enter">
      <p className="mb-2.5 px-1 text-xs font-medium tracking-wide text-chat-ink-muted">
        下一步建议
      </p>
      <div className="flex flex-col gap-2">
      {suggestions.map((item, idx) => {
        const isExpanded = expandedIdx === idx;
        const hasTemplate = !!item.template;

        if (isExpanded && hasTemplate) {
          const parts = item.template!.split("{input}");
          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-none border-2 border-black bg-chat-surface px-4 py-3.5 text-sm font-medium shadow-[2px_2px_0px_0px_#000000] animate-in fade-in slide-in-from-bottom-1 duration-300 dark:border-white dark:bg-slate-900 dark:shadow-[2px_2px_0px_0px_#ffffff]"
            >
              <span className="whitespace-nowrap text-chat-ink">{parts[0]}</span>
              <input
                type="text"
                autoFocus
                value={templateInput}
                onChange={(e) => setTemplateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && templateInput.trim()) {
                    e.preventDefault();
                    handleSubmitTemplate(item);
                  }
                }}
                placeholder="输入岗位名称..."
                className="min-w-[80px] flex-1 rounded-none border border-black bg-chat-canvas px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-chat-accent/30"
              />
              {parts[1] && <span className="whitespace-nowrap text-chat-ink">{parts[1]}</span>}
              <button
                onClick={() => handleSubmitTemplate(item)}
                disabled={!templateInput.trim()}
                className="shrink-0 rounded-none border border-black bg-chat-accent-deep px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-chat-accent-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                发送
              </button>
            </div>
          );
        }

        return (
          <button
            key={idx}
            onClick={() => {
              if (hasTemplate) {
                setExpandedIdx(idx);
                setTemplateInput("");
              } else {
                onSuggestionClick?.(item.msg);
              }
            }}
            className="flex w-full items-center justify-between rounded-none border-2 border-black bg-chat-surface px-4 py-3.5 text-sm font-medium text-chat-ink shadow-[2px_2px_0px_0px_#000000] transition-all hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] dark:border-white dark:bg-slate-900 dark:shadow-[2px_2px_0px_0px_#ffffff]"
          >
            <span>{item.text}</span>
            <svg className="ml-3 h-4 w-4 shrink-0 text-chat-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        );
      })}
      </div>
    </div>
  );
}
