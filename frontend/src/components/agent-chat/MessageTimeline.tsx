import React, { Fragment, useState } from "react";
import { Check, Copy, FileText, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import ResumeMarkdown from "@/components/agent-chat/ResumeMarkdown";
import ResumeCard from "@/components/chat/ResumeCard";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import DiagnosisToolCards, {
  type DiagnosisToolStructuredData,
} from "@/components/agent-chat/DiagnosisToolCards";
import { ResumeDiffCard } from "@/components/agent-chat/ResumeDiffCard";
import { AssistantPaperCard } from "@/components/agent-chat/AssistantPaperCard";
import { ParseImportTimerBadge } from "@/components/agent-chat/ParseImportTimerBadge";
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
  const [feedback, setFeedback] = useState<Record<string, "like" | "dislike" | undefined>>({});
  const ACTION_BTN =
    "rounded-md p-1.5 transition-all duration-200 hover:bg-chat-user-bubble hover:text-chat-ink hover:scale-110 active:scale-90 dark:hover:bg-slate-800";
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

        const actionMsgId = msg.id || String(idx);
        const fb = feedback[actionMsgId];

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
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <ResumeMarkdown>{effectiveContent}</ResumeMarkdown>
                        </div>
                        {(msg.meta?.pasteImportParsing ||
                          msg.meta?.parseElapsedMs != null) && (
                          <ParseImportTimerBadge
                            startedAt={msg.meta?.parseStartedAt}
                            elapsedMs={msg.meta?.parseElapsedMs}
                            active={Boolean(msg.meta?.pasteImportParsing)}
                          />
                        )}
                      </div>
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
                    <div className="mt-2.5 flex items-center gap-0.5 text-chat-ink-muted/70">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          onSetCopiedId(actionMsgId);
                          setTimeout(() => onSetCopiedId(null), 2000);
                        }}
                        className={ACTION_BTN}
                        title="复制内容"
                      >
                        {copiedId === actionMsgId ? (
                          <Check key="copied" className="h-4 w-4 text-emerald-600 animate-icon-pop" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setFeedback((p) => ({
                            ...p,
                            [actionMsgId]: p[actionMsgId] === "like" ? undefined : "like",
                          }))
                        }
                        className={ACTION_BTN}
                        title="赞"
                      >
                        <ThumbsUp
                          key={`like-${fb === "like"}`}
                          className={`h-4 w-4 transition-colors ${fb === "like" ? "fill-emerald-500/25 text-emerald-600 animate-icon-pop" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() =>
                          setFeedback((p) => ({
                            ...p,
                            [actionMsgId]: p[actionMsgId] === "dislike" ? undefined : "dislike",
                          }))
                        }
                        className={ACTION_BTN}
                        title="踩"
                      >
                        <ThumbsDown
                          key={`dislike-${fb === "dislike"}`}
                          className={`h-4 w-4 transition-colors ${fb === "dislike" ? "fill-rose-500/25 text-rose-600 animate-icon-pop" : ""}`}
                        />
                      </button>
                      <button
                        onClick={onRegenerate}
                        className={`${ACTION_BTN} group/act`}
                        title="重新生成"
                      >
                        <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover/act:-rotate-180" />
                      </button>
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
