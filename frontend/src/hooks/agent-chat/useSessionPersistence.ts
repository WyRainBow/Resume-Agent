import { useCallback, useRef, useState, useEffect } from "react";
import { Message } from "@/types/chat";
import { ResumeData } from "@/pages/Workspace/v2/types";

interface UseSessionPersistenceProps {
  apiBaseUrl: string;
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  conversationId: string;
  setConversationId: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSelectedResumeId: (id: string | null) => void;
  setAllowPdfAutoRender: (allow: boolean) => void;
  setLoadedResumes: (resumes: any[]) => void;
  setSearchResults: (results: any[]) => void;
  setActiveSearchPanel: (panel: any | null) => void;
  setResumePdfPreview: (preview: any) => void;
  setResumeError: (error: string | null) => void;
  finalizeStream: () => void;
  refreshSessions: () => void;
  HISTORY_APPEND_MODE: boolean;
  isLoadingChat: boolean;
  currentSessionId: string | null;
}

export function useSessionPersistence({
  apiBaseUrl,
  getAuthHeaders,
  conversationId,
  setConversationId,
  setMessages,
  setCurrentSessionId,
  setSelectedResumeId,
  setAllowPdfAutoRender,
  setLoadedResumes,
  setSearchResults,
  setActiveSearchPanel,
  setResumePdfPreview,
  setResumeError,
  finalizeStream,
  refreshSessions,
  HISTORY_APPEND_MODE,
  isLoadingChat,
  currentSessionId,
}: UseSessionPersistenceProps) {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef(false);
  const queuedSaveRef = useRef<{
    sessionId: string;
    messages: Message[];
    shouldRefresh: boolean;
  } | null>(null);
  const scheduledSaveRef = useRef<{
    sessionId: string;
    messages: Message[];
    shouldRefresh: boolean;
  } | null>(null);
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedKeyRef = useRef<string>("");
  const refreshAfterSaveRef = useRef(false);
  const saveRetryRef = useRef<Record<string, number>>({});
  const saveClientSeqRef = useRef(0);
  const lastPersistedCountBySessionRef = useRef<Record<string, number>>({});
  const appendDisabledBySessionRef = useRef<Record<string, boolean>>({});
  const historyApiUnavailableRef = useRef(false);

  const buildSavePayload = useCallback((messagesToSave: Message[]) => {
    return messagesToSave.map((msg) => ({
      role: msg.role,
      content: msg.content,
      thought: msg.thought,
    }));
  }, []);

  const computeLastMessageHash = useCallback((messagesToSave: Message[]) => {
    if (!messagesToSave.length) return "";
    const last = messagesToSave[messagesToSave.length - 1];
    const raw = `${last.role}|${last.content || ""}|${last.thought || ""}`;
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash +=
        (hash << 1) +
        (hash << 4) +
        (hash << 7) +
        (hash << 8) +
        (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }, []);

  const persistSessionSnapshot = useCallback(
    async (
      sessionId: string,
      messagesToSave: Message[],
      shouldRefresh = false,
    ) => {
      if (!messagesToSave || messagesToSave.length === 0) return;
      if (historyApiUnavailableRef.current) return;

      let validSessionId = sessionId;
      if (!validSessionId || validSessionId.trim() === "") {
        validSessionId = conversationId || `conv-${Date.now()}`;
        if (validSessionId !== conversationId) {
          setConversationId(validSessionId);
        }
      }

      const payload = buildSavePayload(messagesToSave);
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastSavedKeyRef.current) return;

      const clientSaveSeq = ++saveClientSeqRef.current;
      const lastMessageHash = computeLastMessageHash(messagesToSave);

      if (saveInFlightRef.current) {
        queuedSaveRef.current = { sessionId: validSessionId, messages: messagesToSave, shouldRefresh };
        return;
      }

      saveInFlightRef.current = (async () => {
        try {
          const fullSave = async () => {
            const resp = await fetch(
              `${apiBaseUrl}/api/agent/history/sessions/${validSessionId}/save`,
              {
                method: "POST",
                headers: getAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                  messages: payload,
                  client_save_seq: clientSaveSeq,
                  last_message_hash: lastMessageHash,
                }),
              },
            );
            if (resp.ok) {
              lastPersistedCountBySessionRef.current[validSessionId] = messagesToSave.length;
            }
            return resp;
          };

          let resp: Response;
          const knownPersistedCount = lastPersistedCountBySessionRef.current[validSessionId] ?? 0;
          const appendDisabled = appendDisabledBySessionRef.current[validSessionId] === true;
          const canTryAppend = HISTORY_APPEND_MODE && !appendDisabled && knownPersistedCount > 0 && knownPersistedCount <= messagesToSave.length;

          if (canTryAppend) {
            const deltaMessages = messagesToSave.slice(knownPersistedCount);
            if (deltaMessages.length === 0) {
              lastSavedKeyRef.current = payloadKey;
              return;
            }
            resp = await fetch(
              `${apiBaseUrl}/api/agent/history/sessions/${validSessionId}/append`,
              {
                method: "POST",
                headers: getAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                  base_seq: knownPersistedCount,
                  messages_delta: buildSavePayload(deltaMessages),
                  client_save_seq: clientSaveSeq,
                  last_message_hash: lastMessageHash,
                }),
              },
            );

            if (resp.status === 409) {
              appendDisabledBySessionRef.current[validSessionId] = true;
              resp = await fullSave();
            } else if (resp.ok) {
              const body = await resp.clone().json().catch(() => null);
              lastPersistedCountBySessionRef.current[validSessionId] = typeof body?.new_seq === "number" ? body.new_seq : messagesToSave.length;
            }
          } else {
            resp = await fullSave();
          }

          if (!resp.ok) {
            if (resp.status === 404) {
              historyApiUnavailableRef.current = true;
              queuedSaveRef.current = null;
              scheduledSaveRef.current = null;
              return;
            }
            // Retry logic
            const retryCount = (saveRetryRef.current[payloadKey] || 0) + 1;
            if (retryCount <= 2) {
              saveRetryRef.current[payloadKey] = retryCount;
              queuedSaveRef.current = { sessionId: validSessionId, messages: messagesToSave, shouldRefresh };
              setTimeout(() => {
                if (!saveInFlightRef.current && queuedSaveRef.current) {
                  const next = queuedSaveRef.current;
                  queuedSaveRef.current = null;
                  void persistSessionSnapshot(next.sessionId, next.messages, next.shouldRefresh);
                }
              }, 800 * retryCount);
            }
            return;
          }
          lastSavedKeyRef.current = payloadKey;
          delete saveRetryRef.current[payloadKey];
          if (shouldRefresh) refreshSessions();
        } catch (error) {
          console.error("[AgentChat] Failed to save session snapshot:", error);
        } finally {
          saveInFlightRef.current = null;
          if (queuedSaveRef.current) {
            const next = queuedSaveRef.current;
            queuedSaveRef.current = null;
            void persistSessionSnapshot(next.sessionId, next.messages, next.shouldRefresh);
          }
        }
      })();
      await saveInFlightRef.current;
    },
    [conversationId, buildSavePayload, computeLastMessageHash, getAuthHeaders, refreshSessions, HISTORY_APPEND_MODE, setConversationId],
  );

  const schedulePersistSessionSnapshot = useCallback(
    (sessionId: string, messagesToSave: Message[], shouldRefresh = false) => {
      if (!sessionId || sessionId.trim() === "" || messagesToSave.length === 0) return;
      const existing = scheduledSaveRef.current;
      scheduledSaveRef.current = {
        sessionId,
        messages: messagesToSave,
        shouldRefresh: shouldRefresh || Boolean(existing?.shouldRefresh),
      };
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = setTimeout(() => {
        const pending = scheduledSaveRef.current;
        scheduledSaveRef.current = null;
        saveDebounceTimerRef.current = null;
        if (!pending) return;
        void persistSessionSnapshot(pending.sessionId, pending.messages, pending.shouldRefresh);
      }, 1800);
    },
    [persistSessionSnapshot],
  );

  const flushScheduledSave = useCallback(async () => {
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = null;
    }
    const pending = scheduledSaveRef.current;
    scheduledSaveRef.current = null;
    if (pending) {
      await persistSessionSnapshot(pending.sessionId, pending.messages, pending.shouldRefresh);
    }
  }, [persistSessionSnapshot]);

  const waitForPendingSave = useCallback(async () => {
    await flushScheduledSave();
    if (saveInFlightRef.current) await saveInFlightRef.current;
  }, [flushScheduledSave]);

  const saveCurrentSession = useCallback((messages: Message[], isProcessing: boolean, currentThought: string, currentAnswer: string) => {
    if (isProcessing || currentThought || currentAnswer) {
      pendingSaveRef.current = true;
      return;
    }
    if (messages && messages.length > 0) {
      pendingSaveRef.current = true;
      void persistSessionSnapshot(conversationId, messages);
    }
  }, [conversationId, persistSessionSnapshot]);

  const deleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/agent/history/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);
      fetch(`${apiBaseUrl}/api/agent/stream/session/${sessionId}`, { method: "DELETE" }).catch(() => undefined);

      if (currentSessionId === sessionId) {
        const newId = `conv-${Date.now()}`;
        setMessages([]);
        setCurrentSessionId(newId);
        setConversationId(newId);
        lastPersistedCountBySessionRef.current[newId] = 0;
        finalizeStream();
      }
      refreshSessions();
    } catch (error) {
      console.error("[AgentChat] Failed to delete session:", error);
    }
  };

  const renameSession = async (sessionId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    try {
      await fetch(`${apiBaseUrl}/api/agent/history/sessions/${sessionId}/title`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title: trimmedTitle }),
      });
      refreshSessions();
    } catch (error) {
      console.error("[AgentChat] Failed to rename session:", error);
    }
  };

  const dedupeLoadedMessages = (messages: Message[]) => {
    if (messages.length <= 1) return messages;
    const deduped: Message[] = [];
    const seenByRole = new Map<string, Set<string>>();
    const getSeenSet = (role: string) => {
      const key = role || "unknown";
      if (!seenByRole.has(key)) seenByRole.set(key, new Set<string>());
      return seenByRole.get(key)!;
    };
    for (const msg of messages) {
      const contentKey = (typeof msg.content === "string" ? msg.content : "").trim();
      const roleKey = msg.role || "unknown";
      const seenContents = getSeenSet(roleKey);
      if (roleKey === "user") { deduped.push(msg); continue; }
      let cleanContent = contentKey;
      if (roleKey === "assistant" && contentKey.includes("Response:")) {
        cleanContent = contentKey.split("Response:").pop()?.trim() || contentKey;
      }
      if (seenContents.has(contentKey)) continue;
      if (roleKey === "assistant") {
        if (seenContents.has(cleanContent)) continue;
        let isDuplicate = false;
        for (const seen of seenContents) {
          if (seen.includes(cleanContent) || cleanContent.includes(seen)) { isDuplicate = true; break; }
        }
        if (isDuplicate) continue;
      }
      seenContents.add(contentKey);
      if (roleKey === "assistant") seenContents.add(cleanContent);
      deduped.push(msg);
    }
    return deduped;
  };

  const loadSession = async (sessionId: string) => {
    if (isLoadingChat || sessionId === currentSessionId) return;
    setIsLoadingSession(true);
    // saveCurrentSession call should be handled by caller to ensure current state is captured
    // await waitForPendingSave();
    pendingSaveRef.current = false;
    setSelectedResumeId(null);
    setAllowPdfAutoRender(false);
    setLoadedResumes([]);
    setSearchResults([]);
    setActiveSearchPanel(null);
    setResumePdfPreview({});

    try {
      const resp = await fetch(`${apiBaseUrl}/api/agent/history/sessions/${sessionId}`, { headers: getAuthHeaders() });
      if (!resp.ok) {
        if (!(resp.status === 404 && sessionId.startsWith('conv-'))) setResumeError(`会话加载失败：${resp.status}`);
        setCurrentSessionId(sessionId);
        return;
      }
      const data = await resp.json();
      setResumeError(null);
      if (!data || !Array.isArray(data.messages)) return;

      const generateMessageId = (content: string, role: string, index: number): string => {
        const contentForHash = content || `empty-${index}`;
        let hash = 2166136261;
        const str = `${role}:${contentForHash}:${index}`;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return `msg-${(hash >>> 0).toString(16).slice(0, 12)}`;
      };

      const userVisibleMessages = data.messages.filter((m: any) => m.role === "user" || m.role === "assistant");

      // UI state restoration from localStorage
      try {
        const savedUiState = localStorage.getItem(`ui_state:${sessionId}`);
        if (savedUiState) {
          const { loadedResumes: sLrs, selectedResumeId: savedSelectedResumeId } = JSON.parse(savedUiState);
          if (Array.isArray(sLrs) && sLrs.length > 0) setLoadedResumes(sLrs);
          if (savedSelectedResumeId) { setSelectedResumeId(savedSelectedResumeId); setAllowPdfAutoRender(true); }
        }
      } catch (e) { console.warn("[AgentChat] Failed to restore session ui data:", e); }

      const loadedMessages: Message[] = userVisibleMessages.map((m: any, index: number) => ({
        id: generateMessageId(m.content || "", m.role || "unknown", index),
        role: m.role === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content || ""),
        thought: m.thought || undefined,
        timestamp: new Date().toISOString(),
      }));

      const dedupedMessages = dedupeLoadedMessages(loadedMessages);
      if (dedupedMessages.length > 0 || userVisibleMessages.length === 0) {
        setMessages(dedupedMessages);
        setCurrentSessionId(sessionId);
        setConversationId(sessionId);
        lastPersistedCountBySessionRef.current[sessionId] = typeof data?.total === "number" ? data.total : dedupedMessages.length;
        setAllowPdfAutoRender(false);
        finalizeStream();
      }
    } catch (error) {
      console.error("[AgentChat] Failed to load session:", error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      const pending = scheduledSaveRef.current;
      if (pending) void persistSessionSnapshot(pending.sessionId, pending.messages, pending.shouldRefresh);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
    };
  }, [persistSessionSnapshot]);

  return {
    isLoadingSession,
    persistSessionSnapshot,
    schedulePersistSessionSnapshot,
    flushScheduledSave,
    waitForPendingSave,
    saveCurrentSession,
    deleteSession,
    renameSession,
    loadSession,
    pendingSaveRef,
    lastPersistedCountBySessionRef,
  };
}
