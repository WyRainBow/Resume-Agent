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
import TTSButton from "@/components/chat/TTSButton";
import { Copy, RotateCcw, Check, Mic, StopCircle, Loader2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import ReportCard from "@/components/chat/ReportCard";
import ResumeCard from "@/components/chat/ResumeCard";
import ResumeSelector from "@/components/chat/ResumeSelector";
import SearchCard from "@/components/chat/SearchCard";
import SearchResultPanel from "@/components/chat/SearchResultPanel";
import SearchSummary from "@/components/chat/SearchSummary";
import { ReportGenerationDetector } from "@/components/chat/ReportGenerationDetector";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useCLTP } from "@/hooks/useCLTP";
import { isAgentEnabled } from "@/lib/runtimeEnv";
import { PDFViewerSelector } from "@/components/PDFEditor";
import { convertToBackendFormat } from "@/pages/Workspace/v2/utils/convertToBackend";
import {
  DEFAULT_MENU_SECTIONS,
  type ResumeData,
} from "@/pages/Workspace/v2/types";
import { getResume, getAllResumes, saveResume } from "@/services/resumeStorage";
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
import {
  ArrowUp,
  FileText,
  Plus,
  X,
  Sparkles,
  Wand2,
  Zap,
  Briefcase,
  Search,
  MessageSquare,
  Bot,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import StreamingResponse from "@/components/chat/StreamingResponse";
import StreamingOutputPanel from "@/components/chat/StreamingOutputPanel";
import { useTextStream } from "@/hooks/useTextStream";

import WorkspaceLayout from "@/pages/WorkspaceLayout";
import CustomScrollbar from "@/components/common/CustomScrollbar";

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
  const [isLoadingChat, setIsLoadingChat] = useState(false);
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
      setIsLoadingChat(false);
      setContent(streamingContent);
      return;
    }

    // 如果流式输出完成，从 API 加载完整内容
    const loadReport = async () => {
      try {
        setIsLoadingChat(true);
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
        setIsLoadingChat(false);
      }
    };
    loadReport();
  }, [reportId, onContentLoaded, isStreaming, streamingContent]);

  if (isLoadingChat && !isStreaming) {
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
// 配置（运行时 API 基地址由 useEnvironment 提供，不再使用构建时常量）
// ============================================================================

const SSE_HEARTBEAT_TIMEOUT = 60000; // 60 seconds
const HISTORY_APPEND_MODE =
  String(import.meta.env.VITE_AGENT_HISTORY_APPEND_MODE ?? "true").toLowerCase() !==
  "false";

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

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter((item) => item.length > 0);
  }
  const text = toText(value);
  return text ? [text] : [];
}

function listToHtml(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function splitDateRange(rawDate: string): {
  startDate: string;
  endDate: string;
} {
  const date = rawDate.trim();
  if (!date) return { startDate: "", endDate: "" };
  const parts = date.split(/\s*[-~至]\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return { startDate: parts[0], endDate: parts.slice(1).join(" - ") };
  }
  return { startDate: date, endDate: "" };
}

function normalizeImportedResumeToCanonical(
  source: Record<string, any>,
  opts: { resumeId: string; title: string },
): ResumeData {
  const now = new Date().toISOString();
  const contact = (source.contact || {}) as Record<string, unknown>;
  const educationRaw = Array.isArray(source.education) ? source.education : [];
  const internshipsRaw = Array.isArray(source.internships)
    ? source.internships
    : [];
  const experienceRaw = Array.isArray(source.experience)
    ? source.experience
    : [];
  const projectsRaw = Array.isArray(source.projects) ? source.projects : [];
  const openSourceRaw = Array.isArray(source.openSource)
    ? source.openSource
    : Array.isArray(source.opensource)
      ? source.opensource
      : Array.isArray(source.open_source)
        ? source.open_source
        : [];
  const awardsRaw = Array.isArray(source.awards) ? source.awards : [];
  const skillsRaw = Array.isArray(source.skills) ? source.skills : [];
  const workList = internshipsRaw.length > 0 ? internshipsRaw : experienceRaw;

  const education = educationRaw.map((item: any, index: number) => {
    const title = toText(item?.title || item?.school || item?.name);
    const subtitle = toText(item?.subtitle || item?.major || item?.field);
    const degree = toText(item?.degree);
    const date = toText(item?.date);
    const details = toStringList(item?.details || item?.highlights);
    const range = splitDateRange(date);
    return {
      id: item?.id || `edu_${opts.resumeId}_${index}`,
      school: title,
      major: subtitle,
      degree,
      startDate: range.startDate,
      endDate: range.endDate,
      description: listToHtml(details),
      visible: true,
    };
  });

  const experience = workList.map((item: any, index: number) => {
    const company = toText(item?.title || item?.company || item?.organization);
    const position = toText(item?.subtitle || item?.position || item?.role);
    const date = toText(item?.date || item?.duration);
    const highlights = toStringList(item?.highlights || item?.details);
    return {
      id: item?.id || `exp_${opts.resumeId}_${index}`,
      company,
      position,
      date,
      details: listToHtml(highlights),
      visible: true,
      companyLogo: toText(item?.logo) || undefined,
      companyLogoSize:
        typeof item?.logoSize === "number" ? item.logoSize : undefined,
    };
  });

  const projects = projectsRaw.map((item: any, index: number) => {
    const name = toText(item?.title || item?.name);
    const role = toText(item?.subtitle || item?.role);
    const date = toText(item?.date);
    const highlights = toStringList(item?.highlights);
    const description = toText(item?.description);
    const htmlParts = [
      description ? `<p>${description}</p>` : "",
      highlights.length ? listToHtml(highlights) : "",
    ].filter(Boolean);
    return {
      id: item?.id || `proj_${opts.resumeId}_${index}`,
      name,
      role,
      date,
      description: htmlParts.join(""),
      visible: true,
      link: toText(item?.link || item?.repoUrl || item?.repo) || undefined,
    };
  });

  const openSource = openSourceRaw.map((item: any, index: number) => {
    const repoItems = toStringList(item?.items || item?.highlights);
    const baseDescription = toText(item?.description);
    const description = [
      baseDescription ? `<p>${baseDescription}</p>` : "",
      repoItems.length ? listToHtml(repoItems) : "",
    ]
      .filter(Boolean)
      .join("");
    return {
      id: item?.id || `os_${opts.resumeId}_${index}`,
      name: toText(item?.title || item?.name),
      repo: toText(item?.repoUrl || item?.repo) || undefined,
      role: toText(item?.subtitle || item?.role) || undefined,
      date: toText(item?.date) || undefined,
      description,
      visible: true,
    };
  });

  const awards = awardsRaw.map((item: any, index: number) => {
    if (typeof item === "string") {
      return {
        id: `award_${opts.resumeId}_${index}`,
        title: item,
        issuer: "",
        date: "",
        description: "",
        visible: true,
      };
    }
    return {
      id: item?.id || `award_${opts.resumeId}_${index}`,
      title: toText(item?.title || item?.name),
      issuer: toText(item?.issuer || item?.organization),
      date: toText(item?.date),
      description: toText(item?.description),
      visible: true,
    };
  });

  const skillContentFromArray = skillsRaw
    .map((item: any) => {
      if (typeof item === "string") return `<p>${item}</p>`;
      const category = toText(item?.category || item?.name);
      const details = toText(item?.details || item?.description);
      if (category && details)
        return `<p><strong>${category}：</strong>${details}</p>`;
      if (details) return `<p>${details}</p>`;
      if (category) return `<p>${category}</p>`;
      return "";
    })
    .filter(Boolean)
    .join("");

  return {
    id: opts.resumeId,
    title: opts.title,
    createdAt: toText(source.createdAt) || now,
    updatedAt: now,
    templateId: null,
    templateType: "latex",
    basic: {
      name: toText(source.name),
      title: toText(source.objective || source.summary),
      email: toText(contact.email),
      phone: toText(contact.phone),
      location: toText(contact.location),
    },
    education,
    experience,
    projects,
    openSource,
    awards,
    customData: {},
    skillContent:
      toText(source.skillContent) ||
      toText(source.skills) ||
      skillContentFromArray,
    activeSection: "basic",
    draggingProjectId: null,
    menuSections: DEFAULT_MENU_SECTIONS.map((section, index) => ({
      ...section,
      order: index,
    })),
    globalSettings: {},
  };
}

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

interface ResumeStructuredData {
  type: "resume" | "resume_selector";
  resume_id?: string;
  user_id?: string;
  name?: string;
  resume_data?: ResumeData;
  required?: boolean;
  message?: string;
  source?: string;
  trigger?: string;
  intent_source?: string;
}

interface ResumeEditDiffStructuredData {
  type: "resume_edit_diff";
  section: "basic" | "internships" | string;
  field: string;
  index?: number;
  before: string;
  after: string;
  patch?: {
    path?: string;
    action?: string;
    value?: unknown;
  };
}

// ============================================================================
// 主页面组件
// ============================================================================

export default function SophiaChat() {
  if (!isAgentEnabled()) {
    return null;
  }
  return <SophiaChatContent />;
}

function SophiaChatContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const { user } = useAuth();
  const { apiBaseUrl } = useEnvironment();
  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => {
    const token = localStorage.getItem("auth_token");
    return token
      ? { ...extra, Authorization: `Bearer ${token}` }
      : { ...extra };
  }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [initialSessionResolved, setInitialSessionResolved] = useState(false);
  const [isLoadingResume, setIsLoadingResume] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const [conversationId, setConversationId] = useState(() => {
    // 优先从 URL 恢复会话ID；否则先给一个临时ID，后续会在初始化阶段替换为"最新会话"
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("sessionId");
      if (sessionId && sessionId.trim() !== "") {
        return sessionId;
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
  const [allowPdfAutoRender, setAllowPdfAutoRender] = useState(false);
  const [resumePdfPreview, setResumePdfPreview] = useState<
    Record<string, ResumePdfPreviewState>
  >({});

  // 搜索结果相关状态
  const [searchResults, setSearchResults] = useState<
    Array<{ messageId: string; data: SearchStructuredData }>
  >([]);
  const [activeSearchPanel, setActiveSearchPanel] =
    useState<SearchStructuredData | null>(null);

  // 🔧 自动同步选中的简历数据到全局 resumeData，确保右侧 PDF 渲染（用于恢复持久化状态）
  useEffect(() => {
    if (selectedResumeId) {
      const loaded = loadedResumes.find((r) => r.id === selectedResumeId);
      if (loaded?.resumeData) {
        setResumeData(loaded.resumeData);
      }
    } else if (!selectedReportId) {
      // 仅在没有报告时才清除简历数据，避免预览冲突
      setResumeData(null);
    }
  }, [selectedResumeId, loadedResumes, selectedReportId]);

  // 报告流式输出相关状态
  const [shouldHideResponseInChat, setShouldHideResponseInChat] =
    useState(false);
  const [streamingReportId, setStreamingReportId] = useState<string | null>(
    null,
  );
  const [streamingReportContent, setStreamingReportContent] =
    useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 语音输入
  const {
    isRecording: isVoiceRecording,
    isSpeaking: isVoiceSpeaking,
    isProcessing: isVoiceProcessing,
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
  } = useSpeechRecognition({
    onTextChange: (text, isFinal) => {
      if (isFinal) {
        setInput((prev) => (prev ? `${prev} ${text}` : text));
      }
    },
  });

  // 初始化会话：有 sessionId 用指定会话；否则默认加载“最新会话”
  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(location.search);
    const explicitSessionId = params.get("sessionId");
    const hasExplicitId = !!explicitSessionId?.trim();
    const token = localStorage.getItem("auth_token");

    if (hasExplicitId) {
      // URL 显式指定会话时，不做额外探测
      const sid = explicitSessionId!.trim();
      if (conversationId !== sid) {
        setConversationId(sid);
      }
      setInitialSessionResolved(true);
      return () => {
        mounted = false;
      };
    }

    if (!token) {
      // 未登录时不请求历史会话，直接进入新会话状态
      setInitialSessionResolved(true);
      return () => {
        mounted = false;
      };
    }

    const bootstrapLatestSession = async () => {
      try {
        const resp = await fetch(
          `${apiBaseUrl}/api/agent/history/sessions/list?page=1&page_size=1`,
          {
            headers: getAuthHeaders(),
          },
        );
        if (!mounted) return;
        if (resp.status === 401) {
          // token 失效或登录态未就绪：保持新会话，不报错
          return;
        }
        if (resp.ok) {
          const data = await resp.json();
          const latest = Array.isArray(data?.sessions)
            ? data.sessions[0]
            : null;
          const latestId =
            typeof latest?.session_id === "string" ? latest.session_id : "";
          if (latestId) {
            setConversationId(latestId);
            navigate(`/agent/new?sessionId=${latestId}`, { replace: true });
          }
        }
      } catch (error) {
        console.error("[AgentChat] Failed to bootstrap latest session:", error);
      } finally {
        if (mounted) {
          setInitialSessionResolved(true);
        }
      }
    };

    void bootstrapLatestSession();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, getAuthHeaders, navigate, location.search, conversationId]);

  // 简历选择器状态
  const [showResumeSelector, setShowResumeSelector] = useState(false);
  const [pendingResumeInput, setPendingResumeInput] = useState<string>(""); // 暂存用户输入，选择简历后继续处理

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const autoScrollTimerRef = useRef<number | null>(null);
  const isFinalizedRef = useRef(false);
  const currentThoughtRef = useRef("");
  const currentAnswerRef = useRef("");
  const lastCompletedRef = useRef<{
    thought: string;
    answer: string;
    at: number;
  } | null>(null);
  const lastHandledAnswerCompleteRef = useRef(0);
  const pendingFinalizeAfterTypewriterRef = useRef(false);
  const finalizeRetryTimerRef = useRef<number | null>(null);
  const finalizeRetryAttemptsRef = useRef(0);
  const prevRouteSessionIdRef = useRef<string | null>(null);
  const handledResumeSelectorToolCallsRef = useRef<Set<string>>(new Set());
  const handledEditToolCallsRef = useRef<Set<string>>(new Set());
  
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
  const isResumePreviewActive = Boolean(selectedResumeId && !selectedReportId);

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
      console.log(
        "[DEBUG] renderResumePdfPreview called for:",
        resumeEntry.id,
        "force:",
        force,
        "stack:",
        new Error().stack?.split("\n").slice(2, 5).join(" <- "),
      );
      if (!resumeEntry.resumeData) return;

      const currentState = resumePdfPreview[resumeEntry.id];
      if (!force && (currentState?.loading || currentState?.blob)) {
        console.log(
          "[DEBUG] renderResumePdfPreview skipped (already loading or has blob)",
        );
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
        const renderSessionId = currentSessionId || conversationId;
        const traceId = `sophia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        console.log("[PDF TRACE] 准备渲染PDF", {
          traceId,
          sessionId: renderSessionId,
          resumeId: resumeEntry.id,
          force,
          selectedResumeId,
          selectedReportId,
          allowPdfAutoRender,
        });
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
          {
            sessionId: renderSessionId,
            resumeId: resumeEntry.id,
            traceId,
            source: "SophiaChat.renderResumePdfPreview",
            trigger: force ? "manual-retry" : "auto-effect",
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
    [
      resumePdfPreview,
      updateResumePdfState,
      currentSessionId,
      conversationId,
      selectedResumeId,
      selectedReportId,
      allowPdfAutoRender,
    ],
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

  const upsertLoadedResume = useCallback(
    (messageId: string, payload: ResumeStructuredData) => {
      const resumeData = payload.resume_data;
      if (!resumeData) return;

      const rawId = payload.resume_id;
      const resumeId =
        typeof rawId === "string" && rawId.trim().length > 0
          ? rawId
          : `resume-${Date.now()}`;
      const resumeName =
        typeof payload.name === "string" && payload.name.trim().length > 0
          ? payload.name
          : "我的简历";

      setLoadedResumes((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.messageId === messageId,
        );
        const entry = {
          id: resumeId,
          name: resumeName,
          messageId,
          resumeData,
        };
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = entry;
          return updated;
        }
        return [...prev, entry];
      });
    },
    [],
  );

  const applyResumeEditDiff = useCallback(
    (diff: ResumeEditDiffStructuredData) => {
      const patchPath = diff.patch?.path || "";
      const patchValue = diff.patch?.value;
      if (diff.patch?.action !== "update" || !patchPath) return;

      const patchResume = (source: ResumeData): ResumeData => {
        const next = structuredClone(source);
        if (patchPath === "basic.name") {
          next.basic = { ...next.basic, name: String(patchValue ?? "") };
          return next;
        }

        const experienceMatch = patchPath.match(/^experience\[(\d+)\]\.company$/);
        if (experienceMatch) {
          const index = Number(experienceMatch[1]);
          if (Array.isArray(next.experience) && index >= 0 && index < next.experience.length) {
            const target = next.experience[index];
            next.experience[index] = {
              ...target,
              company: String(patchValue ?? ""),
            };
          }
          return next;
        }

        const internshipMatch = patchPath.match(/^internships\[(\d+)\]\.company$/);
        if (internshipMatch) {
          const index = Number(internshipMatch[1]);
          if (Array.isArray(next.experience) && index >= 0 && index < next.experience.length) {
            const target = next.experience[index];
            next.experience[index] = {
              ...target,
              company: String(patchValue ?? ""),
            };
          }
        }

        return next;
      };

      setLoadedResumes((prev) => {
        if (prev.length === 0) return prev;
        const targetId = selectedResumeId || prev[0]?.id;
        if (!targetId) return prev;
        return prev.map((item) => {
          if (item.id !== targetId || !item.resumeData) return item;
          return { ...item, resumeData: patchResume(item.resumeData) };
        });
      });

      setResumeData((prev) => (prev ? patchResume(prev) : prev));
      setResumePdfPreview((prev) => {
        const targetId = selectedResumeId || Object.keys(prev)[0];
        if (!targetId) return prev;
        return {
          ...prev,
          [targetId]: {
            ...(prev[targetId] || EMPTY_RESUME_PDF_STATE),
            blob: null,
            loading: false,
            progress: "",
            error: null,
          },
        };
      });
      setResumeError(null);
      setAllowPdfAutoRender(true);
    },
    [selectedResumeId],
  );

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type === "error") {
        const message =
          event.data?.content ||
          event.data?.error_details ||
          "流式请求失败，请稍后重试。";
        setResumeError(String(message));
        return;
      }
      if (event.type !== "tool_result") return;
      const toolName = event.data?.tool;
      const structured = event.data?.structured_data;
      const toolCallId =
        (event.data?.tool_call_id as string | undefined) ||
        `fallback-${String(event.data?.content || JSON.stringify(event.data || {}))}`;

      if (toolName === "show_resume" && (!structured || typeof structured !== "object")) {
        if (!handledResumeSelectorToolCallsRef.current.has(toolCallId)) {
          handledResumeSelectorToolCallsRef.current.add(toolCallId);
          console.warn(
            "[AgentChat] show_resume missing structured_data, fallback to resume selector",
            event.data,
          );
          setResumeError(null);
          setShowResumeSelector(true);
        }
        return;
      }
      if (!structured || typeof structured !== "object") return;

      if (toolName === "web_search") {
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
        return;
      }

      if (toolName === "show_resume") {
        const resumePayload = structured as ResumeStructuredData;
        if (resumePayload.type === "resume_selector") {
          if (handledResumeSelectorToolCallsRef.current.has(toolCallId)) {
            return;
          }
          handledResumeSelectorToolCallsRef.current.add(toolCallId);
          setResumeError(null);
          setShowResumeSelector(true);
          return;
        }
        upsertLoadedResume("current", resumePayload);
        return;
      }

      if (toolName === "cv_editor_agent") {
        const editPayload = structured as ResumeEditDiffStructuredData;
        if (editPayload.type === "resume_edit_diff") {
          handledEditToolCallsRef.current.add(toolCallId);
          applyResumeEditDiff(editPayload);
        }
      }
    },
    [upsertSearchResult, upsertLoadedResume, applyResumeEditDiff],
  );

  useEffect(() => {
    handledResumeSelectorToolCallsRef.current.clear();
    handledEditToolCallsRef.current.clear();
  }, [conversationId]);

  const {
    currentThought,
    currentAnswer,
    isProcessing,
    isConnected,
    lastError,
    answerCompleteCount,
    sendMessage,
    finalizeStream,
  } = useCLTP({
    conversationId,
    baseUrl: apiBaseUrl,
    heartbeatTimeout: SSE_HEARTBEAT_TIMEOUT,
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

  // 🔧 持久化 UI 预览状态（简历、报告等）
  useEffect(() => {
    // 仅针对已保存的真实会话进行持久化
    if (!conversationId || conversationId.startsWith("conv-")) return;

    const uiState = {
      selectedResumeId,
      selectedReportId,
      // 仅存元数据，避免 localStorage 过大
      loadedResumes: loadedResumes.map((r) => ({
        id: r.id,
        name: r.name,
        messageId: r.messageId,
        resumeData: r.resumeData, // 这里的简历数据是必需的，用于右侧 PDF 预览渲染
      })),
    };
    localStorage.setItem(`ui_state:${conversationId}`, JSON.stringify(uiState));
  }, [conversationId, selectedResumeId, selectedReportId, loadedResumes]);

  // 说明：
  // 进入 AI 页面时，conversationId 只允许由两处决定：
  // 1) URL 中的 sessionId
  // 2) 初始化时探测到的“最新会话”
  // 这里明确不再使用 resumeId 覆盖 conversationId，避免初始化阶段发生会话抖动。

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
    if (!allowPdfAutoRender) return;
    if (!selectedLoadedResume) return;
    if (selectedReportId) return;
    void renderResumePdfPreview(selectedLoadedResume);
  }, [
    selectedLoadedResume,
    selectedReportId,
    renderResumePdfPreview,
    allowPdfAutoRender,
  ]);

  // 会话ID确定后，仅加载“当前选中会话”的消息内容
  useEffect(() => {
    // 等待初始化阶段确定最终会话ID后再加载
    if (!initialSessionResolved) {
      return;
    }

    const routeSessionId =
      new URLSearchParams(location.search).get("sessionId")?.trim() || null;
    const isEphemeralConversation =
      !routeSessionId && conversationId.startsWith("conv-");

    // /agent/new 的本地临时会话不走后端加载，避免 404 Session not found
    if (isEphemeralConversation) {
      if (currentSessionId !== conversationId) {
        setCurrentSessionId(conversationId);
      }
      setResumeError(null);
      return;
    }

    // 如果已经加载了当前会话ID，不重复加载
    if (currentSessionId === conversationId) {
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
          `${apiBaseUrl}/api/agent/history/sessions/${conversationId}`,
          {
            headers: getAuthHeaders(),
          },
        );
        if (!mounted) return;
        if (!resp.ok) {
          let detail = `HTTP ${resp.status} ${resp.statusText}`;
          try {
            const errData = await resp.clone().json();
            if (errData?.detail?.message) {
              detail = errData.detail.message;
            } else if (typeof errData?.detail === "string") {
              detail = errData.detail;
            } else if (errData?.error_message) {
              detail = errData.error_message;
            }
          } catch {
            // ignore json parse errors
          }
          // 会话不存在，使用新的会话ID
          console.log(
            `[AgentChat] Session ${conversationId} load failed: ${detail}`,
          );
          setResumeError(`会话加载失败：${detail}`);
          return;
        }
        const data = await resp.json();
        setResumeError(null);

        // 🔧 恢复 UI 数据（包含右侧选中态），避免“展示简历后又自动消失”。
        try {
          const savedUiState = localStorage.getItem(
            `ui_state:${conversationId}`,
          );
          if (savedUiState) {
            const {
              loadedResumes: sLrs,
              selectedResumeId: savedSelectedResumeId,
              selectedReportId: savedSelectedReportId,
            } = JSON.parse(savedUiState);
            // 恢复已加载列表的元数据，数据会在后续逻辑中通过消息或重新加载补齐
            if (Array.isArray(sLrs) && sLrs.length > 0) {
              setLoadedResumes(sLrs);
            }
            if (
              typeof savedSelectedResumeId === "string" &&
              savedSelectedResumeId.trim() !== ""
            ) {
              setSelectedResumeId(savedSelectedResumeId);
              setSelectedReportId(null);
              setAllowPdfAutoRender(true);
            } else if (
              typeof savedSelectedReportId === "string" &&
              savedSelectedReportId.trim() !== ""
            ) {
              setSelectedReportId(savedSelectedReportId);
              setSelectedResumeId(null);
              setAllowPdfAutoRender(false);
            } else {
              setSelectedResumeId(null);
              setSelectedReportId(null);
              setAllowPdfAutoRender(false);
            }
          }
        } catch (e) {
          console.warn("[AgentChat] Failed to restore UI state:", e);
        }

        // 🔧 改进：使用内容哈希生成稳定的消息 ID
        const generateMessageId = (
          content: string,
          role: string,
          index: number,
        ): string => {
          // 简单的字符串哈希函数（FNV-1a 变体）
          let hash = 2166136261;
          const str = `${role}:${content}:${index}`;
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
          (m: any, index: number) => ({
            id: generateMessageId(m.content || "", m.role || "unknown", index),
            role: m.role === "user" ? "user" : "assistant",
            content: m.content || "",
            thought: m.thought || undefined,
            timestamp: new Date().toISOString(),
          }),
        );

        const dedupedMessages = dedupeLoadedMessages(loadedMessages);
        if (!mounted) return;
        setMessages(dedupedMessages);
        setCurrentSessionId(conversationId);
        lastPersistedCountBySessionRef.current[conversationId] =
          typeof data?.total === "number"
            ? data.total
            : dedupedMessages.length;
        console.log(
          `[AgentChat] Auto-loaded session ${conversationId} with ${dedupedMessages.length} messages`,
        );
      } catch (error) {
        console.error("[AgentChat] Failed to auto-load session:", error);
      }
    };

    autoLoadSession();
    return () => {
      mounted = false;
    };
  }, [conversationId, currentSessionId, initialSessionResolved, apiBaseUrl, getAuthHeaders, location.search]); // 仅在会话确定后加载

  useEffect(() => {
    if (!lastError) return;
    setResumeError(lastError);
  }, [lastError]);

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
          await fetch(`${apiBaseUrl}/api/documents/${report.main_id}/content`, {
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
    apiBaseUrl,
  ]);

  // Auto-scroll to bottom (throttled to reduce layout thrash during streaming)
  useEffect(() => {
    if (autoScrollTimerRef.current !== null) {
      window.clearTimeout(autoScrollTimerRef.current);
    }
    autoScrollTimerRef.current = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: isProcessing ? "auto" : "smooth",
        block: "end",
      });
      autoScrollTimerRef.current = null;
    }, isProcessing ? 90 : 140);
  }, [messages, currentThought, currentAnswer, isProcessing]);

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current !== null) {
        window.clearTimeout(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, []);

  // 打开“展示简历”卡片或切换其步骤时，确保卡片完整进入可视区域，避免被输入区遮挡。
  useEffect(() => {
    if (!showResumeSelector) return;
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showResumeSelector]);

  useEffect(() => {
    currentThoughtRef.current = currentThought;
  }, [currentThought]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
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
            await fetch(`${apiBaseUrl}/api/documents/${result.mainId}/content`, {
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
    [generatedReports, apiBaseUrl],
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
      if (isProcessing) {
        console.warn("[AgentChat] finalizeMessage called with NO content while still processing. This might be a race condition.");
      }
      console.log("[AgentChat] No content to finalize, just resetting state");
      finalizeStream();
      setTimeout(() => {
        isFinalizedRef.current = false;
      }, 100);
      return;
    }

    refreshAfterSaveRef.current = true;
    pendingSaveRef.current = true;
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
    setLoadedResumes((prev) =>
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
                `${apiBaseUrl}/api/documents/${report.main_id}/content`,
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

    // Clear transient stream buffers only after message finalization work has been enqueued.
    finalizeStream();
  }, [
    finalizeStream,
    currentAnswer,
    currentThought,
    detectAndCreateReport,
    shouldHideResponseInChat,
    streamingReportId,
    apiBaseUrl,
  ]);

  const finalizeAfterTypewriter = useCallback(() => {
    if (!pendingFinalizeAfterTypewriterRef.current) {
      return;
    }

    pendingFinalizeAfterTypewriterRef.current = false;

    if (finalizeRetryTimerRef.current !== null) {
      window.clearTimeout(finalizeRetryTimerRef.current);
      finalizeRetryTimerRef.current = null;
    }

    finalizeMessage();

    window.setTimeout(() => {
      isFinalizedRef.current = false;
    }, 150);
  }, [finalizeMessage]);

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
            alias: resume.alias,
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
      // 如果消息列表为空，则不执行持久化，避免在数据库中产生空会话
      if (!messagesToSave || messagesToSave.length === 0) {
        return;
      }

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
      const clientSaveSeq = ++saveClientSeqRef.current;
      const lastMessageHash = computeLastMessageHash(messagesToSave);

      if (saveInFlightRef.current) {
        queuedSaveRef.current = {
          sessionId: validSessionId,
          messages: messagesToSave,
          shouldRefresh,
        };
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
              lastPersistedCountBySessionRef.current[validSessionId] =
                messagesToSave.length;
            }
            return resp;
          };

          let resp: Response;
          const knownPersistedCount =
            lastPersistedCountBySessionRef.current[validSessionId] ?? 0;
          const appendDisabled =
            appendDisabledBySessionRef.current[validSessionId] === true;
          const canTryAppend =
            HISTORY_APPEND_MODE &&
            !appendDisabled &&
            knownPersistedCount > 0 &&
            knownPersistedCount <= messagesToSave.length;

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

            // base_seq 冲突时自动回退到 full snapshot save
            if (resp.status === 409) {
              appendDisabledBySessionRef.current[validSessionId] = true;
              resp = await fullSave();
            } else if (resp.ok) {
              const body = await resp
                .clone()
                .json()
                .catch(() => null as any);
              if (typeof body?.new_seq === "number") {
                lastPersistedCountBySessionRef.current[validSessionId] =
                  body.new_seq;
              } else {
                lastPersistedCountBySessionRef.current[validSessionId] =
                  messagesToSave.length;
              }
            }
          } else {
            resp = await fullSave();
          }

          if (!resp.ok) {
            console.error(`[AgentChat] Failed to save session: ${resp.status}`);
            const retryCount = (saveRetryRef.current[payloadKey] || 0) + 1;
            if (retryCount <= 2) {
              saveRetryRef.current[payloadKey] = retryCount;
              queuedSaveRef.current = {
                sessionId: validSessionId,
                messages: messagesToSave,
                shouldRefresh,
              };
              setTimeout(() => {
                if (!saveInFlightRef.current && queuedSaveRef.current) {
                  const next = queuedSaveRef.current;
                  queuedSaveRef.current = null;
                  void persistSessionSnapshot(
                    next.sessionId,
                    next.messages,
                    next.shouldRefresh,
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
              shouldRefresh,
            };
            setTimeout(() => {
              if (!saveInFlightRef.current && queuedSaveRef.current) {
                const next = queuedSaveRef.current;
                queuedSaveRef.current = null;
                void persistSessionSnapshot(
                  next.sessionId,
                  next.messages,
                  next.shouldRefresh,
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
              next.shouldRefresh,
            );
          }
        }
      })();
      await saveInFlightRef.current;
    },
    [
      conversationId,
      buildSavePayload,
      computeLastMessageHash,
      getAuthHeaders,
      refreshSessions,
    ],
  );

  const schedulePersistSessionSnapshot = useCallback(
    (sessionId: string, messagesToSave: Message[], shouldRefresh = false) => {
      if (!sessionId || sessionId.trim() === "" || messagesToSave.length === 0) {
        return;
      }

      const existing = scheduledSaveRef.current;
      scheduledSaveRef.current = {
        sessionId,
        messages: messagesToSave,
        shouldRefresh: shouldRefresh || Boolean(existing?.shouldRefresh),
      };

      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
      saveDebounceTimerRef.current = setTimeout(() => {
        const pending = scheduledSaveRef.current;
        scheduledSaveRef.current = null;
        saveDebounceTimerRef.current = null;
        if (!pending) return;
        void persistSessionSnapshot(
          pending.sessionId,
          pending.messages,
          pending.shouldRefresh,
        );
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
      await persistSessionSnapshot(
        pending.sessionId,
        pending.messages,
        pending.shouldRefresh,
      );
    }
  }, [persistSessionSnapshot]);

  const waitForPendingSave = useCallback(async () => {
    await flushScheduledSave();
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (pendingSaveRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (saveInFlightRef.current) {
        await saveInFlightRef.current;
      }
    }
  }, [flushScheduledSave]);

  useEffect(() => {
    if (!pendingSaveRef.current) {
      return;
    }
    pendingSaveRef.current = false;
    const shouldRefresh = refreshAfterSaveRef.current;
    refreshAfterSaveRef.current = false;
    // 验证 conversationId 不为空且消息不为空
    if (conversationId && conversationId.trim() !== "" && messages.length > 0) {
      schedulePersistSessionSnapshot(conversationId, messages, shouldRefresh);
    } else {
      console.log(
        "[AgentChat] Skipping save: conversationId is empty or no messages",
      );
    }
  }, [conversationId, messages, schedulePersistSessionSnapshot]);

  const saveCurrentSession = useCallback(() => {
    if (isProcessing || currentThoughtRef.current || currentAnswerRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    // 只有当有消息时才标记需要保存
    if (messages && messages.length > 0) {
      pendingSaveRef.current = true;
      void persistSessionSnapshot(conversationId, messages);
    }
  }, [
    conversationId,
    finalizeMessage,
    isProcessing,
    messages,
    persistSessionSnapshot,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const pending = scheduledSaveRef.current;
      if (!pending) return;
      void persistSessionSnapshot(
        pending.sessionId,
        pending.messages,
        pending.shouldRefresh,
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
      }
    };
  }, [persistSessionSnapshot]);

  const deleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(
        `${apiBaseUrl}/api/agent/history/${sessionId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);

      // Clear active session memory on backend
      fetch(`${apiBaseUrl}/api/agent/stream/session/${sessionId}`, {
        method: "DELETE",
      }).catch(() => undefined);

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

      // 用户多次发送相同文本属于正常行为，不能在加载时去重。
      if (roleKey === "user") {
        deduped.push(msg);
        continue;
      }

      // 仅在 assistant 消息中进行扩展去重逻辑，避免误伤 user 消息
      let cleanContent = contentKey;
      if (roleKey === "assistant" && contentKey.includes("Response:")) {
        cleanContent =
          contentKey.split("Response:").pop()?.trim() || contentKey;
      }

      // 检查是否已存在相同或相似的内容（assistant）
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
        `${apiBaseUrl}/api/agent/history/sessions/${sessionId}/title`,
        {
          method: "PUT",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ title: trimmedTitle }),
        },
      );
      refreshSessions();
    } catch (error) {
      console.error("[AgentChat] Failed to rename session:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (isLoadingChat) {
      return;
    }
    if (sessionId === currentSessionId) {
      return;
    }
    setIsLoadingSession(true);
    // 先保存当前会话，确保未完成的内容被保存
    saveCurrentSession();
    await waitForPendingSave();

    // 确保切换会话前清除任何待保存标记，防止将新加载的消息误存回服务器
    pendingSaveRef.current = false;

    // 切换会话时先清理右侧和会话关联状态，避免旧会话数据串到新会话
    setSelectedResumeId(null);
    setSelectedReportId(null);
    setAllowPdfAutoRender(false);
    setLoadedResumes([]);
    setGeneratedReports([]);
    setSearchResults([]);
    setActiveSearchPanel(null);
    setResumePdfPreview({});
    setReportContent("");
    setReportTitle("");

    try {
      const resp = await fetch(
        `${apiBaseUrl}/api/agent/history/sessions/${sessionId}`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!resp.ok) {
        let detail = `HTTP ${resp.status} ${resp.statusText}`;
        try {
          const errData = await resp.clone().json();
          if (errData?.detail?.message) {
            detail = errData.detail.message;
          } else if (typeof errData?.detail === "string") {
            detail = errData.detail;
          } else if (errData?.error_message) {
            detail = errData.error_message;
          }
        } catch {
          // ignore json parse errors
        }
        console.error(
          `[AgentChat] Failed to load session: ${detail}`,
        );
        setResumeError(`会话加载失败：${detail}`);
        // 如果加载失败，不清空当前消息，保持原状态
        return;
      }

      const data = await resp.json();
      setResumeError(null);

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

      // 恢复会话级 UI 状态（包含右侧选中态）
      try {
        const savedUiState = localStorage.getItem(`ui_state:${sessionId}`);
        if (savedUiState) {
          const {
            loadedResumes: sLrs,
            selectedResumeId: savedSelectedResumeId,
            selectedReportId: savedSelectedReportId,
          } = JSON.parse(savedUiState);
          if (Array.isArray(sLrs) && sLrs.length > 0) {
            setLoadedResumes(sLrs);
          }
          if (
            typeof savedSelectedResumeId === "string" &&
            savedSelectedResumeId.trim() !== ""
          ) {
            setSelectedResumeId(savedSelectedResumeId);
            setSelectedReportId(null);
            setAllowPdfAutoRender(true);
          } else if (
            typeof savedSelectedReportId === "string" &&
            savedSelectedReportId.trim() !== ""
          ) {
            setSelectedReportId(savedSelectedReportId);
            setSelectedResumeId(null);
            setAllowPdfAutoRender(false);
          }
        }
      } catch (e) {
        console.warn("[AgentChat] Failed to restore session ui data:", e);
      }

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
        lastPersistedCountBySessionRef.current[sessionId] =
          typeof data?.total === "number"
            ? data.total
            : dedupedMessages.length;
        setAllowPdfAutoRender(false);
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

    // 确保切换会话前清除任何待保存标记
    pendingSaveRef.current = false;

    const newId = `conv-${Date.now()}`;
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    lastPersistedCountBySessionRef.current[newId] = 0;
    setSelectedResumeId(null);
    setSelectedReportId(null);
    setAllowPdfAutoRender(false);
    finalizeStream();

    // 不再立即持久化空会话，只在用户发送第一条消息时才真正创建并入库
    // 这样可以避免用户点击+按钮后没有输入消息就产生空会话
  }, [finalizeStream, saveCurrentSession, waitForPendingSave]);

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

  // 监听 URL sessionId 变化并同步会话：
  // - 有 sessionId: 加载该历史会话
  // - 从有 sessionId 切换到无 sessionId（点击左侧 +）: 创建新会话
  useEffect(() => {
    const routeSessionId =
      new URLSearchParams(location.search).get("sessionId")?.trim() || null;
    const previousRouteSessionId = prevRouteSessionIdRef.current;
    prevRouteSessionIdRef.current = routeSessionId;

    if (routeSessionId) {
      if (routeSessionId === currentSessionId) return;
      if (isLoadingSession) return;
      void loadSession(routeSessionId);
      return;
    }

    // 从历史会话URL切回 /agent/new（无 sessionId）时，主动创建空白新会话
    if (previousRouteSessionId && !isLoadingSession) {
      void createNewSession();
    }
  }, [
    location.search,
    currentSessionId,
    isLoadingSession,
    loadSession,
    createNewSession,
  ]);

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
        alias: selectedResume.alias,
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
      setAllowPdfAutoRender(true);
      setSelectedResumeId(selectedResume.id);
      setSelectedReportId(null);

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
    async (
      userMessage: string,
      attachments?: File[],
      resumeDataOverride?: ResumeData | null,
    ) => {
      if (
        (!userMessage.trim() && (!attachments || attachments.length === 0)) ||
        isProcessing
      )
        return;

      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 处理附件元数据
      const attachmentMeta = attachments?.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }));

      const userMessageEntry: Message = {
        id: uniqueId,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
        attachments: attachmentMeta,
      };
      const nextMessages = [...messages, userMessageEntry];
      const isFirstMessage = messages.length === 0;

      setMessages(nextMessages);
      if (isFirstMessage) {
        // 保持当前会话，不创建新的 conversationId
        // 只有当确实没有 conversationId 时才创建新的
        let validConversationId = conversationId;
        if (!validConversationId || validConversationId.trim() === "") {
          validConversationId = `conv-${Date.now()}`;
          setConversationId(validConversationId);
        }
        if (!currentSessionId) {
          setCurrentSessionId(validConversationId);
        }
        // 持久化并刷新会话列表（确保新会话在侧边栏显示）
        // 只有在发送第一条消息时才设置 shouldRefresh 为 true，从而触发侧边栏更新
        await persistSessionSnapshot(validConversationId, nextMessages, true);
      }

      isFinalizedRef.current = false;
      setSearchResults((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );

      await sendMessage(userMessage, resumeDataOverride);
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
    pendingFinalizeAfterTypewriterRef.current = true;

    const currentAnswerValue = currentAnswerRef.current.trim() || currentAnswer.trim();
    const currentThoughtValue = currentThoughtRef.current.trim() || currentThought.trim();
    const hasAnyContent = currentAnswerValue || currentThoughtValue;

    if (hasAnyContent) {
      lastCompletedRef.current = {
        thought: currentThoughtValue,
        answer: currentAnswerValue,
        at: Date.now(),
      };
    }

    // Fallback: if打字机回调没有触发（例如空回答），短延时后兜底完成。
    if (finalizeRetryTimerRef.current !== null) {
      window.clearTimeout(finalizeRetryTimerRef.current);
    }
    finalizeRetryAttemptsRef.current = 0;
    finalizeRetryTimerRef.current = window.setTimeout(() => {
      if (!pendingFinalizeAfterTypewriterRef.current) {
        finalizeRetryTimerRef.current = null;
        return;
      }

      const fallbackAnswer = currentAnswerRef.current.trim() || currentAnswer.trim();
      const fallbackThought = currentThoughtRef.current.trim() || currentThought.trim();
      if (fallbackAnswer || fallbackThought) {
        finalizeAfterTypewriter();
      } else {
        finalizeRetryAttemptsRef.current += 1;
        if (finalizeRetryAttemptsRef.current <= 5) {
          finalizeRetryTimerRef.current = window.setTimeout(() => {
            if (!pendingFinalizeAfterTypewriterRef.current) {
              finalizeRetryTimerRef.current = null;
              return;
            }
            const retryAnswer =
              currentAnswerRef.current.trim() || currentAnswer.trim();
            const retryThought =
              currentThoughtRef.current.trim() || currentThought.trim();
            if (retryAnswer || retryThought) {
              finalizeAfterTypewriter();
              return;
            }
            if (finalizeRetryAttemptsRef.current >= 5) {
              pendingFinalizeAfterTypewriterRef.current = false;
            }
          }, 220);
          return;
        }
        pendingFinalizeAfterTypewriterRef.current = false;
      }
      finalizeRetryTimerRef.current = null;
    }, 800);
  }, [answerCompleteCount, currentAnswer, currentThought, finalizeAfterTypewriter]);

  useEffect(() => {
    return () => {
      if (finalizeRetryTimerRef.current !== null) {
        window.clearTimeout(finalizeRetryTimerRef.current);
      }
    };
  }, []);

  /**
   * Send message to backend via SSE
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!trimmedInput && !hasAttachments) || isProcessing || isUploadingFile)
      return;

    // 每轮新消息开始前清理可能残留的“隐藏回答”状态，避免普通回答被误隐藏。
    setShouldHideResponseInChat(false);
    setStreamingReportId(null);
    setStreamingReportContent("");

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
      let latestResumeDataForRequest: ResumeData | null = null;

      for (const file of attachmentsToProcess) {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
          const resumeEntryId = `uploaded-pdf-${file.lastModified}-${file.size}`;
          const resumeDisplayName =
            file.name.replace(/\.pdf$/i, "") || "上传简历";
          const uploadMessageId = `upload-pdf-${file.lastModified}-${file.size}`;

          // 1) 先本地预览：不等待后端解析完成
          setLoadedResumes((prev) => {
            const nextEntry = {
              id: resumeEntryId,
              name: resumeDisplayName,
              messageId: uploadMessageId,
            };
            const existingIndex = prev.findIndex(
              (item) => item.id === resumeEntryId,
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                ...nextEntry,
              };
              return updated;
            }
            return [...prev, nextEntry];
          });
          updateResumePdfState(resumeEntryId, {
            blob: file,
            loading: true,
            progress: "已加载原始 PDF，正在解析简历内容...",
            error: null,
          });
          setAllowPdfAutoRender(true);
          setSelectedResumeId(resumeEntryId);
          setSelectedReportId(null);

          // 2) 后台继续上传与结构化解析
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(`${apiBaseUrl}/api/resume/upload-pdf`, {
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
            const canonical = normalizeImportedResumeToCanonical(
              parsedResume as Record<string, any>,
              {
                resumeId: resumeEntryId,
                title: resumeDisplayName,
              },
            );
            const resumeDataWithMeta = {
              ...canonical,
              user_id: resolvedUserId,
              resume_id: resumeEntryId,
              _meta: {
                ...(canonical as any)._meta,
                user_id: resolvedUserId,
                resume_id: resumeEntryId,
              },
            } as ResumeData;
            latestResumeDataForRequest = resumeDataWithMeta;
            setResumeData(resumeDataWithMeta);
            // 上传成功后尝试持久化到简历存储（登录态会入库，未登录回落本地）
            try {
              await saveResume(resumeDataWithMeta, resumeEntryId);
            } catch (saveError) {
              console.warn("[AgentChat] 上传简历保存失败:", saveError);
            }
            setLoadedResumes((prev) => {
              const nextEntry = {
                id: resumeEntryId,
                name: resumeDisplayName,
                messageId: uploadMessageId,
                resumeData: resumeDataWithMeta,
              };
              const existingIndex = prev.findIndex(
                (item) => item.id === resumeEntryId,
              );
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = nextEntry;
                return updated;
              }
              return [...prev, nextEntry];
            });
            updateResumePdfState(resumeEntryId, {
              loading: false,
              progress: "",
              error: null,
            });
            attachmentBlocks.push(
              `已上传并解析 PDF 文件《${file.name}》。请基于这份简历内容进行分析并给出优化建议。`,
            );
          } else {
            updateResumePdfState(resumeEntryId, {
              loading: false,
              progress: "",
              error: "未解析出结构化简历内容，当前展示原始 PDF。",
            });
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
      await sendUserTextMessage(
        finalMessage,
        attachmentsToProcess,
        latestResumeDataForRequest,
      );
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
          {/* Left: Chat */}
          <section className="flex-1 min-w-0 flex flex-col h-full">
            <CustomScrollbar as="main" className="flex-1 px-4 py-8 flex flex-col">
              <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
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

                {messages.length === 0 &&
                  !isProcessing &&
                  !showResumeSelector && (
                    <div className="max-w-2xl mx-auto px-4 transition-all duration-500 ease-in-out flex-1 flex flex-col">
                      {/* 顶部占位，控制下移比例 - 增大比例使内容更靠下 */}
                      <div className="flex-[0.8]" />

                      <div className="text-center mb-12">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                          你好，我是你的 Resume AI 助手
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">
                          我可以帮你优化简历、分析岗位匹配度，或者进行模拟面试。
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                        {[
                          {
                            icon: <Wand2 className="w-5 h-5 text-amber-500" />,
                            title: "简历润色",
                            desc: "“帮我优化这段工作描述，突出我的领导力。”",
                            color: "bg-amber-50 dark:bg-amber-900/20",
                            onClick: () => setShowResumeSelector(true),
                          },
                          {
                            icon: <Search className="w-5 h-5 text-blue-500" />,
                            title: "岗位分析",
                            desc: "“分析这个 JD，看我的简历还需要补充什么？”",
                            color: "bg-blue-50 dark:bg-blue-900/20",
                          },
                          {
                            icon: (
                              <Briefcase className="w-5 h-5 text-emerald-500" />
                            ),
                            title: "模拟面试",
                            desc: "“针对我的简历，问我几个后端开发的技术问题。”",
                            color: "bg-emerald-50 dark:bg-emerald-900/20",
                          },
                          {
                            icon: <Zap className="w-5 h-5 text-indigo-500" />,
                            title: "快速问答",
                            desc: "“如何写出一份让 HR 眼前一亮的简历总结？”",
                            color: "bg-indigo-50 dark:bg-indigo-900/20",
                          },
                        ].map((item, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (item.onClick) {
                                item.onClick();
                              } else {
                                setInput(item.desc.replace(/[“”]/g, ""));
                              }
                            }}
                            className="flex flex-col items-start p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                          >
                            <div
                              className={`p-2 rounded-lg ${item.color} mb-3 group-hover:scale-110 transition-transform`}
                            >
                              {item.icon}
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                              {item.title}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                              {item.desc}
                            </p>
                          </button>
                        ))}
                      </div>
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
                          {/* 显示附件 - 移到文字上方 */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap justify-end gap-2">
                              {msg.attachments.map((file, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 shadow-sm"
                                >
                                  <FileText className="size-4 text-indigo-500" />
                                  <div className="flex flex-col">
                                    <span className="font-medium truncate max-w-[150px]">
                                      {file.name}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      {`${((file.size ?? 0) / 1024).toFixed(1)} KB`}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-800">
                            {
                              msg.content
                                .split("\n\n已上传并解析 PDF 文件")[0]
                                .split("\n\n文件《")[0]
                            }
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
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              setCopiedId(msg.id || String(idx));
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="复制内容"
                          >
                            {copiedId === (msg.id || String(idx)) ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="赞"
                          >
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
                          <button
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="踩"
                          >
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
                          <TTSButton text={msg.content} />
                          <button
                            onClick={() => {
                              // 重新生成逻辑：重新发送上一条用户消息
                              const userMessages = messages.filter(m => m.role === 'user');
                              const lastUserMsg = userMessages[userMessages.length - 1];
                              if (lastUserMsg) {
                                sendUserTextMessage(lastUserMsg.content);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="重新生成"
                          >
                            <RotateCcw className="w-4 h-4" />
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
                              setAllowPdfAutoRender(false);
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
                            subtitle={resumeForMessage.resumeData?.alias || "已加载简历"}
                            onClick={() => {
                              setAllowPdfAutoRender(true);
                              setSelectedResumeId(resumeForMessage.id);
                              setSelectedReportId(null);
                              if (resumeForMessage.resumeData) {
                                setResumeData(resumeForMessage.resumeData);
                              }
                            }}
                            onChangeResume={() => setShowResumeSelector(true)}
                          />
                        </div>
                      )}
                    </Fragment>
                  );
                })}

                {/* 当前正在生成的消息 - 按顺序：Thought Process → SearchCard → Response */}
                <StreamingOutputPanel
                  currentThought={currentThought}
                  currentAnswer={currentAnswer}
                  isProcessing={isProcessing}
                  onResponseTypewriterComplete={finalizeAfterTypewriter}
                  shouldHideResponseInChat={shouldHideResponseInChat}
                  currentSearch={searchResults.find((r) => r.messageId === "current")}
                  renderSearchCard={(searchData) => (
                    <>
                      <SearchCard
                        query={searchData.query}
                        totalResults={searchData.total_results}
                        searchTime={searchData.metadata?.search_time}
                        onOpen={() => setActiveSearchPanel(searchData)}
                      />
                      <SearchSummary
                        query={searchData.query}
                        results={searchData.results}
                        searchTime={searchData.metadata?.search_time}
                      />
                    </>
                  )}
                >
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
                              setAllowPdfAutoRender(false);
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
                </StreamingOutputPanel>

                {/* 简历选择器 */}
                {showResumeSelector && (
                  <ResumeSelector
                    onSelect={handleResumeSelect}
                    onCreateResume={handleCreateResume}
                    onCancel={handleResumeSelectorCancel}
                    onLayoutChange={() => {
                      window.setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "end",
                        });
                      }, 50);
                    }}
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
            </CustomScrollbar>

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
                      className="w-full min-h-[92px] resize-none bg-transparent px-4 pt-3 text-base text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
                    />
                    <div className="flex items-center justify-between px-3 pb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleClickUpload}
                          disabled={isProcessing || isUploadingFile}
                          className={`size-8 rounded-full border flex items-center justify-center transition-colors ${
                            isProcessing || isUploadingFile
                              ? "border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500 cursor-not-allowed"
                              : "border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500"
                          }`}
                          title={isUploadingFile ? "上传中..." : "上传文件"}
                          aria-label="上传文件"
                        >
                          <Plus className="size-4" />
                        </button>

                        {/* 展示简历按钮 */}
                        <button
                          type="button"
                          onClick={() => setShowResumeSelector(true)}
                          disabled={isProcessing}
                          className={`h-8 px-2.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                            isProcessing
                              ? "border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500 cursor-not-allowed"
                              : isResumePreviewActive
                              ? "border-indigo-300 bg-indigo-50 text-indigo-600 shadow-sm dark:border-indigo-500/60 dark:bg-indigo-500/15 dark:text-indigo-300"
                              : "border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500"
                          }`}
                          title="展示简历"
                          aria-label="展示简历"
                        >
                          <FileText className="size-4" />
                          <span className="text-sm font-medium">展示简历</span>
                        </button>
                      </div>
                      {input.trim() || pendingAttachments.length > 0 ? (
                        <button
                          type="submit"
                          disabled={isProcessing || isUploadingFile}
                          className={`size-8 rounded-full flex items-center justify-center transition-colors ${
                            isProcessing || isUploadingFile
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
                      ) : (
                        <button
                          type="button"
                          onClick={
                            isVoiceRecording
                              ? stopVoiceRecording
                              : startVoiceRecording
                          }
                          disabled={isProcessing || isVoiceProcessing}
                          className={`size-8 rounded-full flex items-center justify-center transition-all ${
                            isVoiceRecording
                              ? "bg-red-500 text-white animate-pulse"
                              : isVoiceSpeaking
                              ? "bg-green-500 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          } ${
                            isVoiceProcessing ? "cursor-not-allowed opacity-50" : ""
                          }`}
                          title={
                            isVoiceProcessing
                              ? "识别中..."
                              : isVoiceRecording
                              ? "正在录音，点击停止"
                              : "语音输入"
                          }
                          aria-label="语音输入"
                        >
                          {isVoiceProcessing ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isVoiceRecording ? (
                            <StopCircle className="size-4" />
                          ) : (
                            <Mic className="size-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* Right: Report Preview or Resume Preview - 只格在有选中内容时显示 */}
          {(selectedReportId || selectedResumeId) && (
            <CustomScrollbar as="aside" className="w-[45%] min-w-[420px] bg-slate-50 border-l border-slate-200 flex flex-col">
              <div className="border-b border-slate-200 bg-white px-6 py-4 sticky top-0 z-10 shrink-0">
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
                  <div className="flex items-center gap-2">
                    {selectedResumeId && !selectedReportId && selectedLoadedResume && (
                      <button
                        type="button"
                        onClick={() =>
                          void renderResumePdfPreview(
                            selectedLoadedResume,
                            true,
                          )
                        }
                        disabled={selectedResumePdfState.loading}
                        className="text-xs text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-indigo-50"
                      >
                        重新渲染
                      </button>
                    )}
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
                          setAllowPdfAutoRender(false);
                          setSelectedResumeId(null);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        关闭
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
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
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <CustomScrollbar className="flex-1 bg-slate-100/70 p-4">
                      {!selectedLoadedResume && (
                        <div className="text-sm text-slate-500">
                          正在加载简历...
                        </div>
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
                                void renderResumePdfPreview(
                                  selectedLoadedResume,
                                  true,
                                )
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
                    </CustomScrollbar>
                  </div>
                )}
              </div>
            </CustomScrollbar>
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
