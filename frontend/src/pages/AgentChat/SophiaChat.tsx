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
import { getResume, getAllResumes, saveResume } from "@/services/resumeStorage";
import {
  fetchAgentModels,
  readStoredAgentModelProfile,
  resolvePreferredAgentModel,
  type AgentModelOption,
  writeStoredAgentModelProfile,
} from "@/services/agentModels";
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

interface DiagnosisToolStructuredData {
  type: "resume_detail" | "resume_diagnosis";
  status?: string;
  tool?: string;
  resume?: {
    id?: string;
    name?: string;
    updated_at?: string;
    language?: string;
  };
  summary?: {
    screening_probability?: number;
    quality_score?: number;
    competitiveness_score?: number;
    matching_score?: number | null;
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

  useEffect(() => {
    let mounted = true;

    const loadAgentModels = async () => {
      setIsLoadingAgentModels(true);
      try {
        const response = await fetchAgentModels(apiBaseUrl, getAuthHeaders());
        if (!mounted) {
          return;
        }
        setAgentModelOptions(response.models);
        setSelectedAgentModel((current) => {
          const resolved = resolvePreferredAgentModel(
            response.models,
            current || response.selected,
          );
          if (resolved) {
            writeStoredAgentModelProfile(resolved);
          }
          return resolved;
        });
      } catch (error) {
        console.error("[AgentChat] Failed to load agent models:", error);
      } finally {
        if (mounted) {
          setIsLoadingAgentModels(false);
        }
      }
    };

    void loadAgentModels();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, getAuthHeaders]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
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
  const [agentModelOptions, setAgentModelOptions] = useState<AgentModelOption[]>([]);
  const [isLoadingAgentModels, setIsLoadingAgentModels] = useState(true);
  const [selectedAgentModel, setSelectedAgentModel] = useState(
    () => readStoredAgentModelProfile() ?? "",
  );

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
  const [resumeEditDiffs, setResumeEditDiffs] = useState<
    Array<{ messageId: string; data: ResumeEditDiffStructuredData }>
  >([]);
  const [diagnosisToolEvents, setDiagnosisToolEvents] = useState<
    Array<{ messageId: string; data: DiagnosisToolStructuredData }>
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
  const [currentSuggestions, setCurrentSuggestions] = useState<Array<{ text: string; msg: string; template?: string }>>([]);
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

  const handleAgentModelChange = useCallback((modelId: string) => {
    setSelectedAgentModel(modelId);
    writeStoredAgentModelProfile(modelId);
    setResumeError(null);
  }, []);

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

  const upsertDiagnosisToolEvent = useCallback(
    (messageId: string, data: DiagnosisToolStructuredData) => {
      setDiagnosisToolEvents((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.messageId === messageId && item.data.type === data.type,
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
    ResumeEditDiffStructuredData,
    DiagnosisToolStructuredData
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
    upsertDiagnosisToolEvent,
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
    llmProfile: selectedAgentModel,
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
      diagnosisToolEvents,
    };
    localStorage.setItem(`ui_state:${conversationId}`, JSON.stringify(uiState));
  }, [conversationId, selectedResumeId, loadedResumes, diagnosisToolEvents]);

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
              diagnosisToolEvents: savedDiagnosisToolEvents,
            } = JSON.parse(savedUiState);
            // 恢复已加载列表的元数据，数据会在后续逻辑中通过消息或重新加载补齐
            if (Array.isArray(sLrs) && sLrs.length > 0) {
              setLoadedResumes(sLrs);
            }
            if (Array.isArray(savedDiagnosisToolEvents)) {
              setDiagnosisToolEvents(savedDiagnosisToolEvents);
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
      setDiagnosisToolEvents((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );
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
    setDiagnosisToolEvents((prev) => rebindCurrentMessageId(prev, uniqueId));

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
      if (historyApiUnavailableRef.current) {
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
            if (resp.status === 404) {
              historyApiUnavailableRef.current = true;
              queuedSaveRef.current = null;
              scheduledSaveRef.current = null;
              return;
            }
            let errorDetail = "";
            try {
              const raw = await resp.clone().text();
              if (raw) {
                try {
                  const parsed = JSON.parse(raw);
                  errorDetail = parsed?.message || parsed?.detail || raw;
                } catch {
                  errorDetail = raw;
                }
              }
            } catch {
              // ignore parse errors
            }
            console.error(
              `[AgentChat] Failed to save session: ${resp.status}${
                errorDetail ? ` - ${String(errorDetail).slice(0, 300)}` : ""
              }`,
            );
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
      const contentKey = (typeof msg.content === "string" ? msg.content : "").trim();
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
    setAllowPdfAutoRender(false);
    setLoadedResumes([]);
    setSearchResults([]);
    setDiagnosisToolEvents([]);
    setActiveSearchPanel(null);
    setResumePdfPreview({});

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
        // For brand-new local sessions (conv-*) that haven't been persisted yet,
        // a 404 is expected — don't show an error to the user.
        if (!(resp.status === 404 && sessionId.startsWith('conv-'))) {
          setResumeError(`会话加载失败：${detail}`);
        }
        // Mark sessionId as "seen" so the URL effect doesn't retry infinitely
        setCurrentSessionId(sessionId);
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
            diagnosisToolEvents: savedDiagnosisToolEvents,
          } = JSON.parse(savedUiState);
          if (Array.isArray(sLrs) && sLrs.length > 0) {
            setLoadedResumes(sLrs);
          }
          if (Array.isArray(savedDiagnosisToolEvents)) {
            setDiagnosisToolEvents(savedDiagnosisToolEvents);
          }
          if (
            typeof savedSelectedResumeId === "string" &&
            savedSelectedResumeId.trim() !== ""
          ) {
            setSelectedResumeId(savedSelectedResumeId);
            setAllowPdfAutoRender(true);
          }
        }
      } catch (e) {
        console.warn("[AgentChat] Failed to restore session ui data:", e);
      }

      const loadedMessages: Message[] = userVisibleMessages.map(
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
    console.log("[AgentChat] Creating new session:", newId);
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    lastPersistedCountBySessionRef.current[newId] = 0;
    setSelectedResumeId(null);
    setAllowPdfAutoRender(false);
    setLoadedResumes([]);
    setDiagnosisToolEvents([]);
    setSearchResults([]);
    setResumeEditDiffs([]);
    setActiveSearchPanel(null);
    setResumePdfPreview({});
    finalizeStream();

    // Navigate to clean URL
    isCreatingNewSessionRef.current = true;
    navigate('/agent/new', { replace: true });

    // 不再立即持久化空会话，只在用户发送第一条消息时才真正创建并入库
    // 这样可以避免用户点击+按钮后没有输入消息就产生空会话
  }, [finalizeStream, saveCurrentSession, waitForPendingSave, navigate]);

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

  // 监听 forceNew state（侧边栏"+"在已处于 /agent/new 时触发）
  const prevForceNewRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const forceNew = (location.state as { forceNew?: number } | null)?.forceNew;
    if (forceNew && forceNew !== prevForceNewRef.current) {
      prevForceNewRef.current = forceNew;
      void createNewSession();
    }
  }, [location.state, createNewSession]);

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
      // If createNewSession just ran and navigate hasn't changed URL yet,
      // the old routeSessionId may still be in the URL — skip loading it.
      if (isCreatingNewSessionRef.current) return;
      void loadSession(routeSessionId);
      return;
    }

    // 从历史会话URL切回 /agent/new（无 sessionId）时，主动创建空白新会话
    // 或者当 URL 没有 sessionId 但当前 session 却是一个已有的 session 时，也重置
    if (!isLoadingSession) {
      if (isCreatingNewSessionRef.current) {
        isCreatingNewSessionRef.current = false;
      } else if (previousRouteSessionId || (currentSessionId && !currentSessionId.startsWith('conv-'))) {
        void createNewSession();
      }
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
      resumeDataRef.current = resumeDataWithMeta;
      setResumeData(resumeDataWithMeta);

      // 添加到加载的简历列表，以便在右侧显示
      const messageId = `resume-select-${Date.now()}`;
      setLoadedResumes((prev) => {
        const nextEntry = {
          id: selectedResume.id,
          name: selectedResume.name,
          messageId,
          resumeData: resumeDataWithMeta,
        };
        const filtered = prev.filter((item) => item.id !== selectedResume.id);
        return [...filtered, nextEntry];
      });

      // 自动选中该简历，显示在右侧
      setAllowPdfAutoRender(true);
      setSelectedResumeId(selectedResume.id);

      // 若有待重放输入，且当前还处于处理态，先强制收口上一轮，避免输入框一直卡在“处理中”。
      if (pendingResumeInput.trim() && isProcessing) {
        finalizeStream();
      }

      console.log(
        "[AgentChat] 简历已选择并加载:",
        selectedResume.id,
        selectedResume.name,
      );
    },
    [user?.id, pendingResumeInput, isProcessing, finalizeStream],
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
      currentRunUserInputRef.current = userMessage.trim();
      setCurrentSuggestions([]);
      setSearchResults((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );
      setLoadedResumes((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );
      setResumeEditDiffs((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );
      setDiagnosisToolEvents((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );

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
      pendingFinalizeAfterTypewriterRef.current = false;
      finalizeRetryAttemptsRef.current = 0;
      if (finalizeRetryTimerRef.current !== null) {
        window.clearTimeout(finalizeRetryTimerRef.current);
        finalizeRetryTimerRef.current = null;
      }
      const nextRunId = startNewRun();
      setActiveRunId(nextRunId);
      lastDoneRunRef.current = -1;
      currentThoughtRef.current = "";
      currentAnswerRef.current = "";
      // Pre-generate a message ID for this run so resume patches can reference it
      currentAssistantMessageIdRef.current = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setSearchResults((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );
      setLoadedResumes((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );
      setResumeEditDiffs((prev) =>
        prev.filter((item) => item.messageId !== "current"),
      );

      const effectiveResumeData =
        resumeDataOverride !== undefined
          ? resumeDataOverride
          : resumeDataRef.current;
      await sendMessage(userMessage, effectiveResumeData);
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
    if (!pendingResumeInput.trim()) return;
    if (!resumeData) return;
    if (showResumeSelector || isProcessing) return;
    const replay = pendingResumeInput;
    setPendingResumeInput("");
    void sendUserTextMessage(replay, undefined, resumeData);
  }, [
    pendingResumeInput,
    resumeData,
    showResumeSelector,
    isProcessing,
    sendUserTextMessage,
  ]);

  useEffect(() => {
    if (answerCompleteCount === 0) return;
    if (answerCompleteCount <= lastHandledAnswerCompleteRef.current) {
      return;
    }
    isFinalizedRef.current = false;
    lastHandledAnswerCompleteRef.current = answerCompleteCount;
    pendingFinalizeAfterTypewriterRef.current = true;

    const currentAnswerValue = currentAnswerRef.current.trim() || currentAnswer.trim();
    const currentThoughtValue = currentThoughtRef.current.trim() || currentThought.trim();
    const hasAnyContent = currentAnswerValue || currentThoughtValue;

    if (hasAnyContent) {
      captureCompletionSnapshot(currentThoughtValue, currentAnswerValue);
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
              finalizeMessage();
            }
          }, 220);
          return;
        }
        pendingFinalizeAfterTypewriterRef.current = false;
        finalizeMessage();
      }
      finalizeRetryTimerRef.current = null;
    }, 800);
  }, [
    answerCompleteCount,
    currentAnswer,
    currentThought,
    finalizeAfterTypewriter,
    finalizeMessage,
  ]);

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

    // 每轮新消息开始前清理可能残留的状态

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
    setDiagnosisToolEvents([]);
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
                  <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                    <span className="text-sm text-red-600 flex-1">{resumeError}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(resumeError)}
                      className="text-xs text-red-500 hover:text-red-700 underline shrink-0"
                    >
                      复制
                    </button>
                  </div>
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

                {/* 简历选择器：固定在对话流上方，避免被后续输出挤到下方 */}
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

                <MessageTimeline
                  messages={messages}
                  loadedResumes={loadedResumes}
                  searchResults={searchResults}
                  resumeEditDiffs={resumeEditDiffs}
                  diagnosisToolEvents={diagnosisToolEvents}
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
                  onSuggestionClick={(msg) => setInput(msg)}
                  shouldHideResponseInChat={false}
                  currentEditDiff={resumeEditDiffs.find((r) => r.messageId === "current")}
                  currentSearch={searchResults.find((r) => r.messageId === "current")}
                  currentDiagnosisTools={diagnosisToolEvents
                    .filter((item) => item.messageId === "current")
                    .map((item) => item.data)}
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
                {!isProcessing &&
                  !currentAnswer.trim() &&
                  (messages.length > 0 || Boolean(selectedResumeId)) && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => void sendUserTextMessage("帮我从招聘者的角度进行简历诊断")}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <Search className="w-3 h-3" />
                      简历诊断
                    </button>
                  </div>
                )}
                <Composer
                  agentModelOptions={agentModelOptions}
                  input={input}
                  isLoadingAgentModels={isLoadingAgentModels}
                  isProcessing={isProcessing}
                  isUploadingFile={isUploadingFile}
                  isVoiceRecording={isVoiceRecording}
                  isVoiceProcessing={isVoiceProcessing}
                  isVoiceSpeaking={isVoiceSpeaking}
                  isResumePreviewActive={isResumePreviewActive}
                  pendingAttachments={pendingAttachments}
                  fileInputRef={fileInputRef}
                  selectedAgentModel={selectedAgentModel}
                  onSubmit={handleSubmit}
                  onAgentModelChange={handleAgentModelChange}
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
