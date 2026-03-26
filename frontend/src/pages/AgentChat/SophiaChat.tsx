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
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import ResumeSelector from "@/components/chat/ResumeSelector";
import SearchResultPanel from "@/components/chat/SearchResultPanel";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useCLTP } from "@/hooks/useCLTP";
import { canUseAgentFeature } from "@/lib/runtimeEnv";
import { PDFViewerSelector } from "@/components/PDFEditor";
import { convertToBackendFormat } from "@/pages/Workspace/v2/utils/convertToBackend";
import {
  DEFAULT_MENU_SECTIONS,
  type ResumeData,
} from "@/pages/Workspace/v2/types";
import type { LoadedResume, ResumePdfPreviewState } from "@/types/resumePreview";
import { getResume, getAllResumes, saveResume } from "@/services/resumeStorage";
import type { SavedResume } from "@/services/storage/StorageAdapter";
import {
  renderPDFStream,
} from "@/services/api";
import { Message } from "@/types/chat";
import type { SSEEvent } from "@/transports/SSETransport";
import {
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
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import EnhancedMarkdown from "@/components/chat/EnhancedMarkdown";
import Composer from "@/components/agent-chat/Composer";
import MessageTimeline from "@/components/agent-chat/MessageTimeline";
import StreamingLane from "@/components/agent-chat/StreamingLane";
import { useTextStream } from "@/hooks/useTextStream";
import { useToolEventRouter } from "@/hooks/agent-chat/useToolEventRouter";
import { useStreamRunController } from "@/hooks/agent-chat/useStreamRunController";
import { useMessageTimeline } from "@/hooks/agent-chat/useMessageTimeline";
import { useAttachmentHandler } from "@/hooks/agent-chat/useAttachmentHandler";
import { useSessionPersistence } from "@/hooks/agent-chat/useSessionPersistence";
import { useResumePreview } from "@/hooks/agent-chat/useResumePreview";
import { useResumeDetection } from "@/hooks/agent-chat/useResumeDetection";
import { useMessageSubmission } from "@/hooks/agent-chat/useMessageSubmission";
import {
  applyPatchPaths,
  extractResumeEditDiff as extractResumeEditDiffFromMarkdown,
  normalizeResumePatchValue,
  stripResumeEditMarkdown,
} from "@/utils/resumePatch";

import WorkspaceLayout from "@/pages/WorkspaceLayout";
import CustomScrollbar from "@/components/common/CustomScrollbar";
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext';
import { ResumeDiffCard } from '../../components/agent-chat/ResumeDiffCard';
import { ResumeGeneratedCard } from '../../components/agent-chat/ResumeGeneratedCard';

// 报告内容视图组件
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
  if (!canUseAgentFeature()) {
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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
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

  // 搜索结果相关状态
  const [searchResults, setSearchResults] = useState<
    Array<{ messageId: string; data: SearchStructuredData }>
  >([]);
  const [resumeEditDiffs, setResumeEditDiffs] = useState<
    Array<{ messageId: string; data: ResumeEditDiffStructuredData }>
  >([]);

  const [resumeEditError, setLastError] = useState<{ message: string } | null>(null);

  // ResumeContext integration
  const { pendingPatches, pushPatch, patchAppliedAt } = useResumeContext();
  const [generatedResume, setGeneratedResume] = useState<{
    resume: any; summary: string
  } | null>(null);
  // Track current assistant message ID for patch association
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  const [streamDoneTick, setStreamDoneTick] = useState(0);
  const [activeRunId, setActiveRunId] = useState(0);
  const [currentSuggestions, setCurrentSuggestions] = useState<Array<{ text: string; msg: string }>>([]);
  const [activeSearchPanel, setActiveSearchPanel] =
    useState<SearchStructuredData | null>(null);

  // 🔧 自动同步选中的简历数据到全局 resumeData，确保右侧 PDF 渲染（用于恢复持久化状态）
  useEffect(() => {
    if (selectedResumeId) {
      const loaded = loadedResumes.find((r) => r.id === selectedResumeId);
      if (loaded?.resumeData) {
        setResumeData(loaded.resumeData);
      }
    } else {
      setResumeData(null);
    }
  }, [selectedResumeId, loadedResumes]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    pendingAttachments,
    setPendingAttachments,
    isUploadingFile,
    setIsUploadingFile,
    handleUploadFile,
    handleRemoveAttachment,
    clearAttachments,
  } = useAttachmentHandler(isProcessing);

  const {
    resumePdfPreview,
    setResumePdfPreview,
    updateResumePdfState,
    renderResumePdfPreview,
    EMPTY_RESUME_PDF_STATE,
  } = useResumePreview();

  const {
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
  } = useSessionPersistence({
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
    finalizeStream: () => finalizeStream(),
    refreshSessions: () => setSessionsRefreshKey((prev) => prev + 1),
    HISTORY_APPEND_MODE,
    isLoadingChat,
    currentSessionId,
  });

  const { handleSubmit } = useMessageSubmission({
    apiBaseUrl,
    user,
    isProcessing,
    isUploadingFile,
    setIsUploadingFile,
    pendingAttachments,
    setPendingAttachments,
    setResumeError,
    setResumeData,
    setLoadedResumes,
    setSelectedResumeId,
    setAllowPdfAutoRender,
    updateResumePdfState,
    sendUserTextMessage: (text, attachments, rData) =>
      sendUserTextMessage(text, attachments, rData),
    normalizeImportedResumeToCanonical,
    saveResume,
  });

  const { detectAndLoadResume } = useResumeDetection({
    user,
    loadedResumes,
    setLoadedResumes,
  });

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
        if (resp.status === 404) {
          // core native 模式可能未挂载 history 路由，关闭前端 history save/restore
          historyApiUnavailableRef.current = true;
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
  const currentRunUserInputRef = useRef("");
  const [pendingResumeInput, setPendingResumeInput] = useState<string>(""); // 暂存用户输入，选择简历后继续处理
  const resumeDataRef = useRef<ResumeData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
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
  const appendDisabledBySessionRef = useRef<Record<string, boolean>>({});
  const historyApiUnavailableRef = useRef(false);
  const autoScrollTimerRef = useRef<number | null>(null);
  const {
    streamRunRef,
    isFinalizedRef,
    currentThoughtRef,
    currentAnswerRef,
    lastCompletedRef,
    startNewRun,
    captureCompletionSnapshot,
    resolveFinalizedContent,
  } = useStreamRunController();
  const lastHandledAnswerCompleteRef = useRef(0);
  const lastDoneRunRef = useRef<number>(-1);
  const lastFinalizedRunRef = useRef<number>(-1);
  const lastFinalizedSignatureRef = useRef("");
  const pendingFinalizeAfterTypewriterRef = useRef(false);
  const finalizeRetryTimerRef = useRef<number | null>(null);
  const finalizeRetryAttemptsRef = useRef(0);
  const prevRouteSessionIdRef = useRef<string | null>(null);
  const isCreatingNewSessionRef = useRef(false);
  const { rebindCurrentMessageId } = useMessageTimeline();
  
  const normalizedResume = useMemo(() => {
    if (!resumeData) return null;
    return convertResumeDataToOpenManusFormat(resumeData);
  }, [resumeData]);

  useEffect(() => {
    resumeDataRef.current = resumeData;
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
  const isResumePreviewActive = Boolean(selectedResumeId);

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

  const upsertResumeEditDiff = useCallback(
    (messageId: string, data: ResumeEditDiffStructuredData) => {
      setResumeEditDiffs((prev) => {
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

  const applyResumeEditDiff = useCallback(
    (diff: ResumeEditDiffStructuredData) => {
      const patchPath = diff.patch?.path || "";
      const patchValue = diff.patch?.value;
      const patchAction = String(diff.patch?.action || "update").toLowerCase();

      // Debug logging to help identify issues
      console.log("[ResumeEdit] Applying diff:", {
        patchPath,
        patchValue,
        patchAction,
        hasBefore: !!diff.before,
        hasAfter: !!diff.after,
        section: diff.section,
        field: diff.field,
        index: diff.index,
      });

      if (!["update", "set", "replace", "edit"].includes(patchAction)) {
        console.warn("[ResumeEdit] Unsupported action:", patchAction);
        setLastError((prev) => ({
          ...prev,
          message: `不支持的操作类型：${patchAction}。仅支持 update、set、replace、edit 操作。`,
        }));
        return;
      }

      if (!patchPath) {
        console.warn("[ResumeEdit] No patch path provided", diff);
        setLastError((prev) => ({
          ...prev,
          message: `简历更新失败：AI未提供修改路径。这通常是因为AI无法确定要修改哪个字段。请尝试更具体的描述，例如："修改腾讯实习的工作经历描述"`,
        }));
        return;
      }

      if (!patchValue && !diff.after) {
        console.warn("[ResumeEdit] No new value provided", diff);
        setLastError((prev) => ({
          ...prev,
          message: `简历更新失败：AI未提供新的内容。请重试。`,
        }));
        return;
      }

      const patchResume = (source: ResumeData): ResumeData => {
        const next = structuredClone(source);
        const parsePathTokens = (path: string): Array<string | number> =>
          path
            .replace(/\[(\d+)\]/g, ".$1")
            .split(".")
            .map((segment) => segment.trim())
            .filter(Boolean)
            .map((segment) =>
              /^\d+$/.test(segment) ? Number(segment) : segment,
            );

        const normalizeRootKey = (
          root: string,
          resume: ResumeData,
        ): string => {
          if (root === "internships" || root === "internship") {
            if (!("internships" in (resume as Record<string, unknown>))) {
              return "experience";
            }
          }
          if (root === "work_experience" || root === "workExperience") {
            return "experience";
          }
          if (root === "basic_info" || root === "profile") {
            return "basic";
          }
          return root;
        };

        const setByPath = (
          target: Record<string, unknown>,
          tokens: Array<string | number>,
          value: unknown,
        ): boolean => {
          if (tokens.length === 0) return false;
          const normalized = [...tokens];
          if (typeof normalized[0] === "string") {
            normalized[0] = normalizeRootKey(normalized[0], next);
          }

          let cursor: any = target;
          for (let i = 0; i < normalized.length - 1; i += 1) {
            const current = normalized[i];
            const upcoming = normalized[i + 1];

            if (typeof current === "number") {
              if (!Array.isArray(cursor)) return false;
              if (
                cursor[current] === undefined ||
                cursor[current] === null ||
                typeof cursor[current] !== "object"
              ) {
                cursor[current] = typeof upcoming === "number" ? [] : {};
              }
              cursor = cursor[current];
              continue;
            }

            if (
              cursor[current] === undefined ||
              cursor[current] === null ||
              typeof cursor[current] !== "object"
            ) {
              cursor[current] = typeof upcoming === "number" ? [] : {};
            }
            cursor = cursor[current];
          }

          const leaf = normalized[normalized.length - 1];
          if (typeof leaf === "number") {
            if (!Array.isArray(cursor)) return false;
            cursor[leaf] = value;
            return true;
          }
          cursor[leaf] = value;
          return true;
        };

        const patchTokens = parsePathTokens(patchPath);
        const nextValueRaw =
          patchValue !== undefined ? patchValue : (diff.after ?? "");
        const nextValue = normalizeResumePatchValue(
          nextValueRaw,
          patchPath,
          diff.field,
        );
        if (patchTokens.length > 0) {
          const applied = setByPath(
            next as Record<string, unknown>,
            patchTokens,
            nextValue,
          );
          if (applied) return next;
        }

        const fallbackField = (typeof diff.field === "string" ? diff.field : "").trim();
        if (diff.section === "basic" && fallbackField) {
          setByPath(
            next as Record<string, unknown>,
            ["basic", fallbackField],
            normalizeResumePatchValue(
              diff.after ?? "",
              `basic.${fallbackField}`,
              fallbackField,
            ),
          );
          return next;
        }

        if (
          fallbackField &&
          typeof diff.index === "number" &&
          Number.isInteger(diff.index)
        ) {
          const sectionKey =
            diff.section === "internships" ? "experience" : diff.section;
          const applied = setByPath(
            next as Record<string, unknown>,
            [sectionKey, diff.index, fallbackField],
            normalizeResumePatchValue(
              diff.after ?? "",
              `${sectionKey}[${diff.index}].${fallbackField}`,
              fallbackField,
            ),
          );
          if (applied) return next;
        }

        const normalizeComparable = (value: unknown): string =>
          String(value || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/\s+/g, "")
            .trim()
            .toLowerCase();

        const beforeNeedle = normalizeComparable(diff.before || "");
        if (beforeNeedle.length >= 4) {
          const candidateRoots = Array.from(
            new Set(
              [
                String(diff.section || ""),
                diff.section === "internships" ? "experience" : "",
                "experience",
                "internships",
              ]
                .map((root) => normalizeRootKey(root, next))
                .filter(Boolean),
            ),
          );

          for (const rootKey of candidateRoots) {
            const collection = (next as Record<string, unknown>)[
              rootKey
            ] as unknown;
            if (!Array.isArray(collection)) continue;

            for (let i = 0; i < collection.length; i += 1) {
              const item = collection[i] as Record<string, unknown>;
              if (!item || typeof item !== "object") continue;
              const candidateField = fallbackField || "details";
              const candidateValue = item[candidateField];
              const candidateComparable = normalizeComparable(candidateValue);
              if (
                !candidateComparable ||
                (!candidateComparable.includes(beforeNeedle) &&
                  !beforeNeedle.includes(candidateComparable))
              ) {
                continue;
              }

              const applied = setByPath(
                next as Record<string, unknown>,
                [rootKey, i, candidateField],
                normalizeResumePatchValue(
                  diff.after ?? "",
                  `${rootKey}[${i}].${candidateField}`,
                  candidateField,
                ),
              );
              if (applied) {
                console.log("[AgentChat] Applied resume diff via before-match fallback", {
                  rootKey,
                  index: i,
                  field: candidateField,
                });
                return next;
              }
            }
          }
        }

        if (patchPath) {
          console.warn("[AgentChat] Failed to apply resume patch path", {
            patchPath,
            patchAction,
            section: diff.section,
            field: diff.field,
            index: diff.index,
            before: diff.before?.substring(0, 100),
            after: diff.after?.substring(0, 100),
          });
          // Show user-friendly error message in the chat
          setLastError((prev) => ({
            ...prev,
            message: `简历更新失败：无法找到路径 "${patchPath}"。请确保简历中包含该字段，或尝试重新描述需要修改的内容。`,
          }));
        } else {
          console.warn("[AgentChat] Missing patch path in resume diff", {
            section: diff.section,
            field: diff.field,
            index: diff.index,
          });
          setLastError((prev) => ({
            ...prev,
            message: `简历更新失败：缺少路径信息。AI响应格式不正确，请重试或重新描述需求。`,
          }));
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

  const { handleSSEEvent } = useToolEventRouter<
    SearchStructuredData,
    ResumeStructuredData,
    ResumeEditDiffStructuredData
  >({
    runId: activeRunId,
    onDone: () => {
      lastDoneRunRef.current = streamRunRef.current;
      setStreamDoneTick((prev) => prev + 1);
    },
    onError: (message) => setResumeError(message),
    onShowResumeSelector: () => {
      // 只在“加载简历”相关意图时展示选择器，避免编辑流程被 show_resume 误触发打断。
      const text = currentRunUserInputRef.current.trim();
      const isLoadResumeIntent =
        /(?:加载|打开|查看|显示|选择).*(?:简历|resume|cv)|(?:简历|resume|cv).*(?:加载|打开|选择)/i.test(
          text,
        );
      const hasResumeContext =
        !!resumeDataRef.current ||
        loadedResumes.some((item) => !!item.resumeData);
      // 非“加载简历”意图：
      // - 若当前会话已持有简历上下文：忽略本次 show_resume，并在本轮结束后自动重放用户输入
      // - 若会话没有简历上下文：仍需展示选择器，避免卡在“处理中”
      if (!isLoadResumeIntent && hasResumeContext) {
        console.warn("[AgentChat] Ignore show_resume selector for non-load intent:", text);
        return;
      }
      if (!isLoadResumeIntent && text) {
        setPendingResumeInput(text);
      }
      setResumeError(null);
      setShowResumeSelector(true);
    },
    onResumeUpdated: (resumeData) => {
      // 后端推送完整的更新后简历 JSON，更新 loadedResumes 本地副本（用于 PDF 渲染）。
      // ResumeContext 已通过 resume_patch 事件独立处理字段更新，无需重复合并。
      setLoadedResumes((prev) => {
        if (prev.length === 0) return prev;
        const targetId = selectedResumeId || prev[0]?.id;
        return prev.map((item) =>
          item.id === targetId
            ? { ...item, resumeData: resumeData as unknown as ResumeData }
            : item,
        );
      });
      // 清空 PDF blob 以触发重新渲染
      setResumePdfPreview((prev) => {
        const targetId = selectedResumeId || Object.keys(prev)[0];
        if (!targetId) return prev;
        return {
          ...prev,
          [targetId]: { ...EMPTY_RESUME_PDF_STATE },
        };
      });
      setAllowPdfAutoRender(true);
    },
    upsertSearchResult,
    upsertLoadedResume,
    upsertResumeEditDiff,
    applyResumeEditDiff,
  });

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
    onSSEEvent: useCallback((event: SSEEvent) => {
      // Intercept resume_patch and resume_generated events before routing
      if ((event as any).type === 'resume_patch') {
        // SSE structure: {type, data: {type, data: {patch_id, ...}, ...}}
        // parseBlock sets event.data = outer data object; actual patch is in event.data.data
        const outerData = (event as any).data ?? {}
        const patch = outerData.data ?? outerData
        pushPatch({
          patch_id:   patch.patch_id   ?? `patch-${Date.now()}`,
          message_id: currentAssistantMessageIdRef.current ?? Date.now().toString(),
          paths:      patch.paths      ?? [],
          before:     patch.before     ?? {},
          after:      patch.after      ?? {},
          summary:    patch.summary    ?? '',
        });
        return;
      }
      if ((event as any).type === 'resume_generated') {
        const outerData = (event as any).data ?? {}
        const data = outerData.data ?? outerData
        setGeneratedResume({ resume: data.resume, summary: data.summary ?? '' });
        return;
      }
      if ((event as any).type === 'suggestions') {
        const outerData = (event as any).data ?? {}
        const items = outerData.items ?? outerData.data?.items ?? []
        setCurrentSuggestions(items);
        return;
      }
      handleSSEEvent(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleSSEEvent, pushPatch]),
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
      // 仅存元数据，避免 localStorage 过大
      loadedResumes: loadedResumes.map((r) => ({
        id: r.id,
        name: r.name,
        messageId: r.messageId,
        resumeData: r.resumeData, // 这里的简历数据是必需的，用于右侧 PDF 预览渲染
      })),
    };
    localStorage.setItem(`ui_state:${conversationId}`, JSON.stringify(uiState));
  }, [conversationId, selectedResumeId, loadedResumes]);

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
    void renderResumePdfPreview(selectedLoadedResume);
  }, [
    selectedLoadedResume,
    renderResumePdfPreview,
    allowPdfAutoRender,
  ]);

  // 会话ID确定后，仅加载“当前选中会话”的消息内容
  useEffect(() => {
    // 等待初始化阶段确定最终会话ID后再加载
    if (!initialSessionResolved) {
      return;
    }

    // If createNewSession is in progress, skip any session loading to avoid
    // restoring stale session data from the old URL sessionId.
    if (isCreatingNewSessionRef.current) {
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
              setAllowPdfAutoRender(true);
            } else {
              setSelectedResumeId(null);
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
          (m: any, index: number) => {
            const rawContent = m.content;
            const content =
              typeof rawContent === "string"
                ? rawContent
                : rawContent != null
                ? JSON.stringify(rawContent)
                : "";
            return {
              id: generateMessageId(content, m.role || "unknown", index),
              role: m.role === "user" ? "user" : "assistant",
              content,
              thought: m.thought || undefined,
              timestamp: new Date().toISOString(),
            };
          },
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

  // When a patch is applied via ResumeContext, also update local resumeData and
  // loadedResumes so the PDF re-renders with the new content.
  useEffect(() => {
    if (!patchAppliedAt) return;

    // Apply all accepted patches to local resumeData (idempotent re-apply is safe)
    setResumeData(prev => {
      if (!prev) return prev;
      let updated: ResumeData = prev;
      for (const patch of pendingPatches) {
        if (patch.status === 'applied') {
          updated = applyPatchPaths(updated, patch.paths, patch.after) as ResumeData;
        }
      }
      return updated;
    });

    // Also update loadedResumes so selectedLoadedResume reflects the new data,
    // which triggers the PDF auto-render effect.
    setLoadedResumes(prev => {
      const targetId = selectedResumeId || prev[0]?.id;
      if (!targetId) return prev;
      return prev.map(item => {
        if (item.id !== targetId || !item.resumeData) return item;
        let updated: ResumeData = item.resumeData;
        for (const patch of pendingPatches) {
          if (patch.status === 'applied') {
            updated = applyPatchPaths(updated, patch.paths, patch.after) as ResumeData;
          }
        }
        return { ...item, resumeData: updated };
      });
    });

    setResumePdfPreview(prev => {
      const targetId = selectedResumeId || Object.keys(prev)[0];
      if (!targetId) return prev;
      return { ...prev, [targetId]: { ...EMPTY_RESUME_PDF_STATE } };
    });
    setAllowPdfAutoRender(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchAppliedAt]);

  useEffect(() => {
    if (answerCompleteCount <= 0 || !resumeId) {
      return;
    }
    // If there are pending patches waiting for user approval, skip auto-refresh.
    // The PDF will re-render when the user clicks Apply (patchAppliedAt effect).
    if (pendingPatches.some(p => p.status === 'pending')) {
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
  }, [answerCompleteCount, resumeId, user?.id, pendingPatches]);

  const isHtmlTemplate = resumeData?.templateType === "html";

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

  /**
   * Finalize current message and add to history
   */
  const finalizeMessage = useCallback(() => {
    if (lastFinalizedRunRef.current === streamRunRef.current) {
      return;
    }
    // 防止重复调用
    if (isFinalizedRef.current) {
      console.log("[AgentChat] finalizeMessage already called, skipping");
      // 仅在没有活跃流内容时兜底释放，避免误清空下一条消息。
      if (
        !isProcessing &&
        !currentThoughtRef.current.trim() &&
        !currentAnswerRef.current.trim()
      ) {
        finalizeStream();
        window.setTimeout(() => {
          isFinalizedRef.current = false;
        }, 80);
      }
      return;
    }

    isFinalizedRef.current = true;

    const thoughtStateValue = currentThought.trim();
    const answerStateValue = currentAnswer.trim();
    const fallback = lastCompletedRef.current;
    const {
      thought: resolvedThought,
      answer,
      canUseFallback,
      fallbackRun,
    } = resolveFinalizedContent(thoughtStateValue, answerStateValue);
    const thought =
      resolvedThought.trim() === "正在思考..." ? "" : resolvedThought;

    console.log("[AgentChat] finalizeMessage called", {
      thoughtLength: thought.length,
      answerLength: answer.length,
      thoughtRefLength: currentThoughtRef.current.trim().length,
      answerRefLength: currentAnswerRef.current.trim().length,
      thoughtStateLength: thoughtStateValue.length,
      answerStateLength: answerStateValue.length,
      fallbackThoughtLength: fallback?.thought?.length || 0,
      fallbackAnswerLength: fallback?.answer?.length || 0,
      streamRun: streamRunRef.current,
      fallbackRun: fallbackRun ?? fallback?.run,
      canUseFallback,
    });

    if (!thought && !answer) {
      if (isProcessing) {
        // 若已收到当前轮 done，但内容为空（常见于 agent_error），主动收口本轮，避免重复触发警告。
        if (lastDoneRunRef.current === streamRunRef.current) {
          pendingFinalizeAfterTypewriterRef.current = false;
          finalizeRetryAttemptsRef.current = 0;
          if (finalizeRetryTimerRef.current !== null) {
            window.clearTimeout(finalizeRetryTimerRef.current);
            finalizeRetryTimerRef.current = null;
          }
          finalizeStream();
          window.setTimeout(() => {
            isFinalizedRef.current = false;
          }, 120);
          return;
        }
        console.warn("[AgentChat] finalizeMessage called with NO content while still processing. This might be a race condition.");
        // 新一轮流式开始后，可能收到上一轮延迟 done，直接忽略，避免清空当前轮状态。
        isFinalizedRef.current = false;
        return;
      }
      console.log("[AgentChat] No content to finalize, just resetting state");
      pendingFinalizeAfterTypewriterRef.current = false;
      finalizeRetryAttemptsRef.current = 0;
      if (finalizeRetryTimerRef.current !== null) {
        window.clearTimeout(finalizeRetryTimerRef.current);
        finalizeRetryTimerRef.current = null;
      }
      finalizeStream();
      setTimeout(() => {
        isFinalizedRef.current = false;
      }, 100);
      return;
    }

    const currentEditDiff = resumeEditDiffs.find(
      (entry) => entry.messageId === "current",
    )?.data as
      | {
          before?: string;
          after?: string;
        }
      | undefined;
    const markdownEditDiff = extractResumeEditDiffFromMarkdown(answer || "");
    const latestUserMessage = [...messages]
      .reverse()
      .find((item) => item.role === "user")?.content || "";
    const normalizedLatestUserMessage = latestUserMessage.trim();
    const replaceTargetMatch = normalizedLatestUserMessage.match(
      /(?:改成|改为|变成|改到)\s*["“]?([^"”\s，。,！!？?]+)["”]?/i,
    );
    const requestedReplacement = replaceTargetMatch?.[1]?.trim() || "";
    const hasEditIntent = /(?:把|将|帮我|请)?(?:我的)?(?:名字|姓名|公司|职位|学校|电话|邮箱).*(?:改成|改为|变成)|(?:改成|改为|变成)/.test(
      normalizedLatestUserMessage,
    );
    const diffAfterValue = (
      currentEditDiff?.after ||
      markdownEditDiff?.after ||
      ""
    ).trim();
    const answerLooksLikeEditDiff = Boolean(markdownEditDiff);
    const isStaleEditDiffResponse =
      (answerLooksLikeEditDiff || Boolean(diffAfterValue)) &&
      ((!hasEditIntent &&
        /(?:你好|hello|hi|谢谢|加载简历|查看简历)/i.test(
          normalizedLatestUserMessage,
        )) ||
        (requestedReplacement &&
          Boolean(diffAfterValue) &&
          diffAfterValue !== requestedReplacement));

    if (isStaleEditDiffResponse) {
      console.warn("[AgentChat] stale edit diff response ignored", {
        latestUserMessage: normalizedLatestUserMessage,
        requestedReplacement,
        diffAfterValue,
      });
      pendingFinalizeAfterTypewriterRef.current = false;
      finalizeRetryAttemptsRef.current = 0;
      if (finalizeRetryTimerRef.current !== null) {
        window.clearTimeout(finalizeRetryTimerRef.current);
        finalizeRetryTimerRef.current = null;
      }
      setSearchResults((prev) => prev.filter((item) => item.messageId !== "current"));
      setLoadedResumes((prev) => prev.filter((item) => item.messageId !== "current"));
      setResumeEditDiffs((prev) => prev.filter((item) => item.messageId !== "current"));
      finalizeStream();
      window.setTimeout(() => {
        isFinalizedRef.current = false;
      }, 120);
      return;
    }

    const finalizeSignature = `${streamRunRef.current}::${thought}::${answer}`;
    if (lastFinalizedSignatureRef.current === finalizeSignature) {
      console.log("[AgentChat] Duplicate finalize signature skipped");
      pendingFinalizeAfterTypewriterRef.current = false;
      finalizeRetryAttemptsRef.current = 0;
      if (finalizeRetryTimerRef.current !== null) {
        window.clearTimeout(finalizeRetryTimerRef.current);
        finalizeRetryTimerRef.current = null;
      }
      finalizeStream();
      window.setTimeout(() => {
        isFinalizedRef.current = false;
      }, 120);
      return;
    }
    lastFinalizedSignatureRef.current = finalizeSignature;

    refreshAfterSaveRef.current = true;
    pendingSaveRef.current = true;
    // Use the pre-generated ID from sendUserTextMessage so resume patches can reference it
    const uniqueId = currentAssistantMessageIdRef.current ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentAssistantMessageIdRef.current = null;
    const newMessage: Message = {
      id: uniqueId,
      role: "assistant",
      content: answer || "",
      timestamp: new Date().toISOString(),
    };
    if (thought) {
      newMessage.thought = thought;
    }

    setSearchResults((prev) => rebindCurrentMessageId(prev, uniqueId));
    setLoadedResumes((prev) => rebindCurrentMessageId(prev, uniqueId));
    setResumeEditDiffs((prev) => rebindCurrentMessageId(prev, uniqueId));

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const lastContent = typeof last?.content === "string" ? last.content : "";
      const lastThought = typeof (last as any)?.thought === "string" ? (last as any).thought : "";
      if (
        last &&
        last.role === "assistant" &&
        lastContent.trim() === newMessage.content.trim() &&
        lastThought.trim() ===
          (newMessage.thought || "").trim()
      ) {
        console.log("[AgentChat] Duplicate assistant message skipped");
        return prev;
      }
      const updated = [...prev, newMessage];
      console.log("[AgentChat] Messages updated", { count: updated.length });

      return updated;
    });
    lastFinalizedRunRef.current = streamRunRef.current;

    // Clear transient stream buffers only after message finalization work has been enqueued.
    pendingFinalizeAfterTypewriterRef.current = false;
    finalizeRetryAttemptsRef.current = 0;
    if (finalizeRetryTimerRef.current !== null) {
      window.clearTimeout(finalizeRetryTimerRef.current);
      finalizeRetryTimerRef.current = null;
    }
    finalizeStream();
  }, [
    finalizeStream,
    currentAnswer,
    currentThought,
    resumeEditDiffs,
    messages,
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

  useEffect(() => {
    if (streamDoneTick === 0 || !isProcessing) {
      return;
    }
    if (lastDoneRunRef.current !== streamRunRef.current) {
      return;
    }
    if (pendingFinalizeAfterTypewriterRef.current) {
      return;
    }

    pendingFinalizeAfterTypewriterRef.current = true;
    finalizeAfterTypewriter();

    const guardTimer = window.setTimeout(() => {
      if (pendingFinalizeAfterTypewriterRef.current) {
        finalizeAfterTypewriter();
      }
    }, 600);

    return () => {
      window.clearTimeout(guardTimer);
    };
  }, [streamDoneTick, isProcessing, finalizeAfterTypewriter]);

  const refreshSessions = useCallback(() => {
    setSessionsRefreshKey((prev) => prev + 1);
  }, []);


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

                <MessageTimeline
                  messages={messages}
                  loadedResumes={loadedResumes}
                  searchResults={searchResults}
                  resumeEditDiffs={resumeEditDiffs}
                  copiedId={copiedId}
                  stripResumeEditMarkdown={stripResumeEditMarkdown}
                  onSetCopiedId={setCopiedId}
                  onOpenSearchPanel={setActiveSearchPanel}
                  onOpenResume={(resumeForMessage) => {
                    setAllowPdfAutoRender(true);
                    setSelectedResumeId(resumeForMessage.id);
                    if (resumeForMessage.resumeData) {
                      setResumeData(resumeForMessage.resumeData);
                    }
                  }}
                  onOpenResumeSelector={() => setShowResumeSelector(true)}
                  onRegenerate={() => {
                    const userMessages = messages.filter((m) => m.role === "user");
                    const lastUserMsg = userMessages[userMessages.length - 1];
                    if (lastUserMsg) {
                      void sendUserTextMessage(lastUserMsg.content);
                    }
                  }}
                />

                <StreamingLane
                  currentThought={currentThought}
                  currentAnswer={currentAnswer}
                  isProcessing={isProcessing}
                  suggestions={currentSuggestions}
                  onSuggestionClick={(msg) => void sendUserTextMessage(msg)}
                  shouldHideResponseInChat={false}
                  currentEditDiff={resumeEditDiffs.find((r) => r.messageId === "current")}
                  currentSearch={searchResults.find((r) => r.messageId === "current")}
                  stripResumeEditMarkdown={stripResumeEditMarkdown}
                  onOpenSearchPanel={setActiveSearchPanel}
                  onResponseTypewriterComplete={finalizeAfterTypewriter}
                />

                {/* ResumeDiffCards for pending patches (grouped by message) */}
                {pendingPatches.length > 0 && (
                  <div className="px-4 py-1">
                    {pendingPatches
                      .filter(p => p.status === 'pending')
                      .map(patch => (
                        <ResumeDiffCard key={patch.patch_id} patch={patch} />
                      ))
                    }
                  </div>
                )}

                {/* ResumeGeneratedCard */}
                {generatedResume && (
                  <div className="px-4 py-1">
                    <ResumeGeneratedCard
                      resume={generatedResume.resume}
                      summary={generatedResume.summary}
                      onDismiss={() => setGeneratedResume(null)}
                    />
                  </div>
                )}

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
                {isProcessing &&
                  (!currentThought.trim() ||
                    currentThought.trim() === "正在思考...") &&
                  !currentAnswer.trim() && (
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
                {/* 快捷按钮 */}
                {!isProcessing && !currentAnswer.trim() && messages.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => void sendUserTextMessage("帮我诊断一下这份简历有什么问题")}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <Search className="w-3 h-3" />
                      简历诊断
                    </button>
                  </div>
                )}
                <Composer
                  input={input}
                  isProcessing={isProcessing}
                  isUploadingFile={isUploadingFile}
                  isVoiceRecording={isVoiceRecording}
                  isVoiceProcessing={isVoiceProcessing}
                  isVoiceSpeaking={isVoiceSpeaking}
                  isResumePreviewActive={isResumePreviewActive}
                  pendingAttachments={pendingAttachments}
                  fileInputRef={fileInputRef}
                  onSubmit={handleSubmit}
                  onInputChange={setInput}
                  onKeyDown={handleComposerKeyDown}
                  onFileChange={handleUploadFile}
                  onRemoveAttachment={handleRemoveAttachment}
                  onClickUpload={handleClickUpload}
                  onShowResumeSelector={() => setShowResumeSelector(true)}
                  onStartVoiceRecording={startVoiceRecording}
                  onStopVoiceRecording={stopVoiceRecording}
                />
              </div>
            </div>
          </section>

          {/* Right: Resume Preview - 只在有选中简历时显示 */}
          {selectedResumeId && (
            <CustomScrollbar as="aside" className="w-[45%] min-w-[420px] bg-slate-50 border-l border-slate-200 flex flex-col">
              <div className="border-b border-slate-200 bg-white px-6 py-4 sticky top-0 z-10 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">
                      简历 PDF 预览
                    </h2>
                    {selectedLoadedResume && (
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedLoadedResume.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedLoadedResume && (
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
                    <button
                      onClick={() => {
                        setAllowPdfAutoRender(false);
                        setSelectedResumeId(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
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
