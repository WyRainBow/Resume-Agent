import { useMemo } from "react";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import type { ConversationRunState } from "@/agent-presentation/model";
import type { AskQuestionContextValue } from "@/components/agent-chat/AskQuestionContext";
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
  conversationRun: ConversationRunState;
  isProcessing: boolean;
  onSuggestionClick?: (msg: string) => void;
  stripResumeEditMarkdown: (content: string) => string;
  onOpenSearchPanel: (data: SearchData) => void;
  onResponseTypewriterComplete: (runId: string) => void;
  askQuestionHandler?: AskQuestionContextValue;
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
  conversationRun,
  isProcessing,
  onSuggestionClick,
  stripResumeEditMarkdown,
  onOpenSearchPanel,
  onResponseTypewriterComplete,
  askQuestionHandler,
}: StreamingLaneProps) {
  const presentationRun = useMemo(
    () => buildVisibleConversationRun(conversationRun, stripResumeEditMarkdown),
    [conversationRun, stripResumeEditMarkdown],
  );
  const hasActiveContent =
    isProcessing ||
    presentationRun.process.length > 0 ||
    Boolean(presentationRun.response.sourceText.trim()) ||
    presentationRun.artifacts.length > 0 ||
    presentationRun.suggestions.length > 0 ||
    presentationRun.sourceStatus === "failed" ||
    presentationRun.sourceStatus === "cancelled";

  return (
    <>
      {hasActiveContent && (
        <StreamingOutputPanel
          conversationRun={presentationRun}
          isProcessing={isProcessing}
          onResponseTypewriterComplete={onResponseTypewriterComplete}
          askQuestionHandler={askQuestionHandler}
          onConversationAction={(action) => {
            if (action.type === "send_message") {
              onSuggestionClick?.(action.message);
            } else if (action.type === "search.open") {
              onOpenSearchPanel(action.data as unknown as SearchData);
            }
          }}
        />
      )}
    </>
  );
}

export function buildVisibleConversationRun(
  conversationRun: ConversationRunState,
  stripResumeEditMarkdown: (content: string) => string,
): ConversationRunState {
  const hasApprovalCard = conversationRun.artifacts.some(
    (artifact) => artifact.kind === "approval_request",
  );
  const hasPendingPatchCards = conversationRun.artifacts.some(
    (artifact) => artifact.kind === "resume_patch",
  );
  const currentThought = conversationRun.process
    .filter((node) => node.kind === "thought")
    .map((node) => node.content)
    .join("\n\n");
  const currentAnswer = conversationRun.response.sourceText;
  const { embeddedResponse } = splitEmbeddedResponseFromThought(
    stripReasoningTags(currentThought),
  );
  const answerCandidate = (currentAnswer || "").trim() ? currentAnswer : embeddedResponse;
  const currentDiffArtifact = conversationRun.artifacts.find(
    (artifact) => artifact.kind === "resume_edit_diff",
  );
  const effectiveCurrentDiff = sanitizeResumeDiffData(
    currentDiffArtifact
      ? {
          before:
            typeof currentDiffArtifact.payload.before === "string"
              ? currentDiffArtifact.payload.before
              : undefined,
          after:
            typeof currentDiffArtifact.payload.after === "string"
              ? currentDiffArtifact.payload.after
              : undefined,
        }
      : undefined,
  );
  const sanitizedCurrentAnswerRaw = sanitizeAssistantMessageContent(
    hasPendingPatchCards || effectiveCurrentDiff
      ? stripResumeEditMarkdown(answerCandidate || "")
      : answerCandidate || "",
    { suppressWhenPatchCard: hasPendingPatchCards },
  );
  // patch 轮不再整体压制正文:模型的操作旁白要可见(过程可见性),
  // diff markdown 复述已由上方 stripResumeEditMarkdown 剥掉;approval 卡
  // 仍压制(卡片即交互主体,正文是重复的确认文案)
  const sanitizedCurrentAnswer = hasApprovalCard
    ? ""
    : getDiffFallbackResponse(
        Boolean(effectiveCurrentDiff),
        sanitizedCurrentAnswerRaw.trim(),
        effectiveCurrentDiff,
      );

  return {
    ...conversationRun,
    response: {
      ...conversationRun.response,
      sourceText: sanitizedCurrentAnswer,
    },
  };
}
