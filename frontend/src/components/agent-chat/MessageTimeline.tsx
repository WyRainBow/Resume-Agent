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
import { ResumeDiffCard, ApplyAllPatchesBar } from "@/components/agent-chat/ResumeDiffCard";
import { AssistantPaperCard } from "@/components/agent-chat/AssistantPaperCard";
import { ParseImportTimerBadge } from "@/components/agent-chat/ParseImportTimerBadge";
import { ThinkingIndicator } from "@/components/agent-chat/ThinkingIndicator";
import { ImportSuccessCard, ApplyDoneCard } from "@/components/agent-chat/ImportSuccessCard";
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
  /** 导入解析失败消息的「重试」（重发同一份文件） */
  onImportRetry?: (msgId: string) => void;
  /** 成功卡片等的下一步建议 chip 点击（填入输入框） */
  onSuggestionClick?: (msg: string) => void;
  /** 收尾卡片：下载 PDF */
  onDownloadPdf?: () => void;
  /** 收尾卡片：去编辑器精修 */
  onGoEditor?: () => void;
  /** 收尾卡片：针对某个岗位再优化一版（回访钩子） */
  onOptimizeForJd?: () => void;
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
  onImportRetry,
  onOpenSearchPanel,
  onOpenResume,
  onOpenResumeSelector,
  onRegenerate,
  onSuggestionClick,
  onDownloadPdf,
  onGoEditor,
  onOptimizeForJd,
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
        // 整份优化的进度（正在逐段优化…）是临时加载信息，优化完成后不该以「思考过程」折叠框残留在历史里
        const thoughtContent =
          isPlaceholderThought(rawThought) || rawThought.startsWith("正在逐段优化")
            ? ""
            : rawThought;
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
                    {msg.attachments.map((file, i) =>
                      file.url && file.type?.startsWith("image/") ? (
                        <img
                          key={i}
                          src={file.url}
                          alt={file.name}
                          onError={(e) => {
                            // 页面刷新后从持久化恢复时 objectURL 已失效，兜底隐藏避免裂图
                            e.currentTarget.style.display = "none";
                          }}
                          className="max-h-44 max-w-[220px] rounded-none border border-black object-contain"
                        />
                      ) : (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-none border border-black bg-chat-surface px-3 py-2 text-xs text-chat-ink-muted"
                        >
                          <FileText className="size-4 text-chat-accent" />
                          <div className="flex flex-col">
                            <span className="max-w-[150px] truncate font-medium text-chat-ink">{file.name}</span>
                            <span className="text-[10px] text-chat-ink-muted/80">
                              {`${((file.size ?? 0) / 1024).toFixed(1)} KB`}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words rounded-none border border-black bg-chat-user-bubble px-4 py-3 text-chat-ink dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {msg.content.length >= 200 &&
                  /("company"\s*:|"details"\s*:|custom-list|<\/?strong>|<\/?p>)/.test(msg.content) ? (
                    <span className="inline-flex items-center gap-2 text-chat-ink-muted">
                      <FileText className="size-4 shrink-0 text-chat-accent" />
                      已粘贴简历数据用于导入 · {msg.content.length.toLocaleString()} 字
                    </span>
                  ) : (
                    msg.content
                      .split("\n\n已上传并解析 PDF 文件")[0]
                      .split("\n\n文件《")[0]
                  )}
                </div>
                {/* 复制按钮：默认淡色、hover 显示并高亮（与助手消息操作栏一致） */}
                <div className="mt-1 flex justify-end opacity-0 transition-opacity group-hover/user:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      onSetCopiedId(msg.id || String(idx));
                      setTimeout(() => onSetCopiedId(null), 2000);
                    }}
                    className="rounded-none p-1.5 text-chat-ink-muted transition-all hover:bg-chat-user-bubble hover:text-chat-ink dark:hover:bg-slate-800"
                    title="复制"
                    aria-label="复制这条消息"
                  >
                    {copiedId === (msg.id || String(idx)) ? (
                      <Check className="h-4 w-4 text-emerald-600 animate-icon-pop" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // 优化应用完成：渲染收尾卡片（闭环终点）
        if (msg.meta?.applyDone) {
          return (
            <div key={msg.id || idx} className="chat-message-enter mb-6">
              <ApplyDoneCard
                count={msg.meta.applyDone.count}
                refine={msg.meta.applyDone.refine}
                onSuggestionClick={onSuggestionClick}
                onDownloadPdf={onDownloadPdf}
                onGoEditor={onGoEditor}
                onOptimizeForJd={onOptimizeForJd}
              />
            </div>
          );
        }

        // 简历导入/解析成功：渲染成功卡片，替代原纯文本完成语
        if (msg.meta?.importSuccess) {
          return (
            <div key={msg.id || idx} className="chat-message-enter mb-6">
              <ImportSuccessCard
                name={msg.meta.importSuccess.name}
                suggestions={msg.meta.importSuccess.suggestions}
                onSuggestionClick={onSuggestionClick}
              />
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
                          {/* 导入解析中：用思考动画（星芒旋转+文案脉动）替代静态文案 */}
                          {msg.meta?.pasteImportParsing ? (
                            <ThinkingIndicator label={effectiveContent} />
                          ) : (
                            <ResumeMarkdown>{effectiveContent}</ResumeMarkdown>
                          )}
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
                      {/* 导入失败：一键重试（重发同一份文件），失败不静默 */}
                      {msg.meta?.importRetry && onImportRetry && (
                        <button
                          type="button"
                          onClick={() => onImportRetry(msg.id || String(idx))}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 active:scale-[0.98] dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                        >
                          <RotateCcw className="size-3.5" /> 重试
                        </button>
                      )}
                      {/* 通用「下一步」建议 chip（点击即发送）：开场等主动引导单一动作，首个为主 CTA */}
                      {msg.meta?.suggestions && msg.meta.suggestions.length > 0 && onSuggestionClick && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {msg.meta.suggestions.map((s, i) => (
                            <button
                              key={`${s}-${i}`}
                              type="button"
                              onClick={() => onSuggestionClick(s)}
                              className={
                                i === 0
                                  ? "inline-flex items-center gap-1.5 rounded-full border border-blue-600 bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
                                  : "inline-flex items-center gap-1.5 rounded-full border border-chat-border bg-white px-3.5 py-1.5 text-xs font-medium text-chat-ink transition-all hover:bg-chat-canvas active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              }
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
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
                      <ApplyAllPatchesBar patches={patchesForMessage} />
                      {patchesForMessage.map((patch) => (
                        <ResumeDiffCard
                          key={patch.patch_id}
                          patch={patch}
                          defaultCollapsed={patchesForMessage.filter((p) => p.status === 'pending').length >= 2}
                        />
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

                  {msg.content && !msg.meta?.pasteImportParsing && (
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
