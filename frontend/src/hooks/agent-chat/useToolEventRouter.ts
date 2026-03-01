import { useCallback, useEffect, useRef } from "react";
import type { SSEEvent } from "@/transports/SSETransport";
import { extractResumeEditDiff } from "@/utils/resumeEditDiff";

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

function extractDiffFromText(raw: unknown): { before: string; after: string } | null {
  return extractResumeEditDiff(String(raw || ""));
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
  const pendingEditDiffRef = useRef<TEdit | null>(null);

  useEffect(() => {
    handledResumeSelectorKeysRef.current.clear();
    handledEditKeysRef.current.clear();
    pendingEditDiffRef.current = null;
  }, [runId]);

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type === "done") {
        // 将编辑 diff 卡片延迟到本轮 done 后再挂载，
        // 避免在 answer 打字机过程中“整块瞬间弹出”。
        if (pendingEditDiffRef.current) {
          upsertResumeEditDiff("current", pendingEditDiffRef.current);
          applyResumeEditDiff(pendingEditDiffRef.current);
          pendingEditDiffRef.current = null;
        }
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

      // 调试日志：记录所有工具调用
      console.log("[ToolEventRouter] Tool call received:", {
        toolName,
        eventType: event.type,
        hasStructured: !!structured,
        hasResult: !!event.data?.result,
        hasContent: !!event.data?.content,
        eventId: event.id,
      });
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
        if (handledResumeSelectorKeysRef.current.has(dedupeKey)) {
          return;
        }
        // 统一 show_resume 行为：只打开“加载简历”选择面板，
        // 不再自动挂载简历卡片，避免和用户手动选择流程冲突。
        handledResumeSelectorKeysRef.current.add(dedupeKey);
        onShowResumeSelector();
        return;
      }

      if (toolName === "CVReader" || toolName === "cv_reader") {
        // 处理简历读取工具的结果
        console.log("[CVReader] Processing CVReader tool result:", {
          hasStructured: !!structured,
          structured,
          result: event.data?.result,
          content: event.data?.content,
        });

        if (handledEditKeysRef.current.has(dedupeKey)) {
          console.log("[CVReader] Duplicate key, skipping:", dedupeKey);
          return;
        }
        handledEditKeysRef.current.add(dedupeKey);

        // 将读取的简历数据传递给前端
        const resumePayload = {
          type: "resume_data",
          data: structured || event.data?.result || event.data?.content,
        } as TResume;
        upsertLoadedResume("current", resumePayload);

        console.log("[CVReader] Resume data loaded and upserted");
        return;
      }

      if (toolName === "cv_editor_agent") {
        console.log("[cv_editor_agent] Processing edit request:", {
          hasStructured: !!structured,
          structured,
          result: event.data?.result,
          content: event.data?.content,
        });

        const editPayload = structured as TEdit;
        const hasDiffShape =
          typeof (editPayload as any)?.before === "string" &&
          typeof (editPayload as any)?.after === "string";

        if ((editPayload as any).type === "resume_edit_diff" || hasDiffShape) {
          if (handledEditKeysRef.current.has(dedupeKey)) {
            console.log("[cv_editor_agent] Duplicate key, skipping:", dedupeKey);
            return;
          }
          handledEditKeysRef.current.add(dedupeKey);
          pendingEditDiffRef.current = editPayload;
          console.log("[cv_editor_agent] Edit diff queued for application");
          return;
        }

        // 部分后端分支不会返回 structured_data，仅把 diff 放在 result 文本里。
        const parsedDiff = extractDiffFromText(event.data?.result || event.data?.content);
        if (parsedDiff) {
          if (handledEditKeysRef.current.has(dedupeKey)) {
            console.log("[cv_editor_agent] Duplicate parsed diff, skipping:", dedupeKey);
            return;
          }
          handledEditKeysRef.current.add(dedupeKey);
          pendingEditDiffRef.current = parsedDiff as TEdit;
          console.log("[cv_editor_agent] Parsed edit diff queued");
          return;
        }

        console.warn("[cv_editor_agent] No valid diff data found in tool result");
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
