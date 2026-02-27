import React from "react";
import ReportCard from "@/components/chat/ReportCard";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import { ReportGenerationDetector } from "@/components/chat/ReportGenerationDetector";
import { extractResumeEditDiff } from "@/utils/resumeEditDiff";

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
  onReportCreated: (reportId: string, title: string) => void;
}

function splitEmbeddedResponseFromThought(thought: string): {
  cleanedThought: string;
  embeddedResponse: string;
} {
  const raw = (thought || "").trim();
  const markerMatch = raw.match(
    /^(.*?)(?:\*{0,2}\s*Response\s*\*{0,2}[:：]\s*)([\s\S]*)$/im,
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

function getDiffFallbackResponse(hasDiff: boolean, content: string): string {
  if (!hasDiff) return content;
  return (content || "").trim();
}

function sanitizeResumeDiffText(value?: string): string {
  const raw = String(value || "");
  if (!raw) return "";
  const withoutTags = raw.replace(/<[^>]+>/g, " ");
  const withoutBold = withoutTags.replace(/\*\*(.*?)\*\*/g, "$1");
  const normalized = withoutBold
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const dedupedLines: string[] = [];
  for (const line of normalized.split("\n")) {
    const current = line.trim();
    if (!current) continue;
    if (dedupedLines[dedupedLines.length - 1] === current) continue;
    dedupedLines.push(current);
  }
  const compact = dedupedLines.join("\n");
  const MAX_LEN = 1200;
  if (compact.length <= MAX_LEN) return compact;
  return `${compact.slice(0, MAX_LEN)}\n...（内容较长，已截断展示）`;
}

function sanitizeResumeDiffData(diff?: { before?: string; after?: string } | null) {
  if (!diff) return diff;
  return {
    before: sanitizeResumeDiffText(diff.before),
    after: sanitizeResumeDiffText(diff.after),
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
  onReportCreated,
}: StreamingLaneProps) {
  const { cleanedThought, embeddedResponse } = splitEmbeddedResponseFromThought(currentThought);
  const answerCandidate = (currentAnswer || "").trim() ? currentAnswer : embeddedResponse;
  const markdownDiff = currentEditDiff
    ? null
    : extractResumeEditDiff(answerCandidate || "");
  const effectiveCurrentDiff = sanitizeResumeDiffData(currentEditDiff?.data || markdownDiff);
  const sanitizedCurrentAnswerRaw = effectiveCurrentDiff
    ? stripResumeEditMarkdown(answerCandidate || "")
    : answerCandidate;
  const sanitizedCurrentAnswer = getDiffFallbackResponse(
    Boolean(effectiveCurrentDiff),
    (sanitizedCurrentAnswerRaw || "").trim(),
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
      {currentAnswer.length > 500 && (
        <ReportGenerationDetector content={currentAnswer} onReportCreated={onReportCreated} />
      )}

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
