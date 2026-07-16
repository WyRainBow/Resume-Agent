import type { ConversationTurnPresentation } from "@/agent-presentation/ConversationPresentation";
import type { PresentationSignal } from "@/agent-presentation/useConversationPresentation";
import { projectLegacyProcessNodes } from "@/agent-presentation/LegacyPresentationAdapter";
import StreamingResponse from "@/components/chat/StreamingResponse";

import AgentProcessTimeline from "./AgentProcessTimeline";
import { AssistantPaperCard } from "./AssistantPaperCard";
import ConversationArtifactStack from "./ConversationArtifactStack";
import { ThinkingIndicator } from "./ThinkingIndicator";
import ResumeMarkdown from "./ResumeMarkdown";
import ConversationSuggestions, {
  type ConversationSuggestion,
} from "./ConversationSuggestions";
import type { AskQuestionContextValue } from "./AskQuestionContext";

export type ConversationAction =
  | { type: "send_message"; message: string }
  | { type: "search.open"; data: Record<string, unknown> }
  | { type: "resume.open"; data: Record<string, unknown> }
  | { type: "resume.selector.open" };

interface ConversationTurnViewProps {
  model: ConversationTurnPresentation;
  mode: "live" | "history";
  onAction(action: ConversationAction): void;
  onPresentationSignal(signal: PresentationSignal): void;
  askQuestionHandler?: AskQuestionContextValue;
}

export default function ConversationTurnView({
  model,
  mode,
  onAction,
  onPresentationSignal,
  askQuestionHandler,
}: ConversationTurnViewProps) {
  const isLive = mode === "live";
  const processNodes = projectLegacyProcessNodes(model.process);
  const response = model.response;
  const hasRunningTool = model.process.some(
    (node) => node.kind === "tool" && node.status === "running",
  );
  // 思考已呈现完、回复尚不可呈现的空窗，也要给出「正在组织回复…」占位，
  // 不要求 response 已非空——greeting 等非流式轮此刻回复恰好为空，若要求
  // 非空就会裸露一段空白（见 knowledge-base/reviews/2026-07-15-forced-thought
  // -void-bug-and-fix.md）。空窗与否由呈现器的 phase 判定，视图只需忠实反映。
  const waitingForResponse = Boolean(
    isLive &&
      !hasRunningTool &&
      model.phase === "waiting_for_response",
  );
  const showResponse = Boolean(
    response.trim() &&
      (!isLive || model.canPresentResponse),
  );
  const showArtifactRegion = !isLive || model.showArtifacts;
  const suggestions = model.suggestions.flatMap((item) =>
    typeof item.text === "string" && typeof item.msg === "string"
      ? [
          {
            text: item.text,
            msg: item.msg,
            template:
              typeof item.template === "string" ? item.template : undefined,
          } satisfies ConversationSuggestion,
        ]
      : [],
  );
  const hasPaperContent =
    waitingForResponse ||
    showResponse ||
    (showArtifactRegion && model.artifacts.length > 0);

  if (isLive && model.showOpeningLoading) {
    return (
      <AssistantPaperCard>
        <ThinkingIndicator label="正在思考…" />
      </AssistantPaperCard>
    );
  }

  if (model.phase === "failed") {
    return (
      <AssistantPaperCard>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {model.error || "这一轮没有顺利完成，请稍后重试。"}
        </div>
      </AssistantPaperCard>
    );
  }

  return (
    <>
      {processNodes.length > 0 && (
        <AgentProcessTimeline
          nodes={processNodes}
          isProcessing={isLive}
          className="mb-3"
          presentationNodes={isLive ? model.process : undefined}
          onProcessSegmentPresented={(nodeId) =>
            onPresentationSignal({ type: "process.segmentPresented", nodeId })
          }
        />
      )}

      {hasPaperContent && (
        <AssistantPaperCard>
          {waitingForResponse ? (
            <ThinkingIndicator label="正在组织回复…" />
          ) : showResponse ? (
            isLive ? (
              <StreamingResponse
                content={response}
                canStart
                isStreaming
                sourceComplete={model.canPresentResponse}
                onTypewriterComplete={() =>
                  onPresentationSignal({ type: "response.presented" })
                }
              />
            ) : (
              <div className="mb-2 font-chat leading-relaxed tracking-wide text-chat-ink dark:text-slate-100">
                <ResumeMarkdown>{response}</ResumeMarkdown>
              </div>
            )
          ) : null}

          {showArtifactRegion && (
            <ConversationArtifactStack
              artifacts={model.artifacts}
              onAction={onAction}
              askQuestionHandler={askQuestionHandler}
              useLivePatchState={isLive}
            />
          )}
        </AssistantPaperCard>
      )}
      {showArtifactRegion && suggestions.length > 0 && (
        <ConversationSuggestions
          suggestions={suggestions}
          onSuggestionClick={(message) =>
            onAction({ type: "send_message", message })
          }
        />
      )}
    </>
  );
}
