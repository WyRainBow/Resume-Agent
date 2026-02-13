/**
 * AgentChat - 对话页面
 *
 * 使用 SSE (Server-Sent Events) 替代 WebSocket
 *
 * 功能：
 * - AI 输出的 Thought Process（来自后端，折叠面板样式）
 * - 流式输出和打字机效果
 * - Markdown 渲染
 * - 心跳检测和自动重连
 */

import ChatMessage from "@/components/chat/ChatMessage";
import ReportCard from "@/components/chat/ReportCard";
import ResumeCard from "@/components/chat/ResumeCard";
import ResumeSelector from "@/components/chat/ResumeSelector";
import SearchCard from "@/components/chat/SearchCard";
import SearchResultPanel from "@/components/chat/SearchResultPanel";
import SearchSummary from "@/components/chat/SearchSummary";
import { ReportGenerationDetector } from "@/components/chat/ReportGenerationDetector";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { useAuth } from "@/contexts/AuthContext";
import { useCLTP } from "@/hooks/useCLTP";
import { PDFViewerSelector } from "@/components/PDFEditor";
import { convertToBackendFormat } from "@/pages/Workspace/v2/utils/convertToBackend";
import type { ResumeData } from "@/pages/Workspace/v2/types";
import { getResume, getAllResumes } from "@/services/resumeStorage";
import type { SavedResume } from "@/services/storage/StorageAdapter";
import {
  createReport,
  getReport,
  getDocumentContent,
  ensureReportConversation,
  renderPDFStream,
} from "@/services/api";
import { Message } from "@/types/chat";
import type { SSEEvent } from "@/transports/SSETransport";
import { ArrowUp, FileText, Plus, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import { useTextStream } from "@/hooks/useTextStream";

import WorkspaceLayout from "@/pages/WorkspaceLayout";

// Response 流式输出组件（带打字机效果）
function StreamingResponse({
  content,
  canStart,
  onComplete,
}: {
  content: string;
  canStart: boolean;
  onComplete?: () => void;
}) {
  const completedRef = React.useRef(false);

  // 只有当 canStart 为 true 时才开始打字机效果
  const { displayedText, isComplete } = useTextStream({
    textStream: canStart ? content : "",
    speed: 5,
    mode: "typewriter",
    onComplete: () => {
      // 打字机完成时调用 onComplete
      if (!completedRef.current && onComplete) {
        completedRef.current = true;
        console.log("[StreamingResponse] 打字机效果完成");
        onComplete();
      }
    },
  });

  // 重置 completedRef 当 content 变化时
  React.useEffect(() => {
    if (content) {
      completedRef.current = false;
    }
  }, [content]);

  // 如果不能开始或没有内容，不显示
  if (!canStart || !content) {
    return null;
  }

  // 显示打字机效果的文本
  const textToShow = displayedText;

  if (!textToShow) {
    return null;
  }

  return (
    <div className="text-gray-800 mb-6">
      <EnhancedMarkdown>{textToShow}</EnhancedMarkdown>
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
      )}
    </div>
  );
}

// 报告内容视图组件
function ReportContentView({
  reportId,
  streamingContent,
  isStreaming,
  onContentLoaded,
}: {
  reportId: string;
  streamingContent?: string;
  isStreaming?: boolean;
  onContentLoaded: (content: string, title?: string) => void;
}) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 如果正在流式输出，使用打字机效果
  const { displayedText } = useTextStream({
    textStream: isStreaming && streamingContent ? streamingContent : content,
    speed: 10,
    mode: "typewriter",
  });

  useEffect(() => {
    // 如果正在流式输出，不加载 API 内容
    if (isStreaming && streamingContent) {
      setIsLoading(false);
      setContent(streamingContent);
      return;
    }

    // 如果流式输出完成，从 API 加载完整内容
    const loadReport = async () => {
      try {
        setIsLoading(true);
        const report = await getReport(reportId);
        if (report.main_id) {
          const docContent = await getDocumentContent(report.main_id);
          const finalContent = docContent.content || "";
          setContent(finalContent);
          onContentLoaded(finalContent, report.title);
        } else {
          setContent("");
          onContentLoaded("", report.title);
        }
        setError(null);
      } catch (err) {
        console.error("加载报告失败:", err);
        setError(err instanceof Error ? err.message : "加载报告失败");
      } finally {
        setIsLoading(false);
      }
    };
    loadReport();
  }, [reportId, onContentLoaded, isStreaming, streamingContent]);

  if (isLoading && !isStreaming) {
    return <div className="text-sm text-slate-500">正在加载报告...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  // 如果正在流式输出，使用打字机效果显示；否则直接显示内容
  const contentToDisplay =
    isStreaming && streamingContent ? displayedText : content;

  if (!contentToDisplay.trim()) {
    return <div className="text-sm text-slate-400">报告内容为空</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="prose max-w-none">
        <EnhancedMarkdown>{contentToDisplay}</EnhancedMarkdown>
      </div>
    </div>
  );
}

// ============================================================================
// 配置
// ============================================================================

const rawApiBase =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "";
const API_BASE = rawApiBase
  ? rawApiBase.startsWith("http")
    ? rawApiBase
    : `https://${rawApiBase}`
  : import.meta.env.PROD
    ? ""
    : "http://localhost:9000";

const SSE_CONFIG = {
  BASE_URL: API_BASE || "",
  HEARTBEAT_TIMEOUT: 60000, // 60 seconds
};
const HISTORY_BASE = API_BASE || "";

function convertResumeDataToOpenManusFormat(resume: ResumeData) {
  return {
    ...resume,
  };
}

interface ResumePdfPreviewState {
  blob: Blob | null;
  loading: boolean;
  progress: string;
  error: string | null;
}

const EMPTY_RESUME_PDF_STATE: ResumePdfPreviewState = {
  blob: null,
  loading: false,
  progress: "",
  error: null,
};

function isWorkspaceResumeData(data: unknown): data is ResumeData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<ResumeData>;
  return (
    !!candidate.basic &&
    Array.isArray(candidate.education) &&
    Array.isArray(candidate.experience) &&
    Array.isArray(candidate.projects) &&
    Array.isArray(candidate.menuSections)
  );
}

interface SearchResultItem {
  position?: number;
  url?: string;
  title?: string;
  description?: string;
  source?: string;
  raw_content?: string;
}

interface SearchStructuredData {
  type: "search";
  query: string;
  results: SearchResultItem[];
  total_results: number;
  metadata?: {
    total_results?: number;
    language?: string;
    country?: string;
    search_time?: string;
    original_query?: string;
    enhanced_query?: string;
  };
}

// ============================================================================
// 主页面组件
// ============================================================================

export default function SophiaChat() {
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(() => {
    // 尝试从 URL 查询参数恢复会话ID
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("sessionId");
      if (sessionId && sessionId.trim() !== "") {
        return sessionId;
      }
      // 尝试从 localStorage 恢复最后的会话ID（如果有 resumeId）
      const lastSessionKey = `last_session_${window.location.pathname}`;
      const lastSessionId = localStorage.getItem(lastSessionKey);
      // 验证从 localStorage 获取的值不为空字符串
      if (lastSessionId && lastSessionId.trim() !== "") {
        return lastSessionId;
      }
    }
    return `conv-${Date.now()}`;
  });
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);

  // 报告相关状态
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string>("");
  const [reportTitle, setReportTitle] = useState<string>("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<
    Array<{ id: string; title: string; messageId: string }>
  >([]);

  // 简历卡片相关状态
  const [loadedResumes, setLoadedResumes] = useState<
    Array<{
      id: string;
      name: string;
      messageId: string;
      resumeData?: ResumeData;
    }>
  >([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [resumePdfPreview, setResumePdfPreview] = useState<
    Record<string, ResumePdfPreviewState>
  >({});

  // 搜索结果相关状态
  const [searchResults, setSearchResults] = useState<
    Array<{ messageId: string; data: SearchStructuredData }>
  >([]);
  const [activeSearchPanel, setActiveSearchPanel] =
    useState<SearchStructuredData | null>(null);

  // 报告流式输出相关状态
  const [shouldHideResponseInChat, setShouldHideResponseInChat] =
    useState(false);
  const [streamingReportId, setStreamingReportId] = useState<string | null>(
    null,
  );
  const [streamingReportContent, setStreamingReportContent] =
    useState<string>("");

  // 简历选择器状态
  const [showResumeSelector, setShowResumeSelector] = useState(false);
  const [pendingResumeInput, setPendingResumeInput] = useState<string>(""); // 暂存用户输入，选择简历后继续处理

  // Thought Process 完成状态（用于控制 Response 的显示时机）
  const [thoughtProcessComplete, setThoughtProcessComplete] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef(false);
  const queuedSaveRef = useRef<{
    sessionId: string;
    messages: Message[];
  } | null>(null);
  const lastSavedKeyRef = useRef<string>("");
  const refreshAfterSaveRef = useRef(false);
  const saveRetryRef = useRef<Record<string, number>>({});
  const isFinalizedRef = useRef(false);
  const shouldFinalizeRef = useRef(false); // 标记是否需要完成（等待打字机效果完成）
  const currentThoughtRef = useRef("");
  const currentAnswerRef = useRef("");
  const lastCompletedRef = useRef<{
    thought: string;
    answer: string;
    at: number;
  } | null>(null);
  const lastHandledAnswerCompleteRef = useRef(0);

  const normalizedResume = useMemo(() => {
    if (!resumeData) return null;
    return convertResumeDataToOpenManusFormat(resumeData);
  }, [resumeData]);

  const selectedLoadedResume = useMemo(() => {
    if (!selectedResumeId) return null;
    for (let i = loadedResumes.length - 1; i >= 0; i -= 1) {
      if (loadedResumes[i].id === selectedResumeId) {
        return loadedResumes[i];
      }
    }
    return null;
  }, [loadedResumes, selectedResumeId]);

  const selectedResumePdfState = selectedResumeId
    ? resumePdfPreview[selectedResumeId] || EMPTY_RESUME_PDF_STATE
    : EMPTY_RESUME_PDF_STATE;

  const updateResumePdfState = useCallback(
    (id: string, patch: Partial<ResumePdfPreviewState>) => {
      setResumePdfPreview((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || EMPTY_RESUME_PDF_STATE),
          ...patch,
        },
      }));
    },
    [],
  );

  const renderResumePdfPreview = useCallback(
    async (
      resumeEntry: {
        id: string;
        resumeData?: ResumeData;
      },
      force = false,
    ) => {
      if (!resumeEntry.resumeData) return;

      const currentState = resumePdfPreview[resumeEntry.id];
      if (!force && (currentState?.loading || currentState?.blob)) {
        return;
      }

      if (!isWorkspaceResumeData(resumeEntry.resumeData)) {
        updateResumePdfState(resumeEntry.id, {
          blob: null,
          loading: false,
          progress: "",
          error: "当前简历数据格式不支持 PDF 预览。",
        });
        return;
      }

      updateResumePdfState(resumeEntry.id, {
        loading: true,
        progress: "正在渲染 PDF...",
        error: null,
      });

      try {
        const backendData = convertToBackendFormat(resumeEntry.resumeData);
        const blob = await renderPDFStream(
          backendData as any,
          backendData.sectionOrder,
          (progress) => {
            updateResumePdfState(resumeEntry.id, { progress });
          },
          () => {
            updateResumePdfState(resumeEntry.id, { progress: "渲染完成" });
          },
          (error) => {
            updateResumePdfState(resumeEntry.id, { error });
          },
        );

        updateResumePdfState(resumeEntry.id, {
          blob,
          loading: false,
          progress: "",
          error: null,
        });
      } catch (error) {
        updateResumePdfState(resumeEntry.id, {
          blob: null,
          loading: false,
          progress: "",
          error:
            error instanceof Error
              ? error.message
              : "PDF 渲染失败，请稍后重试。",
        });
      }
    },
    [resumePdfPreview, updateResumePdfState],
  );

  const upsertSearchResult = useCallback(
    (messageId: string, data: SearchStructuredData) => {
      setSearchResults((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.messageId === messageId,
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { messageId, data };
          return updated;
        }
        return [...prev, { messageId, data }];
      });
    },
    [],
  );

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type !== "tool_result") return;
      const toolName = event.data?.tool;
      if (toolName !== "web_search") return;
      const structured = event.data?.structured_data;
      if (!structured) return;

      const results = Array.isArray(structured.results)
        ? structured.results
        : [];
      const metadata = structured.metadata || {};
      const totalResults =
        structured.total_results ?? metadata.total_results ?? results.length;

      const normalized: SearchStructuredData = {
        type: "search",
        query: structured.query || "",
        results,
        total_results: totalResults,
        metadata,
      };

      upsertSearchResult("current", normalized);
    },
    [upsertSearchResult],
  );

  const {
    currentThought,
    currentAnswer,
    isProcessing,
    isConnected,
    answerCompleteCount,
    sendMessage,
    finalizeStream,
  } = useCLTP({
    conversationId,
    baseUrl: SSE_CONFIG.BASE_URL,
    heartbeatTimeout: SSE_CONFIG.HEARTBEAT_TIMEOUT,
    resumeData: normalizedResume,
    onSSEEvent: handleSSEEvent,
  });

  // 保存会话ID到 localStorage
  useEffect(() => {
    if (conversationId && typeof window !== "undefined") {
      const lastSessionKey = `last_session_${window.location.pathname}`;
      localStorage.setItem(lastSessionKey, conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (resumeId) {
      // 如果有 resumeId，优先使用 resumeId 相关的会话ID
      const resumeSessionId = `conv-${resumeId}`;
      // 但如果没有从 URL 或 localStorage 恢复的会话ID，才使用 resumeId
      // 检查当前 conversationId 是否是之前保存的
      if (
        !conversationId ||
        (!conversationId.startsWith(resumeSessionId) &&
          conversationId !== resumeSessionId)
      ) {
        // 只有当 conversationId 不是 resumeId 相关的时候才设置
        // 但如果 conversationId 是从 localStorage 恢复的，应该保留它
        const lastSessionKey = `last_session_${window.location.pathname}`;
        const lastSessionId = localStorage.getItem(lastSessionKey);
        if (!lastSessionId || lastSessionId === conversationId) {
          // 如果没有保存的会话ID，或者保存的会话ID就是当前的，则使用 resumeId
          setConversationId(resumeSessionId);
        }
      }
    }
  }, [resumeId]);

  useEffect(() => {
    let mounted = true;
    const loadResume = async () => {
      if (!resumeId) {
        // 如果没有 resumeId，不报错，只是不加载简历
        setLoadingResume(false);
        setResumeData(null);
        setResumeError(null);
        return;
      }
      setLoadingResume(true);
      setResumeError(null);
      try {
        const resume = await getResume(resumeId);
        if (!mounted) return;
        if (!resume) {
          setResumeError("未找到对应的简历");
          setResumeData(null);
        } else {
          const resolvedUserId = user?.id ?? (resume as any).user_id ?? null;
          const resumeDataWithMeta = {
            ...(resume.data || {}),
            resume_id: resume.id,
            user_id: resolvedUserId,
            _meta: {
              resume_id: resume.id,
              user_id: resolvedUserId,
            },
          };
          setResumeData(resumeDataWithMeta as ResumeData);
        }
      } catch (error) {
        if (!mounted) return;
        setResumeError("加载简历失败");
      } finally {
        if (mounted) setLoadingResume(false);
      }
    };
    loadResume();
    return () => {
      mounted = false;
    };
  }, [resumeId, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();

    if (media.addEventListener) {
      media.addEventListener("change", update);
    } else {
      media.addListener(update);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!selectedLoadedResume) return;
    if (selectedReportId) return;
    void renderResumePdfPreview(selectedLoadedResume);
  }, [selectedLoadedResume, selectedReportId, renderResumePdfPreview]);

  // 刷新后自动加载历史会话（如果 conversationId 是从 localStorage 恢复的）
  useEffect(() => {
    // 如果已经有当前会话ID，不自动加载
    if (currentSessionId) {
      return;
    }

    // 如果 conversationId 是新的时间戳格式（conv-timestamp），不加载历史
    const isNewConversationId = /^conv-\d{13,}$/.test(conversationId);
    if (isNewConversationId) {
      return;
    }

    let mounted = true;
    const autoLoadSession = async () => {
      try {
        // 尝试加载会话历史
        // 防御性检查：确保 conversationId 不为空
        if (!conversationId || conversationId.trim() === "") {
          console.warn(
            "[AgentChat] Cannot load session: conversationId is empty",
          );
          return;
        }
        const resp = await fetch(
          `${HISTORY_BASE}/api/agent/history/sessions/${conversationId}`,
        );
        if (!mounted) return;
        if (!resp.ok) {
          // 会话不存在，使用新的会话ID
          console.log(
            `[AgentChat] Session ${conversationId} not found, starting new session`,
          );
          return;
        }
        const data = await resp.json();

        // 🔧 改进：使用内容哈希生成稳定的消息 ID
        const generateMessageId = (content: string, role: string): string => {
          // 简单的字符串哈希函数（FNV-1a 变体）
          let hash = 2166136261;
          const str = `${role}:${content}`;
          for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash +=
              (hash << 1) +
              (hash << 4) +
              (hash << 7) +
              (hash << 8) +
              (hash << 24);
          }
          // 转换为正数并取前12位十六进制
          const hashStr = (hash >>> 0).toString(16).slice(0, 12);
          return `msg-${hashStr}`;
        };

        const loadedMessages: Message[] = (data.messages || []).map(
          (m: any) => ({
            id: generateMessageId(m.content || "", m.role || "unknown"),
            role: m.role === "user" ? "user" : "assistant",
            content: m.content || "",
            thought: m.thought || undefined,
            timestamp: new Date().toISOString(),
          }),
        );

        const dedupedMessages = dedupeLoadedMessages(loadedMessages);
        if (!mounted) return;
        if (dedupedMessages.length > 0) {
          setMessages(dedupedMessages);
          setCurrentSessionId(conversationId);
          console.log(
            `[AgentChat] Auto-loaded session ${conversationId} with ${dedupedMessages.length} messages`,
          );
        }
      } catch (error) {
        console.error("[AgentChat] Failed to auto-load session:", error);
      }
    };

    autoLoadSession();
    return () => {
      mounted = false;
    };
  }, [conversationId]); // 只在 conversationId 变化时执行一次

  useEffect(() => {
    if (answerCompleteCount <= 0 || !resumeId) {
      return;
    }

    let mounted = true;

    // 🔧 改进：延迟刷新，确保后端持久化已完成
    const refreshResume = async () => {
      // 延迟 500ms 后刷新，给后端持久化时间
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!mounted) return;

      try {
        const resume = await getResume(resumeId);
        if (!mounted) return;
        if (resume) {
          const resolvedUserId = user?.id ?? (resume as any).user_id ?? null;
          const resumeDataWithMeta = {
            ...(resume.data || {}),
            resume_id: resume.id,
            user_id: resolvedUserId,
            _meta: {
              resume_id: resume.id,
              user_id: resolvedUserId,
            },
          };
          setResumeData(resumeDataWithMeta as ResumeData);
          console.log(
            "[AgentChat] Resume data refreshed after agent completion",
          );
        }
      } catch (error) {
        console.error("[AgentChat] Failed to refresh resume data:", error);
      }
    };

    refreshResume();
    return () => {
      mounted = false;
    };
  }, [answerCompleteCount, resumeId, user?.id]);

  const isHtmlTemplate = resumeData?.templateType === "html";

  // 同步流式内容到报告文档和右侧面板
  useEffect(() => {
    if (!shouldHideResponseInChat || !streamingReportId || !currentAnswer) {
      return;
    }

    // 如果用户已选择该报告，更新 streamingReportContent 用于右侧面板显示
    if (selectedReportId === streamingReportId) {
      setStreamingReportContent(currentAnswer);
    }

    // 使用防抖机制，定期保存内容到报告文档
    const saveTimer = setTimeout(async () => {
      try {
        const report = await getReport(streamingReportId);
        if (report.main_id) {
          await fetch(`${API_BASE}/api/documents/${report.main_id}/content`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: currentAnswer }),
          });
          console.log(
            "[AgentChat] 流式内容已保存到报告文档:",
            streamingReportId,
          );
        }
      } catch (err) {
        console.error("[AgentChat] 保存流式内容失败:", err);
      }
    }, 500); // 每 500ms 保存一次

    return () => {
      clearTimeout(saveTimer);
    };
  }, [
    currentAnswer,
    shouldHideResponseInChat,
    streamingReportId,
    selectedReportId,
    API_BASE,
  ]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentThought, currentAnswer]);

  useEffect(() => {
    currentThoughtRef.current = currentThought;
    console.log("[AgentChat] currentThought updated", {
      length: currentThought.length,
    });
  }, [currentThought]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
    console.log("[AgentChat] currentAnswer updated", {
      length: currentAnswer.length,
    });
  }, [currentAnswer]);

  // 检测并创建报告（需要在 finalizeMessage 之前定义）
  const detectAndCreateReport = useCallback(
    async (content: string, messageId: string) => {
      // 检查是否已经为这条消息创建过报告
      if (generatedReports.some((r) => r.messageId === messageId)) {
        return;
      }

      // 检查是否有 'current' 消息ID的报告（流式输出时创建的），如果有则更新它
      const currentReport = generatedReports.find(
        (r) => r.messageId === "current",
      );
      if (currentReport && messageId !== "current") {
        // 更新 'current' 报告的消息ID为真实的消息ID
        setGeneratedReports((prev) =>
          prev.map((r) =>
            r.messageId === "current" ? { ...r, messageId } : r,
          ),
        );
        console.log(
          "[AgentChat] 更新报告消息ID:",
          currentReport.id,
          "from current to",
          messageId,
        );
        return;
      }

      // 检测报告生成的关键词（更精确的匹配）
      const reportPatterns = [
        /(?:生成|创建|完成|已生成|已创建)(?:了)?(?:一份|一个)?(?:关于|的)?([^"《\n]+)(?:的|"|》)?(?:详细|完整|研究|调研)?报告/,
        /(?:报告|调研报告|研究报告)(?:：|:)?\s*(?:关于|主题)?([^"《\n]+)/,
        /^#+\s*(.+?)(?:报告|调研|研究)/m,
      ];

      let reportTopic = "";
      for (const pattern of reportPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          reportTopic = match[1].trim();
          if (reportTopic.length > 5 && reportTopic.length < 100) {
            break;
          }
        }
      }

      // 如果没找到标题，但内容很长且包含报告关键词，使用前50个字符作为标题
      if (!reportTopic && content.length > 500) {
        const hasReportKeyword = /报告|调研|研究|分析/.test(content);
        if (hasReportKeyword) {
          // 尝试从第一个标题提取
          const titleMatch = content.match(/^#+\s*(.+?)$/m);
          if (titleMatch) {
            reportTopic = titleMatch[1].trim().substring(0, 50);
          } else {
            reportTopic = content.substring(0, 50).replace(/\n/g, " ").trim();
          }
        }
      }

      if (reportTopic && reportTopic.length > 5) {
        try {
          // 创建报告
          const result = await createReport(reportTopic);

          // 保存报告内容
          if (result.mainId) {
            await fetch(`${API_BASE}/api/documents/${result.mainId}/content`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            });
          }

          // 添加到生成的报告列表
          setGeneratedReports((prev) => [
            ...prev,
            {
              id: result.reportId,
              title: reportTopic,
              messageId,
            },
          ]);

          console.log(
            "[AgentChat] 检测到报告生成:",
            result.reportId,
            reportTopic,
          );
        } catch (err) {
          console.error("[AgentChat] 创建报告失败:", err);
        }
      }
    },
    [generatedReports, API_BASE],
  );

  /**
   * Finalize current message and add to history
   */
  const finalizeMessage = useCallback(() => {
    // 防止重复调用
    if (isFinalizedRef.current) {
      console.log("[AgentChat] finalizeMessage already called, skipping");
      return;
    }

    isFinalizedRef.current = true;

    const thoughtRefValue = currentThoughtRef.current.trim();
    const answerRefValue = currentAnswerRef.current.trim();
    const thoughtStateValue = currentThought.trim();
    const answerStateValue = currentAnswer.trim();
    const fallback = lastCompletedRef.current;
    const thought =
      thoughtRefValue || thoughtStateValue || fallback?.thought || "";
    const answer = answerRefValue || answerStateValue || fallback?.answer || "";

    console.log("[AgentChat] finalizeMessage called", {
      thoughtLength: thought.length,
      answerLength: answer.length,
      thoughtRefLength: thoughtRefValue.length,
      answerRefLength: answerRefValue.length,
      thoughtStateLength: thoughtStateValue.length,
      answerStateLength: answerStateValue.length,
      fallbackThoughtLength: fallback?.thought?.length || 0,
      fallbackAnswerLength: fallback?.answer?.length || 0,
    });

    if (!thought && !answer) {
      console.log("[AgentChat] No content to finalize, just resetting state");
      finalizeStream();
      setTimeout(() => {
        isFinalizedRef.current = false;
      }, 100);
      return;
    }

    refreshAfterSaveRef.current = true;
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      id: uniqueId,
      role: "assistant",
      content: answer || "",
      timestamp: new Date().toISOString(),
    };
    if (thought) {
      newMessage.thought = thought;
    }

    setSearchResults((prev) =>
      prev.map((item) =>
        item.messageId === "current" ? { ...item, messageId: uniqueId } : item,
      ),
    );

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.role === "assistant" &&
        (last.content || "").trim() === newMessage.content.trim() &&
        ((last as any).thought || "").trim() ===
          (newMessage.thought || "").trim()
      ) {
        console.log("[AgentChat] Duplicate assistant message skipped");
        return prev;
      }
      const updated = [...prev, newMessage];
      console.log("[AgentChat] Messages updated", { count: updated.length });

      // 如果 shouldHideResponseInChat 为 true，确保最终内容已保存到报告文档
      if (shouldHideResponseInChat && streamingReportId && answer) {
        (async () => {
          try {
            const report = await getReport(streamingReportId);
            if (report.main_id) {
              await fetch(
                `${API_BASE}/api/documents/${report.main_id}/content`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: answer }),
                },
              );
              console.log(
                "[AgentChat] 最终内容已保存到报告文档:",
                streamingReportId,
              );
            }
          } catch (err) {
            console.error("[AgentChat] 保存最终内容失败:", err);
          }
        })();
      }

      // 检测报告生成：如果消息内容包含报告相关关键词，尝试创建报告
      // 延迟检测，确保消息已添加到列表
      // 注意：如果流式输出时已经通过 ReportGenerationDetector 创建了报告，这里会检查并避免重复
      setTimeout(() => {
        detectAndCreateReport(newMessage.content, uniqueId);
      }, 500);

      // 重置流式输出相关状态（为下一次对话准备）
      if (shouldHideResponseInChat) {
        setShouldHideResponseInChat(false);
        setStreamingReportId(null);
        setStreamingReportContent("");
      }

      return updated;
    });
  }, [
    finalizeStream,
    currentAnswer,
    currentThought,
    detectAndCreateReport,
    shouldHideResponseInChat,
    streamingReportId,
    API_BASE,
  ]);

  const refreshSessions = useCallback(() => {
    setSessionsRefreshKey((prev) => prev + 1);
  }, []);

  // 检测并加载简历
  const detectAndLoadResume = useCallback(
    async (input: string, messageId: string) => {
      // 检查是否已经为这条消息加载过简历
      if (loadedResumes.some((r) => r.messageId === messageId)) {
        return;
      }

      // 检测简历加载的关键词
      const resumeLoadPatterns = [
        /(?:加载|打开|查看|显示)(?:我的|这个|一份)?(?:简历|CV)/,
        /(?:简历|CV)(?:名称|ID)?[:：]\s*([^\n]+)/,
      ];

      let resumeIdOrName: string | null = null;
      for (const pattern of resumeLoadPatterns) {
        const match = input.match(pattern);
        if (match) {
          if (match[1]) {
            // 提取了简历名称或ID
            resumeIdOrName = match[1].trim();
          } else {
            // 只是检测到关键词，没有具体名称
            resumeIdOrName = "";
          }
          break;
        }
      }

      // 如果没有检测到关键词，直接返回
      if (resumeIdOrName === null) {
        return;
      }

      try {
        let resume: any = null;
        let resumeName = "";

        if (resumeIdOrName === "") {
          // 没有指定具体简历，尝试获取用户的第一份简历
          const allResumes = await getAllResumes();
          if (allResumes.length > 0) {
            resume = allResumes[0];
            resumeName = resume.name || "我的简历";
          } else {
            console.log("[AgentChat] 用户没有简历");
            return;
          }
        } else {
          // 尝试通过ID或名称查找简历
          const allResumes = await getAllResumes();
          resume = allResumes.find(
            (r) => r.id === resumeIdOrName || r.name === resumeIdOrName,
          );

          if (!resume) {
            // 如果找不到，尝试直接通过ID获取
            resume = await getResume(resumeIdOrName);
          }

          if (resume) {
            resumeName = resume.name || resumeIdOrName;
          } else {
            console.log("[AgentChat] 未找到简历:", resumeIdOrName);
            return;
          }
        }

        if (resume) {
          const resolvedUserId = user?.id ?? (resume as any).user_id ?? null;
          const resumeDataWithMeta = {
            ...(resume.data || {}),
            resume_id: resume.id,
            user_id: resolvedUserId,
            _meta: {
              resume_id: resume.id,
              user_id: resolvedUserId,
            },
          };

          // 添加到加载的简历列表
          setLoadedResumes((prev) => [
            ...prev,
            {
              id: resume.id,
              name: resumeName,
              messageId,
              resumeData: resumeDataWithMeta as ResumeData,
            },
          ]);

          console.log("[AgentChat] 检测到简历加载:", resume.id, resumeName);
        }
      } catch (err) {
        console.error("[AgentChat] 加载简历失败:", err);
      }
    },
    [loadedResumes, user?.id],
  );

  const buildSavePayload = useCallback((messagesToSave: Message[]) => {
    return messagesToSave.map((msg) => ({
      role: msg.role,
      content: msg.content,
      thought: msg.thought,
    }));
  }, []);

  const persistSessionSnapshot = useCallback(
    async (
      sessionId: string,
      messagesToSave: Message[],
      shouldRefresh = false,
    ) => {
      // 验证 sessionId，如果为空则生成新的会话 ID
      let validSessionId = sessionId;
      if (!validSessionId || validSessionId.trim() === "") {
        // 如果为空，使用 conversationId 或生成新的
        validSessionId = conversationId || `conv-${Date.now()}`;
        if (validSessionId !== conversationId) {
          setConversationId(validSessionId);
        }
        console.log(`[AgentChat] Generated new session ID: ${validSessionId}`);
      }

      const payload = buildSavePayload(messagesToSave);
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastSavedKeyRef.current) {
        return;
      }

      if (saveInFlightRef.current) {
        queuedSaveRef.current = {
          sessionId: validSessionId,
          messages: messagesToSave,
        };
        return;
      }

      saveInFlightRef.current = (async () => {
        try {
          const resp = await fetch(
            `${HISTORY_BASE}/api/agent/history/sessions/${validSessionId}/save`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: payload }),
            },
          );
          if (!resp.ok) {
            console.error(`[AgentChat] Failed to save session: ${resp.status}`);
            const retryCount = (saveRetryRef.current[payloadKey] || 0) + 1;
            if (retryCount <= 2) {
              saveRetryRef.current[payloadKey] = retryCount;
              queuedSaveRef.current = {
                sessionId: validSessionId,
                messages: messagesToSave,
              };
              setTimeout(() => {
                if (!saveInFlightRef.current && queuedSaveRef.current) {
                  const next = queuedSaveRef.current;
                  queuedSaveRef.current = null;
                  void persistSessionSnapshot(
                    next.sessionId,
                    next.messages,
                    shouldRefresh,
                  );
                }
              }, 800 * retryCount);
            }
            return;
          }
          lastSavedKeyRef.current = payloadKey;
          delete saveRetryRef.current[payloadKey];
          if (shouldRefresh) {
            refreshSessions();
          }
        } catch (error) {
          console.error("[AgentChat] Failed to save session snapshot:", error);
          const retryCount = (saveRetryRef.current[payloadKey] || 0) + 1;
          if (retryCount <= 2) {
            saveRetryRef.current[payloadKey] = retryCount;
            queuedSaveRef.current = {
              sessionId: validSessionId,
              messages: messagesToSave,
            };
            setTimeout(() => {
              if (!saveInFlightRef.current && queuedSaveRef.current) {
                const next = queuedSaveRef.current;
                queuedSaveRef.current = null;
                void persistSessionSnapshot(
                  next.sessionId,
                  next.messages,
                  shouldRefresh,
                );
              }
            }, 800 * retryCount);
          }
        } finally {
          saveInFlightRef.current = null;
          if (queuedSaveRef.current) {
            const next = queuedSaveRef.current;
            queuedSaveRef.current = null;
            void persistSessionSnapshot(
              next.sessionId,
              next.messages,
              shouldRefresh,
            );
          }
        }
      })();
      await saveInFlightRef.current;
    },
    [conversationId, buildSavePayload, refreshSessions],
  );

  const waitForPendingSave = useCallback(async () => {
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (pendingSaveRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (saveInFlightRef.current) {
        await saveInFlightRef.current;
      }
    }
  }, []);

  useEffect(() => {
    if (!pendingSaveRef.current) {
      return;
    }
    pendingSaveRef.current = false;
    const shouldRefresh = refreshAfterSaveRef.current;
    refreshAfterSaveRef.current = false;
    // 验证 conversationId 不为空
    if (conversationId && conversationId.trim() !== "") {
      void persistSessionSnapshot(conversationId, messages, shouldRefresh);
    } else {
      console.warn("[AgentChat] Skipping save: conversationId is empty");
    }
  }, [conversationId, messages, persistSessionSnapshot]);

  const saveCurrentSession = useCallback(() => {
    if (isProcessing || currentThoughtRef.current || currentAnswerRef.current) {
      pendingSaveRef.current = true;
      finalizeMessage();
      return;
    }
    pendingSaveRef.current = true;
    void persistSessionSnapshot(conversationId, messages);
  }, [
    conversationId,
    finalizeMessage,
    isProcessing,
    messages,
    persistSessionSnapshot,
  ]);

  const deleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(
        `${HISTORY_BASE}/api/agent/history/${sessionId}`,
        {
          method: "DELETE",
        },
      );
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);

      // Clear active session memory on backend
      fetch(`${HISTORY_BASE}/api/agent/stream/session/${sessionId}`, {
        method: "DELETE",
      }).catch(() => undefined);

      if (currentSessionId === sessionId) {
        const newId = `conv-${Date.now()}`;
        setMessages([]);
        setCurrentSessionId(newId);
        setConversationId(newId);
        finalizeStream();
      }
      refreshSessions();
    } catch (error) {
      console.error("[AgentChat] Failed to delete session:", error);
    }
  };

  const dedupeLoadedMessages = (messages: Message[]) => {
    if (messages.length <= 1) return messages;

    const deduped: Message[] = [];
    const seenByRole = new Map<string, Set<string>>();
    const getSeenSet = (role: string) => {
      const key = role || "unknown";
      if (!seenByRole.has(key)) {
        seenByRole.set(key, new Set<string>());
      }
      return seenByRole.get(key)!;
    };

    for (const msg of messages) {
      const contentKey = (msg.content || "").trim();
      const roleKey = msg.role || "unknown";
      const seenContents = getSeenSet(roleKey);

      // 仅在 assistant 消息中进行扩展去重逻辑，避免误伤 user 消息
      let cleanContent = contentKey;
      if (roleKey === "assistant" && contentKey.includes("Response:")) {
        cleanContent =
          contentKey.split("Response:").pop()?.trim() || contentKey;
      }

      // 检查是否已存在相同或相似的内容
      // 检查完全匹配
      if (seenContents.has(contentKey)) {
        console.log(
          "[AgentChat] Duplicate message skipped (exact match):",
          contentKey.slice(0, 50),
        );
        continue;
      }

      if (roleKey === "assistant") {
        // 检查 Response 部分匹配
        if (seenContents.has(cleanContent)) {
          console.log(
            "[AgentChat] Duplicate message skipped (response match):",
            cleanContent.slice(0, 50),
          );
          continue;
        }

        // 检查包含关系：已存在的消息是否包含当前消息的 Response 部分
        let isDuplicate = false;
        for (const seen of seenContents) {
          if (seen.includes(cleanContent) || cleanContent.includes(seen)) {
            console.log(
              "[AgentChat] Duplicate message skipped (contains match):",
              cleanContent.slice(0, 50),
            );
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) {
          continue;
        }
      }

      seenContents.add(contentKey);
      if (roleKey === "assistant") {
        seenContents.add(cleanContent); // 同时记录 Response 部分
      }
      deduped.push(msg);
    }

    return deduped;
  };

  const renameSession = async (sessionId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    try {
      await fetch(
        `${HISTORY_BASE}/api/agent/history/sessions/${sessionId}/title`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle }),
        },
      );
      refreshSessions();
    } catch (error) {
      console.error("[AgentChat] Failed to rename session:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (isLoadingSession) {
      return;
    }
    setIsLoadingSession(true);
    // 先保存当前会话，确保未完成的内容被保存
    saveCurrentSession();
    await waitForPendingSave();

    try {
      const resp = await fetch(
        `${HISTORY_BASE}/api/agent/history/sessions/${sessionId}`,
      );

      if (!resp.ok) {
        console.error(
          `[AgentChat] Failed to load session: ${resp.status} ${resp.statusText}`,
        );
        // 如果加载失败，不清空当前消息，保持原状态
        return;
      }

      const data = await resp.json();

      // 检查返回的数据格式
      if (!data || !Array.isArray(data.messages)) {
        console.error("[AgentChat] Invalid session data format:", data);
        return;
      }

      // 🔧 改进：使用内容哈希生成稳定的消息 ID（与 autoLoadSession 保持一致）
      const generateMessageId = (
        content: string,
        role: string,
        index: number,
      ): string => {
        // 如果内容为空，使用索引作为 ID 的一部分，确保唯一性
        const contentForHash = content || `empty-${index}`;
        let hash = 2166136261;
        const str = `${role}:${contentForHash}:${index}`;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);
        }
        const hashStr = (hash >>> 0).toString(16).slice(0, 12);
        return `msg-${hashStr}`;
      };

      // 过滤掉 tool 角色的消息（这些是内部消息，不应该显示给用户）
      const userVisibleMessages = (data.messages || []).filter(
        (m: any) => m.role === "user" || m.role === "assistant",
      );

      const loadedMessages: Message[] = userVisibleMessages.map(
        (m: any, index: number) => ({
          id: generateMessageId(m.content || "", m.role || "unknown", index),
          role: m.role === "user" ? "user" : "assistant",
          content: m.content || "",
          thought: m.thought || undefined,
          timestamp: new Date().toISOString(),
        }),
      );

      const dedupedMessages = dedupeLoadedMessages(loadedMessages);

      // 只有在成功加载到消息时才更新状态
      if (dedupedMessages.length > 0 || userVisibleMessages.length === 0) {
        setMessages(dedupedMessages);
        setCurrentSessionId(sessionId);
        setConversationId(sessionId);
        // 清理流式状态，避免显示旧会话的流式内容
        finalizeStream();
      } else {
        console.warn(
          "[AgentChat] Loaded session has no valid messages, keeping current state",
        );
      }
    } catch (error) {
      console.error("[AgentChat] Failed to load session:", error);
      // 发生错误时，不清空当前消息，保持原状态
    } finally {
      setIsLoadingSession(false);
    }
  };

  const createNewSession = useCallback(async () => {
    // 先尽量保存当前会话，避免切换后丢失上下文
    saveCurrentSession();
    await waitForPendingSave();

    const newId = `conv-${Date.now()}`;
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    finalizeStream();

    // 关键：立即持久化一个空会话，让侧边栏立刻可见并可独立切换
    await persistSessionSnapshot(newId, [], true);
  }, [
    finalizeStream,
    persistSessionSnapshot,
    saveCurrentSession,
    waitForPendingSave,
  ]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      loadSession(sessionId);
      setIsSidebarOpen(false);
    },
    [loadSession],
  );

  const handleCreateSession = useCallback(() => {
    void createNewSession();
    setIsSidebarOpen(false);
  }, [createNewSession]);

  // 处理简历选择
  const handleResumeSelect = useCallback(
    async (selectedResume: SavedResume) => {
      setShowResumeSelector(false);

      // 加载选中的简历数据
      const resolvedUserId =
        user?.id ?? (selectedResume as any).user_id ?? null;
      const resumeDataWithMeta = {
        ...(selectedResume.data || {}),
        resume_id: selectedResume.id,
        user_id: resolvedUserId,
        _meta: {
          resume_id: selectedResume.id,
          user_id: resolvedUserId,
        },
      } as unknown as ResumeData;

      // 设置简历数据
      setResumeData(resumeDataWithMeta);

      // 添加到加载的简历列表，以便在右侧显示
      const messageId = `resume-select-${Date.now()}`;
      setLoadedResumes((prev) => [
        ...prev,
        {
          id: selectedResume.id,
          name: selectedResume.name,
          messageId,
          resumeData: resumeDataWithMeta,
        },
      ]);

      // 自动选中该简历，显示在右侧
      setSelectedResumeId(selectedResume.id);
      setSelectedReportId(null);

      // 添加一条系统消息告知用户简历已加载
      const systemMessage: Message = {
        id: messageId,
        role: "assistant",
        content: `已加载简历「${selectedResume.name}」，现在可以对这份简历进行操作了。`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMessage]);

      // 清除暂存的输入
      setPendingResumeInput("");

      console.log(
        "[AgentChat] 简历已选择并加载:",
        selectedResume.id,
        selectedResume.name,
      );
    },
    [user?.id],
  );

  // 取消简历选择
  const handleResumeSelectorCancel = useCallback(() => {
    setShowResumeSelector(false);
    setPendingResumeInput("");
  }, []);

  const handleCreateResume = useCallback(() => {
    setShowResumeSelector(false);
    setPendingResumeInput("");
    navigate("/workspace/html");
  }, [navigate]);

  const sendUserTextMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isProcessing) return;

      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const userMessageEntry: Message = {
        id: uniqueId,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      };
      const nextMessages = [...messages, userMessageEntry];
      const isFirstMessage = messages.length === 0;

      setMessages(nextMessages);
      if (isFirstMessage) {
        let validConversationId = conversationId;
        if (!validConversationId || validConversationId.trim() === "") {
          validConversationId = `conv-${Date.now()}`;
          setConversationId(validConversationId);
        }
        if (!currentSessionId) {
          setCurrentSessionId(validConversationId);
        }
        void persistSessionSnapshot(validConversationId, nextMessages, true);
      }

      isFinalizedRef.current = false;
      shouldFinalizeRef.current = false;
      setThoughtProcessComplete(false);
      setSearchResults((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );

      await sendMessage(userMessage);
    },
    [
      isProcessing,
      messages,
      conversationId,
      currentSessionId,
      persistSessionSnapshot,
      sendMessage,
    ],
  );

  const handleUploadFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      if (selectedFiles.length === 0) return;
      if (isProcessing) {
        alert("当前正在处理消息，请稍后再上传。");
        event.target.value = "";
        return;
      }

      setPendingAttachments((prev) => {
        const existingKeys = new Set(
          prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
        );
        const unique = selectedFiles.filter((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          return !existingKeys.has(key);
        });
        return [...prev, ...unique];
      });
      event.target.value = "";
    },
    [isProcessing],
  );

  const handleRemoveAttachment = useCallback((target: File) => {
    const targetKey = `${target.name}-${target.size}-${target.lastModified}`;
    setPendingAttachments((prev) =>
      prev.filter(
        (file) =>
          `${file.name}-${file.size}-${file.lastModified}` !== targetKey,
      ),
    );
  }, []);

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    if (answerCompleteCount === 0) return;
    if (answerCompleteCount <= lastHandledAnswerCompleteRef.current) {
      return;
    }
    lastHandledAnswerCompleteRef.current = answerCompleteCount;

    shouldFinalizeRef.current = true;
    const hasContent =
      currentAnswerRef.current.trim() ||
      currentThoughtRef.current.trim() ||
      currentAnswer.trim() ||
      currentThought.trim();
    if (hasContent) {
      lastCompletedRef.current = {
        thought: currentThoughtRef.current.trim() || currentThought.trim(),
        answer: currentAnswerRef.current.trim() || currentAnswer.trim(),
        at: Date.now(),
      };
    }
    console.log("[AgentChat] answerCompleteCount effect", {
      answerCompleteCount,
      hasContent,
      answerRefLength: currentAnswerRef.current.trim().length,
      thoughtRefLength: currentThoughtRef.current.trim().length,
      answerStateLength: currentAnswer.trim().length,
      thoughtStateLength: currentThought.trim().length,
    });

    // 隐藏回答模式下不会渲染 Response 打字机，收到 answerComplete 后直接 finalize
    if (shouldHideResponseInChat) {
      console.log(
        "[AgentChat] Hidden response mode, finalize immediately on answerComplete",
      );
      shouldFinalizeRef.current = false;
      finalizeMessage();
      finalizeStream();
      setTimeout(() => {
        isFinalizedRef.current = false;
      }, 100);
      return;
    }

    if (!hasContent) {
      // No content to typewriter, finalize immediately to clear state
      finalizeMessage();
      return;
    }
    // Fallback: if typewriter doesn't complete, cleanup after a delay
    setTimeout(() => {
      if (shouldFinalizeRef.current && isProcessing) {
        console.log("[AgentChat] Fallback finalize timeout");
        shouldFinalizeRef.current = false;
        finalizeMessage();
        finalizeStream();
        setTimeout(() => {
          isFinalizedRef.current = false;
        }, 100);
      }
    }, 1400);
  }, [
    answerCompleteCount,
    finalizeMessage,
    finalizeStream,
    shouldHideResponseInChat,
  ]);

  /**
   * Send message to backend via SSE
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!trimmedInput && !hasAttachments) || isProcessing || isUploadingFile)
      return;

    // 检测用户是否要生成报告
    const isReportRequest =
      /(?:生成|创建|写)(?:一份|一个)?(?:关于)?(.+?)(?:的|的详细|的完整)?(?:报告|调研报告|研究报告)/.test(
        trimmedInput,
      );
    if (isReportRequest) {
      const topicMatch = trimmedInput.match(
        /(?:生成|创建|写)(?:一份|一个)?(?:关于)?(.+?)(?:的|的详细|的完整)?(?:报告|调研报告|研究报告)/,
      );
      if (topicMatch && topicMatch[1]) {
        const topic = topicMatch[1].trim();
        // 提前创建报告，这样 agent 生成内容时可以保存到报告中
        try {
          const result = await createReport(topic);
          // 将报告 ID 存储到 conversation context 中，以便后续保存内容
          sessionStorage.setItem(
            `pendingReport:${conversationId}`,
            JSON.stringify({
              reportId: result.reportId,
              mainId: result.mainId,
              topic,
            }),
          );
        } catch (err) {
          console.error("[AgentChat] 预创建报告失败:", err);
        }
      }
    }

    // 检测是否是简历加载请求（需要弹出选择器）
    const isResumeLoadRequest =
      /(?:加载|打开|查看|显示)(?:我的|这个|一份)?(?:简历|CV|履历)/.test(
        trimmedInput,
      );

    // 如果是简历加载请求，弹出选择器让用户选择 HTML 简历
    if (isResumeLoadRequest && !hasAttachments) {
      setPendingResumeInput(trimmedInput);
      setShowResumeSelector(true);
      setResumeError(null);
      return;
    }

    // 检测是否是其他简历操作请求（需要简历数据但不需要选择器）
    const isResumeOperation =
      /(?:创建|修改|优化|编辑|分析|改进)(?:我的|这个|一份)?(?:简历|CV|履历)/.test(
        trimmedInput,
      );

    // 只有明确的简历操作才需要检查简历数据
    if (isResumeOperation && !resumeData && !hasAttachments) {
      // 显示简历选择器，而不是错误提示
      setPendingResumeInput(trimmedInput);
      setShowResumeSelector(true);
      setResumeError(null);
      return;
    }

    // 清除之前的错误
    setResumeError(null);

    const userMessage = trimmedInput;
    const attachmentsToProcess = pendingAttachments;
    setInput("");
    setPendingAttachments([]);
    try {
      if (!hasAttachments) {
        await sendUserTextMessage(userMessage);
        return;
      }

      setIsUploadingFile(true);
      const attachmentBlocks: string[] = [];

      for (const file of attachmentsToProcess) {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(`${API_BASE}/api/resume/upload-pdf`, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            throw new Error(`PDF 解析失败: ${response.status}`);
          }

          const data = await response.json();
          const parsedResume = data?.resume;
          if (parsedResume && typeof parsedResume === "object") {
            const resolvedUserId = user?.id ?? null;
            const resumeDataWithMeta = {
              ...parsedResume,
              _meta: {
                user_id: resolvedUserId,
              },
            } as ResumeData;
            setResumeData(resumeDataWithMeta);
            attachmentBlocks.push(
              `已上传并解析 PDF 文件《${file.name}》。请基于这份简历内容进行分析并给出优化建议。`,
            );
          } else {
            attachmentBlocks.push(
              `已上传 PDF 文件《${file.name}》，但未解析出结构化简历内容。`,
            );
          }
          continue;
        }

        const isTextLike =
          file.type.startsWith("text/") ||
          /\.(txt|md|json|csv)$/i.test(file.name);
        if (!isTextLike) {
          throw new Error("仅支持 pdf/txt/md/json/csv 文件");
        }

        const rawText = await file.text();
        const maxLen = 12000;
        const clipped = rawText.slice(0, maxLen);
        const truncatedNote =
          rawText.length > maxLen
            ? "\n[文件内容过长，已截断为前 12000 字符]"
            : "";
        attachmentBlocks.push(
          `文件《${file.name}》内容：\n${clipped}${truncatedNote}`,
        );
      }

      const baseMessage =
        userMessage || "我上传了附件，请先提炼关键信息并给出下一步建议。";
      const finalMessage = attachmentBlocks.length
        ? `${baseMessage}\n\n${attachmentBlocks.join("\n\n")}`
        : baseMessage;
      await sendUserTextMessage(finalMessage);
    } catch (error) {
      console.error("[AgentChat] Failed to send message:", error);
      setPendingAttachments(attachmentsToProcess);
      setResumeError(
        error instanceof Error ? error.message : "文件上传失败，请稍后重试",
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (!input.trim() || isProcessing) {
        return;
      }
      event.currentTarget.form?.requestSubmit();
    },
    [input, isProcessing],
  );

  /**
   * Clear conversation
   */
  const handleClearConversation = () => {
    setMessages([]);
    finalizeStream();
  };

  return (
    <WorkspaceLayout>
      <div className="h-full bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden relative">
          {isDesktop && (
            <aside className="w-[280px] shrink-0 border-r border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-900">
              <RecentSessions
                baseUrl={HISTORY_BASE}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={deleteSession}
                onRenameSession={renameSession}
                refreshKey={sessionsRefreshKey}
              />
            </aside>
          )}

          {!isDesktop && isSidebarOpen && (
            <div
              className="absolute inset-0 z-20 bg-black/30"
              onClick={() => setIsSidebarOpen(false)}
              role="button"
              tabIndex={-1}
            >
              <aside
                className="h-full w-[280px] bg-white dark:bg-slate-900 shadow-xl border-r border-slate-200/50 dark:border-slate-800/50"
                onClick={(event) => event.stopPropagation()}
              >
                <RecentSessions
                  baseUrl={HISTORY_BASE}
                  currentSessionId={currentSessionId}
                  onSelectSession={handleSelectSession}
                  onCreateSession={handleCreateSession}
                  onDeleteSession={deleteSession}
                  onRenameSession={renameSession}
                  refreshKey={sessionsRefreshKey}
                />
              </aside>
            </div>
          )}

          {/* Left: Chat */}
          <section className="flex-1 min-w-0 flex flex-col">
            <main className="flex-1 overflow-y-auto px-4 py-8">
              <div className="max-w-3xl mx-auto w-full">
                {loadingResume && (
                  <div className="text-sm text-gray-400 mb-4">
                    正在加载简历...
                  </div>
                )}
                {resumeError && (
                  <div className="text-sm text-red-500 mb-4">{resumeError}</div>
                )}
                {isLoadingSession && (
                  <div className="text-xs text-gray-400 mb-4">
                    正在加载会话...
                  </div>
                )}

                {messages.length === 0 && !isProcessing && (
                  <div className="text-center py-20">
                    <div className="text-5xl mb-4">✨</div>
                    <p className="text-gray-600 text-lg mb-2">
                      输入消息开始对话
                    </p>
                    <p className="text-gray-400 text-sm mb-2">
                      体验 Thought Process · 流式输出 · Markdown 渲染
                    </p>
                    <p className="text-gray-500 text-sm mt-4">
                      例如：生成一份关于 AI 发展趋势的报告
                    </p>
                    <p className="text-gray-300 text-xs mt-2">
                      使用 SSE + CLTP 传输
                    </p>
                  </div>
                )}

                {/* 历史消息 - 按顺序：Thought Process → SearchCard → Response */}
                {messages.map((msg, idx) => {
                  // ... (保留原有逻辑)
                  // 检查这条消息是否有关联的报告
                  const reportForMessage = generatedReports.find(
                    (r) => r.messageId === msg.id,
                  );
                  // 检查这条消息是否有关联的简历
                  const resumeForMessage = loadedResumes.find(
                    (r) => r.messageId === msg.id,
                  );
                  const searchForMessage = searchResults.find(
                    (r) => r.messageId === msg.id,
                  );

                  // 用户消息：直接渲染
                  if (msg.role === "user") {
                    return (
                      <div
                        key={msg.id || idx}
                        className="flex justify-end mb-6"
                      >
                        <div className="max-w-[80%]">
                          <div className="text-right text-xs text-gray-400 mb-1">
                            {new Date().toLocaleString()}
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-800">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Assistant 消息：按顺序渲染 Thought → SearchCard → Response
                  return (
                    <Fragment key={msg.id || idx}>
                      {/* 1. Thought Process */}
                      {msg.thought && (
                        <ThoughtProcess
                          content={msg.thought}
                          isStreaming={false}
                          isLatest={false}
                          defaultExpanded={false}
                        />
                      )}

                      {/* 2. SearchCard（在 Thought 和 Response 之间） */}
                      {searchForMessage && (
                        <div className="my-4">
                          <SearchCard
                            query={searchForMessage.data.query}
                            totalResults={searchForMessage.data.total_results}
                            searchTime={
                              searchForMessage.data.metadata?.search_time
                            }
                            onOpen={() =>
                              setActiveSearchPanel(searchForMessage.data)
                            }
                          />
                          <SearchSummary
                            query={searchForMessage.data.query}
                            results={searchForMessage.data.results}
                            searchTime={
                              searchForMessage.data.metadata?.search_time
                            }
                          />
                        </div>
                      )}

                      {/* 3. Response */}
                      {msg.content && (
                        <div className="text-gray-800 mb-6">
                          <EnhancedMarkdown>{msg.content}</EnhancedMarkdown>
                        </div>
                      )}

                      {/* 反馈按钮 */}
                      {msg.content && (
                        <div className="flex gap-2 mb-6">
                          <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                              />
                            </svg>
                          </button>
                          <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                              />
                            </svg>
                          </button>
                          <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="6" cy="12" r="1.5" />
                              <circle cx="18" cy="12" r="1.5" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* 如果这条消息有报告，显示报告卡片 */}
                      {reportForMessage && (
                        <div className="my-4">
                          <ReportCard
                            reportId={reportForMessage.id}
                            title={reportForMessage.title}
                            subtitle="点击查看完整报告"
                            onClick={() => {
                              setSelectedReportId(reportForMessage.id);
                              setReportTitle(reportForMessage.title);
                              setSelectedResumeId(null);
                              if (
                                streamingReportId === reportForMessage.id &&
                                currentAnswer
                              ) {
                                setStreamingReportContent(currentAnswer);
                              }
                            }}
                          />
                        </div>
                      )}
                      {/* 如果这条消息有简历，显示简历卡片 */}
                      {resumeForMessage && (
                        <div className="my-4">
                          <ResumeCard
                            resumeId={resumeForMessage.id}
                            title={resumeForMessage.name}
                            subtitle="点击查看简历"
                            onClick={() => {
                              setSelectedResumeId(resumeForMessage.id);
                              setSelectedReportId(null);
                              if (resumeForMessage.resumeData) {
                                setResumeData(resumeForMessage.resumeData);
                              }
                            }}
                          />
                        </div>
                      )}
                    </Fragment>
                  );
                })}

                {/* 当前正在生成的消息 - 按顺序：Thought Process → SearchCard → Response */}
                {isProcessing &&
                  (currentThought ||
                    (!shouldHideResponseInChat && currentAnswer)) && (
                    <>
                      {/* 1. Thought Process 优先显示 */}
                      {currentThought && (
                        <ThoughtProcess
                          content={currentThought}
                          isStreaming={true}
                          isLatest={true}
                          defaultExpanded={true}
                          onComplete={() => {
                            console.log(
                              "[AgentChat] ThoughtProcess 打字机效果完成",
                            );
                            setThoughtProcessComplete(true);
                          }}
                        />
                      )}

                      {/* 2. 搜索卡片在 Thought Process 完成后、Response 之前显示 */}
                      {(() => {
                        const currentSearch = searchResults.find(
                          (r) => r.messageId === "current",
                        );
                        // 只有当 Thought Process 完成（或没有 thought）时才显示 SearchCard
                        const canShowSearchCard =
                          !currentThought || thoughtProcessComplete;
                        if (
                          !currentSearch ||
                          !isProcessing ||
                          !canShowSearchCard
                        ) {
                          return null;
                        }
                        return (
                          <div className="my-4">
                            <SearchCard
                              query={currentSearch.data.query}
                              totalResults={currentSearch.data.total_results}
                              searchTime={
                                currentSearch.data.metadata?.search_time
                              }
                              onOpen={() =>
                                setActiveSearchPanel(currentSearch.data)
                              }
                            />
                            <SearchSummary
                              query={currentSearch.data.query}
                              results={currentSearch.data.results}
                              searchTime={
                                currentSearch.data.metadata?.search_time
                              }
                            />
                          </div>
                        );
                      })()}

                      {/* 3. Response 最后显示（等待 Thought Process 完成或没有 thought 时），使用打字机效果 */}
                      <StreamingResponse
                        content={currentAnswer}
                        canStart={
                          !shouldHideResponseInChat &&
                          (!currentThought || thoughtProcessComplete)
                        }
                        onComplete={() => {
                          // Response 打字机效果完成时，清理流式状态
                          if (shouldFinalizeRef.current) {
                            console.log(
                              "[AgentChat] Response 打字机完成, finalize stream",
                            );
                            shouldFinalizeRef.current = false;
                            finalizeMessage();
                            finalizeStream();
                            setTimeout(() => {
                              isFinalizedRef.current = false;
                            }, 100);
                          }
                        }}
                      />

                      {/* 如果正在生成报告内容，检测并创建报告 */}
                      {currentAnswer.length > 500 && (
                        <ReportGenerationDetector
                          content={currentAnswer}
                          onReportCreated={(reportId, title) => {
                            // 当报告创建后，设置隐藏 response 的标志
                            setShouldHideResponseInChat(true);
                            setStreamingReportId(reportId);

                            // 如果用户已经选择了该报告，立即设置流式内容
                            if (selectedReportId === reportId) {
                              setStreamingReportContent(currentAnswer);
                            }

                            // 当报告创建后，添加到列表
                            // 使用 'current' 作为临时 messageId，finalize 时会通过 detectAndCreateReport 更新为真实 messageId
                            setGeneratedReports((prev) => {
                              // 检查是否已存在相同的报告ID
                              if (prev.some((r) => r.id === reportId)) {
                                return prev;
                              }
                              // 检查是否已有 'current' 消息ID的报告（避免重复）
                              const hasCurrent = prev.some(
                                (r) => r.messageId === "current",
                              );
                              if (hasCurrent) {
                                // 更新现有的 current 报告
                                return prev.map((r) =>
                                  r.messageId === "current"
                                    ? { ...r, id: reportId, title }
                                    : r,
                                );
                              }
                              // 添加新报告
                              return [
                                ...prev,
                                {
                                  id: reportId,
                                  title,
                                  messageId: "current", // 临时ID，finalize时会更新
                                },
                              ];
                            });
                          }}
                        />
                      )}
                      {/* 显示流式输出时的报告卡片 */}
                      {(() => {
                        const currentReport = generatedReports.find(
                          (r) => r.messageId === "current",
                        );
                        if (currentReport && isProcessing) {
                          return (
                            <div className="my-4">
                              <ReportCard
                                reportId={currentReport.id}
                                title={currentReport.title}
                                subtitle="点击查看完整报告"
                                onClick={() => {
                                  setSelectedReportId(currentReport.id);
                                  setReportTitle(currentReport.title);
                                  setSelectedResumeId(null);
                                  // 如果报告还在流式输出中，设置 streamingReportContent
                                  if (
                                    streamingReportId === currentReport.id &&
                                    currentAnswer
                                  ) {
                                    setStreamingReportContent(currentAnswer);
                                  }
                                }}
                              />
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}

                {/* 简历选择器 */}
                {showResumeSelector && (
                  <ResumeSelector
                    onSelect={handleResumeSelect}
                    onCreateResume={handleCreateResume}
                    onCancel={handleResumeSelectorCancel}
                  />
                )}

                {/* Loading */}
                {isProcessing && !currentThought && !currentAnswer && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-6">
                    <div className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></span>
                      <span
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "100ms" }}
                      ></span>
                      <span
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "200ms" }}
                      ></span>
                    </div>
                    <span
                      className="animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    >
                      Thinking...
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </main>

            {/* Input Area */}
            <div className="bg-slate-50 dark:bg-slate-950 px-4 py-4 pb-8">
              <div className="max-w-3xl mx-auto w-full">
                <form onSubmit={handleSubmit}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleUploadFile}
                  />
                  <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20">
                    {pendingAttachments.length > 0 && (
                      <div className="px-3 pt-3 flex flex-wrap gap-2">
                        {pendingAttachments.map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                          >
                            <FileText className="size-3.5 shrink-0 text-indigo-500" />
                            <span className="truncate max-w-[220px]">
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(file)}
                              className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              aria-label="移除已上传文件"
                              title="移除文件"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={
                        isProcessing
                          ? "正在处理中，可以继续输入..."
                          : "输入消息...（例如：生成一份关于 AI 发展趋势的报告）"
                      }
                      className="w-full min-h-[92px] resize-none bg-transparent px-4 pt-3 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
                    />
                    <div className="flex items-center justify-between px-3 pb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleClickUpload}
                          disabled={isProcessing || isUploadingFile}
                          className={`size-7 rounded-full border flex items-center justify-center transition-colors ${
                            isProcessing || isUploadingFile
                              ? "border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500 cursor-not-allowed"
                              : "border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500"
                          }`}
                          title={isUploadingFile ? "上传中..." : "上传文件"}
                          aria-label="上传文件"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={
                          (!input.trim() && pendingAttachments.length === 0) ||
                          isProcessing ||
                          isUploadingFile
                        }
                        className={`size-7 rounded-full flex items-center justify-center transition-colors ${
                          (!input.trim() && pendingAttachments.length === 0) ||
                          isProcessing ||
                          isUploadingFile
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                        title={
                          isProcessing ? "等待当前消息处理完成" : "发送消息"
                        }
                        aria-label="发送消息"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* Right: Report Preview or Resume Preview - 只格在有选中内容时显示 */}
          {(selectedReportId || selectedResumeId) && (
            <aside className="w-[45%] min-w-[420px] bg-slate-50 overflow-y-auto border-l border-slate-200">
              <div className="border-b border-slate-200 bg-white px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">
                      {selectedReportId ? "报告内容" : "简历 PDF 预览"}
                    </h2>
                    {selectedReportId && reportTitle && (
                      <p className="text-xs text-slate-400 mt-1">
                        {reportTitle}
                      </p>
                    )}
                    {selectedResumeId &&
                      !selectedReportId &&
                      selectedLoadedResume && (
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedLoadedResume.name}
                        </p>
                      )}
                  </div>
                  {selectedReportId && (
                    <button
                      onClick={() => {
                        setSelectedReportId(null);
                        setReportContent("");
                        setReportTitle("");
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      关闭
                    </button>
                  )}
                  {selectedResumeId && !selectedReportId && (
                    <button
                      onClick={() => {
                        setSelectedResumeId(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      关闭
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {selectedReportId ? (
                  <ReportContentView
                    reportId={selectedReportId}
                    streamingContent={
                      streamingReportId === selectedReportId
                        ? streamingReportContent
                        : undefined
                    }
                    isStreaming={
                      streamingReportId === selectedReportId && isProcessing
                    }
                    onContentLoaded={(content, title) => {
                      setReportContent(content);
                      if (title) setReportTitle(title);
                    }}
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <p className="text-xs text-slate-500 text-pretty">
                        {selectedResumePdfState.progress || "简历 PDF 预览"}
                      </p>
                      {selectedLoadedResume && (
                        <button
                          type="button"
                          onClick={() =>
                            void renderResumePdfPreview(selectedLoadedResume, true)
                          }
                          disabled={selectedResumePdfState.loading}
                          className="text-xs text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          重新渲染
                        </button>
                      )}
                    </div>

                    <div className="h-[calc(100dvh-210px)] bg-slate-100/70 overflow-auto p-3">
                      {!selectedLoadedResume && (
                        <div className="text-sm text-slate-500">正在加载简历...</div>
                      )}

                      {selectedLoadedResume &&
                        selectedResumePdfState.loading &&
                        !selectedResumePdfState.blob && (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="mx-auto mb-3 size-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm text-slate-500 text-pretty">
                                {selectedResumePdfState.progress ||
                                  "正在渲染简历 PDF..."}
                              </p>
                            </div>
                          </div>
                        )}

                      {selectedLoadedResume && selectedResumePdfState.error && (
                        <div className="h-full flex items-center justify-center">
                          <div className="max-w-sm text-center">
                            <p className="text-sm text-red-500 text-pretty">
                              {selectedResumePdfState.error}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void renderResumePdfPreview(selectedLoadedResume, true)
                              }
                              className="mt-3 text-xs text-indigo-600 hover:text-indigo-700"
                            >
                              点击重试
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedLoadedResume && selectedResumePdfState.blob && (
                        <div className="flex justify-center">
                          <PDFViewerSelector
                            pdfBlob={selectedResumePdfState.blob}
                            scale={1}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
        <SearchResultPanel
          isOpen={!!activeSearchPanel}
          query={activeSearchPanel?.query || ""}
          totalResults={activeSearchPanel?.total_results || 0}
          results={activeSearchPanel?.results || []}
          onClose={() => setActiveSearchPanel(null)}
        />
      </div>
    </WorkspaceLayout>
  );
}
