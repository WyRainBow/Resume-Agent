import React, { Fragment } from "react";
import { Check, Copy, FileText, RotateCcw } from "lucide-react";
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import ResumeCard from "@/components/chat/ResumeCard";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import TTSButton from "@/components/chat/TTSButton";
import ReportCard from "@/components/chat/ReportCard";
import type { Message } from "@/types/chat";
import type { ResumeData } from "@/pages/Workspace/v2/types";

interface GeneratedReportItem {
  id: string;
  title: string;
  messageId: string;
}

interface LoadedResumeItem {
  id: string;
  name: string;
  messageId: string;
  resumeData?: ResumeData;
}

interface SearchData {
  query: string;
  total_results: number;
  results: Array<unknown>;
  metadata?: {
    search_time?: string;
  };
}

interface SearchResultEntry {
  messageId: string;
  data: SearchData;
}

interface ResumeEditDiffEntry {
  messageId: string;
  data: {
    before?: string;
    after?: string;
  };
}

interface MessageTimelineProps {
  messages: Message[];
  generatedReports: GeneratedReportItem[];
  loadedResumes: LoadedResumeItem[];
  searchResults: SearchResultEntry[];
  resumeEditDiffs: ResumeEditDiffEntry[];
  copiedId: string | null;
  stripResumeEditMarkdown: (content: string) => string;
  onSetCopiedId: (id: string | null) => void;
  onOpenSearchPanel: (data: SearchData) => void;
  onOpenReport: (reportId: string, title: string) => void;
  onOpenResume: (resume: LoadedResumeItem) => void;
  onOpenResumeSelector: () => void;
  onRegenerate: () => void;
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

export default function MessageTimeline({
  messages,
  generatedReports,
  loadedResumes,
  searchResults,
  resumeEditDiffs,
  copiedId,
  stripResumeEditMarkdown,
  onSetCopiedId,
  onOpenSearchPanel,
  onOpenReport,
  onOpenResume,
  onOpenResumeSelector,
  onRegenerate,
}: MessageTimelineProps) {
  const isPlaceholderThought = (text: string) => text === "正在思考...";
  return (
    <>
      {messages.map((msg, idx) => {
        const reportForMessage = generatedReports.find((r) => r.messageId === msg.id);
        const resumeForMessage = loadedResumes.find((r) => r.messageId === msg.id);
        const editDiffForMessage = resumeEditDiffs.find((r) => r.messageId === msg.id);
        const markdownDiff = editDiffForMessage
          ? null
          : extractResumeEditDiffFromMarkdown(msg.content || "");
        const effectiveDiff = editDiffForMessage?.data || markdownDiff;
        const searchForMessage = searchResults.find((r) => r.messageId === msg.id);
        const rawThought = (msg.thought || "").trim();
        const thoughtContent = isPlaceholderThought(rawThought) ? "" : rawThought;
        const sanitizedContent = effectiveDiff
          ? stripResumeEditMarkdown(msg.content || "")
          : msg.content || "";

        if (msg.role === "user") {
          return (
            <div key={msg.id || idx} className="mb-6 flex justify-end">
              <div className="max-w-[80%]">
                <div className="mb-1 text-right text-xs text-gray-400">
                  {new Date().toLocaleString()}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap justify-end gap-2">
                    {msg.attachments.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm"
                      >
                        <FileText className="size-4 text-indigo-500" />
                        <div className="flex flex-col">
                          <span className="max-w-[150px] truncate font-medium">{file.name}</span>
                          <span className="text-[10px] text-gray-400">
                            {`${((file.size ?? 0) / 1024).toFixed(1)} KB`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-800">
                  {msg.content
                    .split("\n\n已上传并解析 PDF 文件")[0]
                    .split("\n\n文件《")[0]}
                </div>
              </div>
            </div>
          );
        }

        return (
          <Fragment key={msg.id || idx}>
            {thoughtContent && (
              <ThoughtProcess
                content={thoughtContent}
                isStreaming={false}
                isLatest={false}
                defaultExpanded={false}
              />
            )}

            {searchForMessage && (
              <div className="my-4">
                <SearchCard
                  query={searchForMessage.data.query}
                  totalResults={searchForMessage.data.total_results}
                  searchTime={searchForMessage.data.metadata?.search_time}
                  onOpen={() => onOpenSearchPanel(searchForMessage.data)}
                />
                <SearchSummary
                  query={searchForMessage.data.query}
                  results={searchForMessage.data.results}
                  searchTime={searchForMessage.data.metadata?.search_time}
                />
              </div>
            )}

            {effectiveDiff && (
              <ResumeEditDiffCard
                before={effectiveDiff.before || ""}
                after={effectiveDiff.after || ""}
              />
            )}

            {sanitizedContent && (
              <div className="mb-6 text-gray-800">
                <EnhancedMarkdown>{sanitizedContent}</EnhancedMarkdown>
              </div>
            )}

            {msg.content && (
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content);
                    onSetCopiedId(msg.id || String(idx));
                    setTimeout(() => onSetCopiedId(null), 2000);
                  }}
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="复制内容"
                >
                  {copiedId === (msg.id || String(idx)) ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="赞"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                    />
                  </svg>
                </button>
                <button
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="踩"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                    />
                  </svg>
                </button>
                <TTSButton text={msg.content} />
                <button
                  onClick={onRegenerate}
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="重新生成"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="6" cy="12" r="1.5" />
                    <circle cx="18" cy="12" r="1.5" />
                  </svg>
                </button>
              </div>
            )}

            {reportForMessage && (
              <div className="my-4">
                <ReportCard
                  reportId={reportForMessage.id}
                  title={reportForMessage.title}
                  subtitle="点击查看完整报告"
                  onClick={() => onOpenReport(reportForMessage.id, reportForMessage.title)}
                />
              </div>
            )}

            {resumeForMessage && (
              <div className="my-4">
                <ResumeCard
                  resumeId={resumeForMessage.id}
                  title={resumeForMessage.name}
                  subtitle={resumeForMessage.resumeData?.alias || "已加载简历"}
                  onClick={() => onOpenResume(resumeForMessage)}
                  onChangeResume={onOpenResumeSelector}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
