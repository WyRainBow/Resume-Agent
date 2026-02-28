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
  return (
    normalizeText(event.data?.content) ||
    normalizeText(event.data?.result) ||
    normalizeText(event.data?.text) ||
    ""
  );
}

function appendChunk(prev: string, incoming: string): string {
  if (!incoming) return prev;
  if (!prev) return incoming;

  if (incoming.startsWith(prev)) return incoming;
  if (prev.startsWith(incoming)) return prev;
  if (prev.endsWith(incoming)) return prev;

  return prev + incoming;
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
    return token ? { Authorization: `Bearer ` } : {};
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
                setCurrentThought((prev) => appendChunk(prev, text));
                return;
              }

              if (type === "answer" || type === "answer_chunk") {
                setCurrentAnswer((prev) => appendChunk(prev, text));
                return;
              }

              if (
                type === "done" ||
                (type === "status" &&
                  ["complete", "done"].includes(
                    String(
                      event.data?.status ||
                        event.data?.content ||
                        event.data?.result ||
                        "",
                    ).toLowerCase(),
                  ))
              ) {
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
