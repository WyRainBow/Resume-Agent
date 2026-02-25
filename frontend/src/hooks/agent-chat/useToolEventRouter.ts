import { useCallback, useEffect, useRef } from "react";
import type { SSEEvent } from "@/transports/SSETransport";

interface UseToolEventRouterParams<TSearch, TResume, TEdit> {
  runId: number;
  onDone: () => void;
  onError: (message: string) => void;
  onShowResumeSelector: () => void;
  upsertSearchResult: (messageId: string, data: TSearch) => void;
  upsertLoadedResume: (messageId: string, data: TResume) => void;
  upsertResumeEditDiff: (messageId: string, data: TEdit) => void;
  applyResumeEditDiff: (data: TEdit) => void;
}

export function useToolEventRouter<
  TSearch extends { type?: string; results?: unknown[]; metadata?: any; total_results?: number; query?: string },
  TResume extends { type?: string },
  TEdit extends { type?: string },
>(params: UseToolEventRouterParams<TSearch, TResume, TEdit>) {
  const {
    runId,
    onDone,
    onError,
    onShowResumeSelector,
    upsertSearchResult,
    upsertLoadedResume,
    upsertResumeEditDiff,
    applyResumeEditDiff,
  } = params;

  const handledResumeSelectorKeysRef = useRef<Set<string>>(new Set());
  const handledEditKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    handledResumeSelectorKeysRef.current.clear();
    handledEditKeysRef.current.clear();
  }, [runId]);

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type === "done") {
        onDone();
        return;
      }

      if (event.type === "error") {
        const message =
          event.data?.content ||
          event.data?.error_details ||
          "流式请求失败，请稍后重试。";
        onError(String(message));
        return;
      }

      if (event.type !== "tool_result") return;

      const toolName = event.data?.tool;
      const structured = event.data?.structured_data;
      const keySeed =
        event.id ||
        event.data?.tool_call_id ||
        `${toolName || "unknown"}:${String(event.data?.content || "")}`;
      const dedupeKey = `${runId}:${keySeed}`;

      if (
        toolName === "show_resume" &&
        (!structured || typeof structured !== "object")
      ) {
        if (!handledResumeSelectorKeysRef.current.has(dedupeKey)) {
          handledResumeSelectorKeysRef.current.add(dedupeKey);
          onShowResumeSelector();
        }
        return;
      }

      if (!structured || typeof structured !== "object") return;

      if (toolName === "web_search") {
        const normalized = {
          type: "search",
          query: structured.query || "",
          results: Array.isArray(structured.results) ? structured.results : [],
          total_results:
            structured.total_results ??
            structured.metadata?.total_results ??
            (Array.isArray(structured.results) ? structured.results.length : 0),
          metadata: structured.metadata || {},
        } as TSearch;
        upsertSearchResult("current", normalized);
        return;
      }

      if (toolName === "show_resume") {
        const resumePayload = structured as TResume;
        if ((resumePayload as any).type === "resume_selector") {
          if (handledResumeSelectorKeysRef.current.has(dedupeKey)) {
            return;
          }
          handledResumeSelectorKeysRef.current.add(dedupeKey);
          onShowResumeSelector();
          return;
        }
        upsertLoadedResume("current", resumePayload);
        return;
      }

      if (toolName === "cv_editor_agent") {
        const editPayload = structured as TEdit;
        if ((editPayload as any).type === "resume_edit_diff") {
          if (handledEditKeysRef.current.has(dedupeKey)) {
            return;
          }
          handledEditKeysRef.current.add(dedupeKey);
          upsertResumeEditDiff("current", editPayload);
          applyResumeEditDiff(editPayload);
        }
      }
    },
    [
      runId,
      onDone,
      onError,
      onShowResumeSelector,
      upsertSearchResult,
      upsertLoadedResume,
      upsertResumeEditDiff,
      applyResumeEditDiff,
    ],
  );

  return { handleSSEEvent };
}
