import { useCallback } from "react";

export function useMessageTimeline() {
  const rebindCurrentMessageId = useCallback(
    <T extends { messageId: string }>(items: T[], nextId: string) =>
      items.map((item) =>
        item.messageId === "current" ? { ...item, messageId: nextId } : item,
      ),
    [],
  );

  return { rebindCurrentMessageId };
}
