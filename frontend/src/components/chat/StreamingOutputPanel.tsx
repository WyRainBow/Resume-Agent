import { useCallback, useEffect } from "react";

import type { ConversationRunState } from "@/agent-presentation/model";
import { useConversationPresentation } from "@/agent-presentation/useConversationPresentation";
import ConversationTurnView, {
  type ConversationAction,
} from "@/components/agent-chat/ConversationTurnView";
import type { AskQuestionContextValue } from "@/components/agent-chat/AskQuestionContext";

export interface StreamingOutputPanelProps {
  conversationRun: ConversationRunState;
  isProcessing: boolean;
  onResponseTypewriterComplete?: (runId: string) => void;
  onConversationAction?: (action: ConversationAction) => void;
  askQuestionHandler?: AskQuestionContextValue;
}

/**
 * Canonical live-turn renderer. Event parsing and temporal decisions stay in the
 * presentation module; this component only bridges real render acknowledgements.
 */
export default function StreamingOutputPanel({
  conversationRun,
  isProcessing,
  onResponseTypewriterComplete,
  onConversationAction,
  askQuestionHandler,
}: StreamingOutputPanelProps) {
  const { model, acknowledge } = useConversationPresentation({
    run: conversationRun,
  });
  const handlePresentationSignal = useCallback(
    (signal: Parameters<typeof acknowledge>[0]) => {
      acknowledge(signal);
      if (signal.type === "response.presented") {
        onResponseTypewriterComplete?.(conversationRun.runId);
      }
    },
    [acknowledge, conversationRun.runId, onResponseTypewriterComplete],
  );

  useEffect(() => {
    if (!model.canPresentResponse || model.response.trim()) return;
    handlePresentationSignal({ type: "response.presented" });
  }, [handlePresentationSignal, model.canPresentResponse, model.response]);

  if (
    !isProcessing &&
    conversationRun.sourceStatus !== "failed" &&
    conversationRun.sourceStatus !== "cancelled"
  ) {
    return null;
  }
  return (
    <ConversationTurnView
      model={model}
      mode="live"
      onAction={(action) => onConversationAction?.(action)}
      onPresentationSignal={handlePresentationSignal}
      askQuestionHandler={askQuestionHandler}
    />
  );
}
