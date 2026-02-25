import React from "react";
import ReportCard from "@/components/chat/ReportCard";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import { ReportGenerationDetector } from "@/components/chat/ReportGenerationDetector";

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

function extractResumeEditDiffFromMarkdown(
  content: string,
): { before: string; after: string } | null {
  if (!content) return null;
  const beforeMatch = content.match(
    /修改前：\s*```[a-zA-Z]*\n([\s\S]*?)```/m,
  );
  const afterMatch = content.match(/修改后：\s*```[a-zA-Z]*\n([\s\S]*?)```/m);
  if (!beforeMatch || !afterMatch) return null;
  return {
    before: beforeMatch[1].trim(),
    after: afterMatch[1].trim(),
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
  const markdownDiff = currentEditDiff
    ? null
    : extractResumeEditDiffFromMarkdown(currentAnswer || "");
  const effectiveCurrentDiff = currentEditDiff?.data || markdownDiff;
  const sanitizedCurrentAnswer = effectiveCurrentDiff
    ? stripResumeEditMarkdown(currentAnswer || "")
    : currentAnswer;

  return (
    <StreamingOutputPanel
      currentThought={currentThought}
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
