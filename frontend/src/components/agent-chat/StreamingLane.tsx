import React from "react";
import ReportCard from "@/components/chat/ReportCard";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import { formatResumeDiffPreview } from "@/utils/resumeEditDiff";

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
  currentReport?: {
    id: string;
    title: string;
  };
  stripResumeEditMarkdown: (content: string) => string;
  onOpenSearchPanel: (data: SearchData) => void;
  onResponseTypewriterComplete: () => void;
  onOpenCurrentReport: (reportId: string, title: string) => void;
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
  currentReport,
  stripResumeEditMarkdown,
  onOpenSearchPanel,
  onResponseTypewriterComplete,
  onOpenCurrentReport,
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

  return (
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
      {currentReport && isProcessing && (
        <div className="my-4">
          <ReportCard
            reportId={currentReport.id}
            title={currentReport.title}
            subtitle="点击查看完整报告"
            onClick={() => onOpenCurrentReport(currentReport.id, currentReport.title)}
          />
        </div>
      )}
    </StreamingOutputPanel>
  );
}
