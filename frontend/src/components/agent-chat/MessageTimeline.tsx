import React, { Fragment } from "react";
import { Check, Copy, FileText, RotateCcw } from "lucide-react";
import ResumeMarkdown from "@/components/agent-chat/ResumeMarkdown";
import ResumeCard from "@/components/chat/ResumeCard";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import TTSButton from "@/components/chat/TTSButton";
import DiagnosisToolCards, {
  type DiagnosisToolStructuredData,
} from "@/components/agent-chat/DiagnosisToolCards";
import { ResumeDiffCard } from "@/components/agent-chat/ResumeDiffCard";
import { AssistantPaperCard } from "@/components/agent-chat/AssistantPaperCard";
import type { PendingPatch } from "@/contexts/ResumeContext";
import type { Message } from "@/types/chat";
import type { ResumeData } from "@/pages/Workspace/v2/types";
import {
  formatResumeDiffPreview,
  sanitizeAssistantMessageContent,
  stripReasoningTags,
} from "@/utils/resumePatch";

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

interface DiagnosisToolEntry {
  messageId: string;
  data: DiagnosisToolStructuredData;
}

interface MessageTimelineProps {
  messages: Message[];
  loadedResumes: LoadedResumeItem[];
  searchResults: SearchResultEntry[];
  resumeEditDiffs: ResumeEditDiffEntry[];
  diagnosisToolEvents: DiagnosisToolEntry[];
  /** 所有 patch（pending / applied / rejected / superseded）按 message_id 渲染到对应历史消息下方。 */
  pendingPatches?: PendingPatch[];
  copiedId: string | null;
  stripResumeEditMarkdown: (content: string) => string;
  onSetCopiedId: (id: string | null) => void;
  onOpenSearchPanel: (data: SearchData) => void;
  onOpenResume: (resume: LoadedResumeItem) => void;
  onOpenResumeSelector: () => void;
  onRegenerate: () => void;
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

export default function MessageTimeline({
  messages,
  loadedResumes,
  searchResults,
  resumeEditDiffs,
  diagnosisToolEvents,
  pendingPatches,
  copiedId,
  stripResumeEditMarkdown,
  onSetCopiedId,
  onOpenSearchPanel,
  onOpenResume,
  onOpenResumeSelector,
  onRegenerate,
}: MessageTimelineProps) {
  const isPlaceholderThought = (text: string) => text === "正在思考...";
  return (
    <>
      {messages.map((msg, idx) => {
        const resumeForMessage = loadedResumes.find((r) => r.messageId === msg.id);
        const editDiffForMessage = resumeEditDiffs.find((r) => r.messageId === msg.id);
        const patchesForMessage = (pendingPatches ?? []).filter(
          (p) => p.message_id === msg.id,
        );
        const hasPatchCards = patchesForMessage.length > 0;
        // 有 patch 卡片时不再渲染旧路径的 ResumeEditDiffCard，避免重复
        const effectiveDiff =
          hasPatchCards
            ? null
            : sanitizeResumeDiffData(editDiffForMessage?.data);
        const searchForMessage = searchResults.find((r) => r.messageId === msg.id);
        const diagnosisForMessage = diagnosisToolEvents
          .filter((item) => item.messageId === msg.id)
          .map((item) => item.data);
        const rawThought = (msg.thought || "").trim();
        const thoughtContent = isPlaceholderThought(rawThought) ? "" : rawThought;
        const { cleanedThought, embeddedResponse } =
          splitEmbeddedResponseFromThought(stripReasoningTags(thoughtContent));
        const sanitizedContent = sanitizeAssistantMessageContent(
          hasPatchCards || effectiveDiff
            ? stripResumeEditMarkdown(msg.content || "")
            : msg.content || "",
          { suppressWhenPatchCard: hasPatchCards },
        );
        const effectiveContent = hasPatchCards
          ? ""
          : getDiffFallbackResponse(
              Boolean(effectiveDiff),
              (sanitizedContent.trim() || embeddedResponse).trim(),
              effectiveDiff,
            );

        if (msg.role === "user") {
          return (
            <div key={msg.id || idx} className="chat-message-enter mb-6 flex justify-end group/user">
              <div className="max-w-[80%]">
                <div className="mb-1 text-right text-[11px] text-chat-ink-muted/70 opacity-0 transition-opacity group-hover/user:opacity-100">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap justify-end gap-2">
                    {msg.attachments.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-chat-border bg-chat-surface px-3 py-2 text-xs text-chat-ink-muted shadow-sm"
                      >
                        <FileText className="size-4 text-chat-accent" />
                        <div className="flex flex-col">
                          <span className="max-w-[150px] truncate font-medium text-chat-ink">{file.name}</span>
                          <span className="text-[10px] text-chat-ink-muted/80">
                            {`${((file.size ?? 0) / 1024).toFixed(1)} KB`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl rounded-br-md bg-chat-user-bubble px-4 py-3 text-chat-ink shadow-sm dark:bg-slate-800 dark:text-slate-100">
                  {msg.content
                    .split("\n\n已上传并解析 PDF 文件")[0]
                    .split("\n\n文件《")[0]}
                </div>
              </div>
            </div>
          );
        }

        const hasAssistantContent =
          diagnosisForMessage.length > 0 ||
          searchForMessage ||
          effectiveContent ||
          effectiveDiff ||
          patchesForMessage.length > 0 ||
          resumeForMessage ||
          msg.content;

        return (
          <Fragment key={msg.id || idx}>
            {cleanedThought && (
              <ThoughtProcess
                content={cleanedThought}
                isStreaming={false}
                isLatest={false}
                defaultExpanded={false}
              />
            )}

            {hasAssistantContent && (
              <AssistantPaperCard>
                  {diagnosisForMessage.length > 0 && (
                    <DiagnosisToolCards items={diagnosisForMessage} className="mb-4" />
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

                  {effectiveContent && (
                    <div className="mb-2 text-chat-ink dark:text-slate-100 font-chat tracking-wide leading-relaxed">
                      <ResumeMarkdown>{effectiveContent}</ResumeMarkdown>
                    </div>
                  )}

                  {effectiveDiff && (
                    <ResumeEditDiffCard
                      before={effectiveDiff.before || ""}
                      after={effectiveDiff.after || ""}
                    />
                  )}

                  {patchesForMessage.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {patchesForMessage.map((patch) => (
                        <ResumeDiffCard key={patch.patch_id} patch={patch} />
                      ))}
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

                  {msg.content && (
                    <div className="mt-4 pt-4 border-t border-chat-border/60 dark:border-slate-800/60 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          onSetCopiedId(msg.id || String(idx));
                          setTimeout(() => onSetCopiedId(null), 2000);
                        }}
                        className="rounded p-1.5 text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink"
                        title="复制内容"
                      >
                        {copiedId === (msg.id || String(idx)) ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <div className="hidden items-center gap-1 group-hover:flex">
                      <button
                        className="rounded p-1.5 text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink"
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
                        className="rounded p-1.5 text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink"
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
                        className="rounded p-1.5 text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink"
                        title="重新生成"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button className="rounded p-1.5 text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="6" cy="12" r="1.5" />
                          <circle cx="18" cy="12" r="1.5" />
                        </svg>
                      </button>
                      </div>
                    </div>
                  )}
              </AssistantPaperCard>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
