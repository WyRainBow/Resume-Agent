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
  const sanitizedCurrentAnswer = currentEditDiff
    ? stripResumeEditMarkdown(currentAnswer || "")
    : currentAnswer;

  return (
    <StreamingOutputPanel
      currentThought={currentThought}
      currentAnswer={sanitizedCurrentAnswer}
      isProcessing={isProcessing}
      onResponseTypewriterComplete={onResponseTypewriterComplete}
      shouldHideResponseInChat={shouldHideResponseInChat}
      currentEditDiff={currentEditDiff?.data}
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
