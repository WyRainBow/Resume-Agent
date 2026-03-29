import React, { useState } from "react";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import DiagnosisToolCards, {
  type DiagnosisToolStructuredData,
} from "@/components/agent-chat/DiagnosisToolCards";
import { formatResumeDiffPreview } from "@/utils/resumePatch";

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
  onSuggestionClick,
  stripResumeEditMarkdown,
  onOpenSearchPanel,
  onResponseTypewriterComplete,
}: StreamingLaneProps) {
  const { cleanedThought, embeddedResponse } = splitEmbeddedResponseFromThought(currentThought);
  const answerCandidate = (currentAnswer || "").trim() ? currentAnswer : embeddedResponse;
  const effectiveCurrentDiff = sanitizeResumeDiffData(currentEditDiff?.data);
  const sanitizedCurrentAnswerRaw = effectiveCurrentDiff
    ? stripResumeEditMarkdown(answerCandidate || "")
    : answerCandidate;
  const sanitizedCurrentAnswer = getDiffFallbackResponse(
    Boolean(effectiveCurrentDiff),
    (sanitizedCurrentAnswerRaw || "").trim(),
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
    <div className="flex flex-col gap-2.5 mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {suggestions.map((item, idx) => {
        const isExpanded = expandedIdx === idx;
        const hasTemplate = !!item.template;

        if (isExpanded && hasTemplate) {
          const parts = item.template!.split("{input}");
          return (
            <div
              key={idx}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium bg-white border border-blue-300 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              <span className="text-slate-700 whitespace-nowrap">{parts[0]}</span>
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
                className="flex-1 min-w-[80px] px-2 py-1 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
              {parts[1] && <span className="text-slate-700 whitespace-nowrap">{parts[1]}</span>}
              <button
                onClick={() => handleSubmitTemplate(item)}
                disabled={!templateInput.trim()}
                className="shrink-0 px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all"
          >
            <span>{item.text}</span>
            <svg className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        );
      })}
    </div>
  );
}
