/**
 * useCLTP (Simplified)
 *
 * 彻底移除 CLTP 会话层，改为直接消费 /api/agent/stream SSE。
 * 保持原 Hook 对外返回结构，降低页面改动成本。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SSEEvent } from "@/transports/SSETransport";
import { getApiBaseUrl, isAgentEnabled } from "@/lib/runtimeEnv";
import { streamAgent, type AgentStreamEvent } from "@/services/agentStream";

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function extractEventText(event: AgentStreamEvent): string {
  const delta = normalizeText(event.data?.delta);
  if (delta) return delta;
  return (
    normalizeText(event.data?.content) ||
    normalizeText(event.data?.result) ||
    normalizeText(event.data?.text) ||
    ""
  );
}

function normalizeThoughtChunk(raw: string): string {
  return raw
    .replace(/^\s*thought\s*[:：]\s*/i, "")
    .replace(/^\s*[:：-]?\s*response\s*[:：]?\s*/i, "");
}

function normalizeAnswerBuffer(raw: string): string {
  if (!raw) return "";
  const content = raw;
  const responseMarker = /(?:^|\n)\s*response\s*[:：]\s*/i;
  const responseMatch = responseMarker.exec(content);
  if (responseMatch) {
    const start = responseMatch.index + responseMatch[0].length;
    return content.slice(start);
  }

  // 某些后端分支会先在 answer 通道输出 "Thought:" 前缀，未出现 Response 前不展示。
  if (/^\s*thought\s*[:：]?/i.test(content.trimStart())) {
    return "";
  }

  return content.replace(/^\s*[:：-]?\s*response\s*[:：]\s*/i, "");
}

function collapseDirectDuplicate(raw: string): string {
  const text = raw || "";
  if (!text) return text;

  const len = text.length;
  if (len >= 20 && len % 2 === 0) {
    const half = len / 2;
    const first = text.slice(0, half);
    const second = text.slice(half);
    if (first === second) return first;
  }

  // handle "<content>\\n<content>" or "<content> <content>"
  for (const sep of ["\n\n", "\n", "  ", " "]) {
    const idx = text.indexOf(sep);
    if (idx <= 0) continue;
    const first = text.slice(0, idx);
    const second = text.slice(idx + sep.length);
    if (first.length < 20) continue;
    if (first === second) return first;
  }

  return text;
}

function appendChunk(prev: string, incoming: string): string {
  if (!incoming) return prev;
  if (!prev) return incoming;

  // Case 1: incoming is a complete superset starting with prev
  if (incoming.startsWith(prev)) {
    const tail = incoming.slice(prev.length);
    const compactTail = tail.trimStart();
    const compactPrev = prev.trim();

    // Check if this is just duplicate content
    if (
      tail === prev ||
      compactTail === prev ||
      compactTail === compactPrev ||
      (compactPrev.length > 0 && compactTail.startsWith(compactPrev))
    ) {
      return prev;
    }

    // Check if the tail is meaningfully different (not just whitespace)
    if (compactTail.length > 0 || tail.length > 0) {
      return incoming;
    }
    return prev;
  }

  // Case 2: prev is a superset of incoming (already have this content)
  if (prev.startsWith(incoming)) {
    return prev;
  }

  // Case 3: Check for inclusion
  if (prev.includes(incoming) && incoming.length > 20) {
    return prev;
  }

  // Case 4: Handle overlapping chunks with proper boundary detection
  const maxOverlap = Math.min(prev.length, incoming.length, 200); // Limit overlap check
  for (let i = maxOverlap; i > 0; i -= 1) {
    if (prev.slice(-i) === incoming.slice(0, i)) {
      const merged = prev + incoming.slice(i);
      return collapseDirectDuplicate(merged);
    }
  }

  // Case 5: Handle "rewrite + append" style with anchor matching
  const anchorSize = Math.min(100, prev.length); // Reduced anchor size
  if (anchorSize >= 30) {
    const anchor = prev.slice(-anchorSize);
    const anchorPos = incoming.indexOf(anchor);
    if (anchorPos >= 0 && anchorPos < incoming.length - anchorSize) {
      const merged = prev + incoming.slice(anchorPos + anchor.length);
      return collapseDirectDuplicate(merged);
    }
  }

  // Case 6: Simple append as fallback
  return collapseDirectDuplicate(prev + incoming);
}

export interface UseCLTPResult {
  currentThought: string;
  currentAnswer: string;
  isProcessing: boolean;
  isConnected: boolean;
  lastError: string | null;
  answerCompleteCount: number;
  sendMessage: (message: string, resumeDataOverride?: any) => Promise<void>;
  finalizeStream: () => void;
  disconnect: () => void;
}

export interface UseCLTPOptions {
  conversationId?: string;
  baseUrl?: string;
  heartbeatTimeout?: number;
  resumeData?: any;
  onSSEEvent?: (event: SSEEvent) => void;
}

export function useCLTP(options: UseCLTPOptions = {}): UseCLTPResult {
  const agentEnabled = isAgentEnabled();
  const {
    conversationId,
    baseUrl = getApiBaseUrl(),
    resumeData,
    onSSEEvent,
  } = options;

  const [currentThought, setCurrentThought] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [answerCompleteCount, setAnswerCompleteCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const resumeDataRef = useRef<any>(resumeData);
  const onSSEEventRef = useRef<typeof onSSEEvent>(onSSEEvent);

  useEffect(() => {
    resumeDataRef.current = resumeData;
  }, [resumeData]);

  useEffect(() => {
    onSSEEventRef.current = onSSEEvent;
  }, [onSSEEvent]);

  const resetStreamBuffers = useCallback(() => {
    setCurrentThought("");
    setCurrentAnswer("");
  }, []);

  const disconnect = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsConnected(false);
    setIsProcessing(false);
  }, []);

  const finalizeStream = useCallback(() => {
    resetStreamBuffers();
    setIsProcessing(false);
  }, [resetStreamBuffers]);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const sendMessage = useCallback(
    async (message: string, resumeDataOverride?: any) => {
      if (!agentEnabled) {
        setLastError("Agent is disabled by VITE_AGENT_ENABLED");
        return;
      }

      const content = message.trim();
      if (!content) return;

      disconnect();
      setLastError(null);
      resetStreamBuffers();
      setIsProcessing(true);
      setIsConnected(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let completed = false;

      const emitToPage = (event: AgentStreamEvent) => {
        onSSEEventRef.current?.(event as unknown as SSEEvent);
      };

      try {
        await streamAgent(
          {
            message: content,
            conversation_id: conversationId || null,
            resume_data:
              resumeDataOverride !== undefined
                ? resumeDataOverride
                : (resumeDataRef.current ?? null),
          },
          {
            baseUrl,
            signal: controller.signal,
            headers: authHeaders,
            onEvent: (event) => {
              emitToPage(event);

              const type = event.type;
              const text = extractEventText(event);

              if (type === "thought" || type === "thought_chunk") {
                setCurrentThought((prev) =>
                  collapseDirectDuplicate(
                    appendChunk(prev, normalizeThoughtChunk(text)),
                  ),
                );
                return;
              }

              if (type === "answer" || type === "answer_chunk") {
                const isComplete = Boolean((event.data as any)?.is_complete);
                if (isComplete) {
                  const fullAnswer = normalizeAnswerBuffer(
                    normalizeText((event.data as any)?.content) || text,
                  );
                  setCurrentAnswer((prev) =>
                    collapseDirectDuplicate(fullAnswer || prev),
                  );
                  return;
                }
                setCurrentAnswer((prev) =>
                  collapseDirectDuplicate(
                    normalizeAnswerBuffer(appendChunk(prev, text)),
                  ),
                );
                return;
              }

              if (type === "done") {
                completed = true;
                setAnswerCompleteCount((prev) => prev + 1);
                return;
              }

              if (type === "error" || type === "agent_error") {
                const errText =
                  normalizeText(event.data?.content) ||
                  normalizeText(event.data?.error_details) ||
                  "流式请求失败，请稍后重试。";
                setLastError(errText);
              }
            },
            onError: (error) => {
              setLastError(error.message || "流式请求失败，请稍后重试。");
            },
            onDone: () => {
              if (!completed) {
                completed = true;
                setAnswerCompleteCount((prev) => prev + 1);
              }
            },
          },
        );
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          const msg = error instanceof Error ? error.message : "流式请求失败";
          setLastError(msg);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsConnected(false);
        setIsProcessing(false);
      }
    },
    [
      agentEnabled,
      disconnect,
      resetStreamBuffers,
      conversationId,
      baseUrl,
      authHeaders,
    ],
  );

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return {
    currentThought,
    currentAnswer,
    isProcessing,
    isConnected,
    lastError,
    answerCompleteCount,
    sendMessage,
    finalizeStream,
    disconnect,
  };
}
