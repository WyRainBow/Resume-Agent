import { toast } from '@/lib/toast'
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

import ResumeSelector from "@/components/chat/ResumeSelector";
import SearchResultPanel from "@/components/chat/SearchResultPanel";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useCLTP } from "@/hooks/useCLTP";
import { isAgentEnabled } from "@/lib/runtimeEnv";
import { hasHeroHandoffImages, takeHeroHandoffImages } from "@/lib/heroHandoff";
import { JdOptimizeChatCard } from "@/components/agent-chat/JdOptimizeChatCard";
import {
  getSessionLimitMessage,
  isSessionLimitExceededResponse,
  parseSessionLimits,
} from "@/utils/sessionLimits";
import AgentPdfPreviewPanel from "@/components/agent-chat/AgentPdfPreviewPanel";
import { convertToBackendFormat } from "@/pages/Workspace/v2/utils/convertToBackend";
import {
  DEFAULT_MENU_SECTIONS,
  type ResumeData,
} from "@/pages/Workspace/v2/types";
import { getResume, getAllResumes, saveResume, setCurrentResumeId } from "@/services/resumeStorage";
import { parseResumeText } from "@/services/resumeParse";
import type { SavedResume } from "@/services/storage/StorageAdapter";
import {
  renderPDFStream,
} from "@/services/api";
import { Message } from "@/types/chat";
import type { SSEEvent } from "@/transports/SSETransport";
import {
  Sparkles,
  MessageSquare,
  Bot,
  Wand2,
  Upload,
  FileText,
  Search,
  Zap,
} from "lucide-react";
import ChatEmptyState from "@/components/agent-chat/ChatEmptyState";
import IntentChips from "@/components/agent-chat/IntentChips";
import ModelSelector, { DEFAULT_AGENT_MODEL } from "@/components/agent-chat/ModelSelector";
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
  inferPatchOperation,
  normalizeResumePatchValue,
  stripResumeEditMarkdown,
} from "@/utils/resumePatch";

import WorkspaceLayout from "@/pages/WorkspaceLayout";
import CustomScrollbar from "@/components/common/CustomScrollbar";
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext';
import { ResumeDiffCard, ApplyAllPatchesBar } from '../../components/agent-chat/ResumeDiffCard';
import { ResumeGeneratedCard } from '../../components/agent-chat/ResumeGeneratedCard';
import AIImportModal from "@/pages/Workspace/v2/shared/AIImportModal";

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

/**
 * 发送前对「一堆连续文字」做轻量结构化：把数字编号、仓库标签拆成换行，
 * 既让对话气泡更易读，也让 Agent 更容易解析（例如把项目名/社区名识别出来）。
 * 仅对含编号或「仓库：」标签的较长文本生效，避免误伤普通短消息和小数（2025.06）。
 */
function formatChatInput(text: string): string {
  const looksStructured =
    /\d+\s*[.、]\s*[一-龥A-Za-z]/.test(text) || /仓库\s*[:：]/.test(text);
  if (!looksStructured || text.length < 40) return text;
  return text
    .replace(/\s+(?=\d+\s*[.、]\s*[^\d\s])/g, "\n")
    .replace(/\s+(?=仓库\s*[:：])/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
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
    const descriptionText = toText(item?.description);
    return {
      id: item?.id || `edu_${opts.resumeId}_${index}`,
      school: title,
      major: subtitle,
      degree,
      startDate: range.startDate || toText(item?.startDate),
      endDate: range.endDate || toText(item?.endDate),
      description: details.length
        ? listToHtml(details)
        : descriptionText
          ? `<p>${descriptionText}</p>`
          : "",
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
      name: toText(source.basic?.name || source.name),
      title: toText(source.basic?.title || source.objective || source.summary),
      email: toText(source.basic?.email || contact.email),
      phone: toText(source.basic?.phone || contact.phone),
      location: toText(source.basic?.location || contact.location),
    },
    education,
    experience,
    projects,
    openSource,
    awards,
    customData: {},
    selfEvaluation: toText(source.selfEvaluation)
      ? toText(source.selfEvaluation)
      : (toText(source.summary) ? `<p>${toText(source.summary)}</p>` : ""),
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

function isCreateResumeIntentText(text: string): boolean {
  const normalized = (text || "").trim();
  if (!normalized) return false;
  return /(?:帮我|请|想要|想)?(?:创建|新建|做|生成|弄).{0,8}(?:一份|一个|份)?(?:简历|cv)|(?:创建|新建).{0,4}简历/i.test(
    normalized,
  );
}

function isSelectExistingResumeIntentText(text: string): boolean {
  const normalized = (text || "").trim();
  if (!normalized || isCreateResumeIntentText(normalized)) return false;
  // 「导入我的简历内容：…」是粘贴导入，不是选择已有简历
  if (/^导入(?:我的)?(?:简历|cv)/i.test(normalized)) return false;
  return (
    /^(?:加载|打开|查看|显示|选择).*(?:已有|保存的|我的)?.{0,6}(?:简历|resume|cv)/i.test(
      normalized,
    ) ||
    /^(?:已有|保存的).{0,6}(?:简历|resume|cv)/i.test(normalized) ||
    /^(?:简历|resume|cv).*(?:加载|打开|选择)/i.test(normalized) ||
    /^选择已有简历/i.test(normalized)
  );
}

function isLoadResumeIntentText(text: string): boolean {
  return isSelectExistingResumeIntentText(text);
}

function isGreetingOnlyText(text: string): boolean {
  const normalized = (text || "").trim();
  if (!normalized) return false;
  return (
    normalized.length <= 20 &&
    /^(?:你好|您好|hello|hi|hey|在吗|哈喽)[!！?？\s，,。.~～]*$/i.test(normalized)
  );
}

const PASTE_IMPORT_EXPLICIT_RES = [
  /^导入(?:我的)?(?:简历|cv)(?:内容)?\s*[：:]\s*([\s\S]+)/i,
  /^import\s+(?:my\s+)?(?:resume|cv)(?:\s+content)?\s*[：:]\s*([\s\S]+)/i,
];

function isResumeLikePasteText(text: string): boolean {
  let score = 0;
  if (/教育经历|education|大学|学院|硕士|本科|学士/i.test(text)) score += 1;
  if (/实习|工作|项目|经历|internship|experience|project/i.test(text)) score += 1;
  if (/(?:1[3-9]\d{9})|@\w+\.|邮箱|电话|📞|📧/i.test(text)) score += 1;
  if (/求职意向|objective|专业技能|skills/i.test(text)) score += 1;
  return score >= 3 || (score >= 2 && text.length >= 400);
}

/** 从用户消息中提取待解析的简历正文（对话粘贴导入 fast path） */
function extractPasteImportResumeText(text: string): string | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  for (const pattern of PASTE_IMPORT_EXPLICIT_RES) {
    const explicitMatch = trimmed.match(pattern);
    if (explicitMatch?.[1]?.trim()) {
      const body = explicitMatch[1].trim();
      return body.length >= 50 ? body : null;
    }
  }

  if (trimmed.length < 200) return null;
  if (
    /^(?:帮我|请)?(?:优化|润色|改写|诊断|分析|读取|查看|显示)/i.test(trimmed)
  ) {
    return null;
  }
  // resume-like 的长文本明显是「粘贴的简历正文」，哪怕正文里含「创建简历/生成简历」
  // 这类词（例如把本项目介绍整段粘进来），也应优先走粘贴导入，避免被意图词误判成创建意图。
  if (isResumeLikePasteText(trimmed)) return trimmed;
  if (isSelectExistingResumeIntentText(trimmed)) return null;
  if (isCreateResumeIntentText(trimmed)) return null;
  return null;
}

function resolveImportedResumeDisplayName(data: Record<string, unknown>): string {
  const contact = (data.contact || {}) as Record<string, unknown>;
  return (
    toText(data.name) ||
    toText((data.basic as Record<string, unknown> | undefined)?.name) ||
    toText(contact.name) ||
    "导入的简历"
  );
}

const CREATE_RESUME_GUIDE_TEXT = `好，把你的情况说给我就行 👇 这几个方面想说哪个说哪个（不用全说）：

- **教育经历**：学校、专业、学历、时间
- **实习经历**：公司、岗位、做了什么
- **项目经历**：项目名、你的角色、成果
- **个人经历**：竞赛、开源、社团等
- **自我评价**：技能亮点、求职意向

可以**一次性全发**给我、也可以**一段段拆开**给、或者先说一项（比如「我的教育经历是……」）。有现成的简历文字、直接粘进来也行。`;

const GREETING_CREATE_RESUME_GUIDANCE =
  "你好 👋 我是 coco、你的简历助手。下面选一个快速开始、或者直接打字告诉我你想做什么。";

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

// 简历导入/解析成功卡片下方的「下一步」建议 chip（点击即发送）。
// 首位放整份优化：导入 → 一键整份优化 → 全部应用，是最短的价值闭环。
const IMPORT_NEXT_STEP_SUGGESTIONS = [
  "优化我的整份简历",
  "按目标岗位 JD 帮我改简历",
  "帮我把经历写得更专业",
];

// ============================================================================
// 主页面组件
// ============================================================================

export default function CocoChat() {
  if (!isAgentEnabled()) {
    return null;
  }
  return <CocoChatContent />;
}

function CocoChatContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const { user, isAuthenticated, openModal } = useAuth();
  const { apiBaseUrl } = useEnvironment();
  const loginPromptedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      loginPromptedRef.current = false;
      return;
    }
    if (loginPromptedRef.current) return;
    loginPromptedRef.current = true;
    openModal("login");
  }, [isAuthenticated, openModal]);
  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => {
    const token = localStorage.getItem("auth_token");
    return token
      ? { ...extra, Authorization: `Bearer ${token}` }
      : { ...extra };
  }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
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
  // 应用优化后短暂高亮预览面板（结果直接可见：引导视线看右侧更新）
  const [previewJustUpdated, setPreviewJustUpdated] = useState(false);
  const previewPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // 从编辑页带 resumeId 跳来时，暂存待选择的简历，弹「继续编辑 / 开启新会话」选择
  const [carryResumePrompt, setCarryResumePrompt] = useState<SavedResume | null>(null);
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
  const {
    pendingPatches,
    pushPatch,
    patchAppliedAt,
    supersedePendingPatches,
    rebindCurrentPatches,
    setResume,
  } = useResumeContext();
  const [generatedResume, setGeneratedResume] = useState<{
    resume: any; summary: string
  } | null>(null);
  // Track current assistant message ID for patch association
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  // When resume_patch events are received, skip the old cv_editor_agent edit diff path
  const hasPatchInCurrentStreamRef = useRef(false);

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

  // 初始化会话：仅首次进入页面时执行；有 sessionId 用指定会话，否则默认加载最新会话
  useEffect(() => {
    if (hasBootstrappedSessionRef.current) {
      return;
    }

    let mounted = true;
    const params = new URLSearchParams(location.search);
    const explicitSessionId = params.get("sessionId");
    const hasExplicitId = !!explicitSessionId?.trim();
    const token = localStorage.getItem("auth_token");
    const forceNew = (location.state as { forceNew?: number } | null)?.forceNew;
    // 从首页 hero 输入框进入（fromHome）时，也跳过「加载最近会话」，直接开一个新对话。
    const fromHome = (location.state as { fromHome?: number } | null)?.fromHome;

    if (forceNew || fromHome || isCreatingNewSessionRef.current) {
      hasBootstrappedSessionRef.current = true;
      setInitialSessionResolved(true);
      return () => {
        mounted = false;
      };
    }

    if (hasExplicitId) {
      const sid = explicitSessionId!.trim();
      setConversationId(sid);
      hasBootstrappedSessionRef.current = true;
      setInitialSessionResolved(true);
      return () => {
        mounted = false;
      };
    }

    if (!token) {
      hasBootstrappedSessionRef.current = true;
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
          return;
        }
        if (resp.status === 404) {
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
          if (latestId && !isCreatingNewSessionRef.current) {
            setConversationId(latestId);
            navigate(`/agent/new?sessionId=${latestId}`, { replace: true });
          }
        }
      } catch (error) {
        console.error("[AgentChat] Failed to bootstrap latest session:", error);
      } finally {
        if (mounted) {
          hasBootstrappedSessionRef.current = true;
          setInitialSessionResolved(true);
        }
      }
    };

    void bootstrapLatestSession();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, getAuthHeaders, navigate, location.search, location.state]);

  // 简历选择器状态
  const [showResumeSelector, setShowResumeSelector] = useState(false);
  // 「按 JD 优化简历」交互卡（从首页 chip 进入时打开）
  const [showJdCard, setShowJdCard] = useState(false);
  // 问候 fast-path 的意图引导胶囊（替代旧的 ResumeSelector 大卡）
  const [showGreetingChips, setShowGreetingChips] = useState(false);
  // ResumeSelector 打开时的初始步骤（「选择已有」直达列表，其余从入口卡片进）
  const [resumeSelectorInitialStep, setResumeSelectorInitialStep] = useState<
    "entry" | "existing"
  >("entry");
  const [aiImportModalOpen, setAiImportModalOpen] = useState(false);
  const currentRunUserInputRef = useRef("");
  const [pendingResumeInput, setPendingResumeInput] = useState<string>(""); // 暂存用户输入，选择简历后继续处理
  const resumeDataRef = useRef<ResumeData | null>(null);

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isPasteImporting, setIsPasteImporting] = useState(false);
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
  const hasBootstrappedSessionRef = useRef(false);
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

  const pdfRenderAbortRef = useRef<AbortController | null>(null);
  const pdfLoadingRef = useRef<Set<string>>(new Set());

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
      const resumeId = resumeEntry.id;

      if (!force && pdfLoadingRef.current.has(resumeId)) {
        console.log(
          "[DEBUG] renderResumePdfPreview skipped (already loading via ref)",
        );
        return;
      }
      if (!force && resumePdfPreview[resumeId]?.blob) {
        console.log(
          "[DEBUG] renderResumePdfPreview skipped (already has blob)",
        );
        return;
      }

      pdfLoadingRef.current.add(resumeId);
      pdfRenderAbortRef.current?.abort();
      const abortController = new AbortController();
      pdfRenderAbortRef.current = abortController;
      const renderTimeoutMs = 120_000;
      const timeoutId = window.setTimeout(() => {
        abortController.abort();
      }, renderTimeoutMs);

      try {
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
            source: "CocoChat.renderResumePdfPreview",
            trigger: force ? "manual-retry" : "auto-effect",
            signal: abortController.signal,
          },
        );

        updateResumePdfState(resumeEntry.id, {
          blob,
          loading: false,
          progress: "",
          error: null,
        });
      } catch (error) {
        const aborted =
          error instanceof Error && error.name === "AbortError";
        updateResumePdfState(resumeEntry.id, {
          blob: null,
          loading: false,
          progress: "",
          error: aborted
            ? "PDF 渲染超时或已取消，请点击重新渲染。"
            : error instanceof Error
              ? error.message
              : "PDF 渲染失败，请稍后重试。",
        });
      } finally {
        window.clearTimeout(timeoutId);
        pdfLoadingRef.current.delete(resumeId);
        if (pdfRenderAbortRef.current === abortController) {
          pdfRenderAbortRef.current = null;
        }
      }
    },
    [
      updateResumePdfState,
      resumePdfPreview,
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
      const text = currentRunUserInputRef.current.trim();
      if (isCreateResumeIntentText(text)) {
        return;
      }
      if (text) {
        setPendingResumeInput(text);
      }
      setResumeError(null);
      setResumeSelectorInitialStep("entry");
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
    upsertResumeEditDiff: (messageId: string, data: ResumeEditDiffStructuredData) => {
      if (hasPatchInCurrentStreamRef.current) {
        console.log("[AgentChat] Skipping old editDiff — resume_patch path is active");
        return;
      }
      upsertResumeEditDiff(messageId, data);
    },
    upsertDiagnosisToolEvent,
    applyResumeEditDiff: (data: ResumeEditDiffStructuredData) => {
      if (hasPatchInCurrentStreamRef.current) {
        console.log("[AgentChat] Skipping old applyEditDiff — resume_patch path is active");
        return;
      }
      applyResumeEditDiff(data);
    },
  });

  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem("agent_model") || DEFAULT_AGENT_MODEL,
  );
  const handleModelChange = useCallback((m: string) => {
    setSelectedModel(m);
    try {
      localStorage.setItem("agent_model", m);
    } catch {
      /* ignore */
    }
  }, []);

  const {
    currentThought,
    currentAnswer,
    isProcessing,
    lastError,
    answerCompleteCount,
    sendMessage,
    finalizeStream,
  } = useCLTP({
    conversationId,
    baseUrl: apiBaseUrl,
    heartbeatTimeout: SSE_HEARTBEAT_TIMEOUT,
    resumeData: normalizedResume,
    model: selectedModel,
    onSSEEvent: useCallback((event: SSEEvent) => {
      // Intercept resume_patch and resume_generated events before routing
      if ((event as any).type === 'resume_patch') {
        hasPatchInCurrentStreamRef.current = true;
        const outerData = (event as any).data ?? {}
        const patch = outerData.data ?? outerData
        pushPatch({
          patch_id:   patch.patch_id   ?? `patch-${Date.now()}`,
          // 与 resumeEditDiffs 一致，用 'current' 标记当前流式消息，
          // finalize 时再通过 rebindCurrentPatches 绑定到真实 message_id。
          message_id: 'current',
          paths:      patch.paths      ?? [],
          before:     patch.before     ?? {},
          after:      patch.after      ?? {},
          summary:    patch.summary    ?? '',
          operation:  patch.operation  ?? 'set',
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

  // 停止生成：通知后端中止当前流，并立即结束本地流式状态。
  // 必须定义在 useCLTP 之后——deps 里的 finalizeStream 在其上方会触发 TDZ（生产构建崩溃）。
  const handleStopGeneration = useCallback(() => {
    const sid = currentSessionId || conversationId;
    if (sid) {
      void fetch(`${apiBaseUrl}/api/agent/stream/stop/${sid}`, {
        method: "POST",
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    finalizeStream();
  }, [apiBaseUrl, getAuthHeaders, currentSessionId, conversationId, finalizeStream]);

  // 保存会话ID到 localStorage
  useEffect(() => {
    if (conversationId && typeof window !== "undefined") {
      const lastSessionKey = `last_session_${window.location.pathname}`;
      localStorage.setItem(lastSessionKey, conversationId);
    }
  }, [conversationId]);

  // 🔧 持久化 UI 预览状态（简历、报告等）
  useEffect(() => {
    // 所有会话（含前端生成的 conv-xxx）都持久化右侧简历展示状态，
    // 这样切走再切回同一会话时能恢复"正在展示的简历"，而不是变空白。
    if (!conversationId) return;
    // 空状态不持久化：切换会话时 loadSession 会先清空右侧（selectedResumeId=null、loadedResumes=[]），
    // 而此刻 conversationId 仍是上一个会话，若覆盖写入就会把上个会话已存的简历展示态抹成空，
    // 导致切回来简历消失。所以没有简历可存时直接跳过。
    if (!selectedResumeId && loadedResumes.length === 0) return;

    const uiState = {
      selectedResumeId,
      loadedResumes: loadedResumes.map((r) => ({
        id: r.id,
        name: r.name,
        messageId: r.messageId,
        resumeData: r.resumeData, // 右侧 PDF 预览渲染需要
      })),
      diagnosisToolEvents,
    };
    try {
      localStorage.setItem(`ui_state:${conversationId}`, JSON.stringify(uiState));
    } catch (e) {
      // localStorage 超限等：忽略，不影响主流程
      console.warn("[AgentChat] 持久化 UI 状态失败:", e);
    }
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
          // 从编辑页带 resumeId 过来：先不自动落地，弹选择让用户决定
          // 「继续编辑这份」还是「开启新会话」（见空态区选择卡片）。
          setCarryResumePrompt(resume);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (resumeData) {
      setResume(resumeData);
    }
  }, [resumeData, setResume]);

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
          const op = inferPatchOperation(patch);
          updated = applyPatchPaths(updated, patch.paths, patch.after, op) as ResumeData;
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
            const op = inferPatchOperation(patch);
            updated = applyPatchPaths(updated, patch.paths, patch.after, op) as ResumeData;
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
    // 结果直接可见：短暂高亮预览面板，引导视线看右侧刚更新
    setPreviewJustUpdated(true);
    if (previewPulseTimerRef.current) clearTimeout(previewPulseTimerRef.current);
    previewPulseTimerRef.current = setTimeout(() => setPreviewJustUpdated(false), 1600);
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
          setResume(resumeDataWithMeta as ResumeData);
          setLoadedResumes((prev) => {
            const targetId = selectedResumeId || resumeId;
            if (!targetId) return prev;
            const exists = prev.some((item) => item.id === targetId);
            if (!exists) return prev;
            return prev.map((item) =>
              item.id === targetId
                ? { ...item, resumeData: resumeDataWithMeta as ResumeData }
                : item,
            );
          });
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
    // 选择器打开时不跟随流式输出滚动，避免页面一直被“拽”到底部
    if (showResumeSelector) return;
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
  }, [messages, currentThought, currentAnswer, isProcessing, showResumeSelector]);

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current !== null) {
        window.clearTimeout(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, []);

  // 打开「展示简历」选择器时滚到对话底部，确保卡片在可视区域内。
  useEffect(() => {
    if (!showResumeSelector) return;
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 120);
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
    // 把当前流式 patch 绑定到这条 finalize 后的 assistant 消息上
    rebindCurrentPatches(uniqueId);

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
    loadedResumes,
    selectedResumeId,
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

  const checkCanCreateSession = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      return true;
    }
    try {
      const resp = await fetch(
        `${apiBaseUrl}/api/agent/history/sessions/list?page=1&page_size=1`,
        { headers: getAuthHeaders() },
      );
      if (!resp.ok) {
        return true;
      }
      const data = await resp.json();
      const limits = parseSessionLimits(data);
      if (!limits.can_create) {
        toast.error(getSessionLimitMessage(limits));
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }, [apiBaseUrl, getAuthHeaders]);

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
            let parsedError: unknown = null;
            try {
              const raw = await resp.clone().text();
              if (raw) {
                try {
                  parsedError = JSON.parse(raw);
                  const parsed = parsedError as {
                    message?: string;
                    detail?: string | { message?: string };
                  };
                  errorDetail =
                    parsed?.message ||
                    (typeof parsed?.detail === "string"
                      ? parsed.detail
                      : parsed?.detail?.message) ||
                    raw;
                } catch {
                  errorDetail = raw;
                }
              }
            } catch {
              // ignore parse errors
            }
            if (isSessionLimitExceededResponse(resp.status, parsedError)) {
              toast.error(getSessionLimitMessage());
              queuedSaveRef.current = null;
              scheduledSaveRef.current = null;
              return;
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

  const resetToBlankSession = useCallback(() => {
    isCreatingNewSessionRef.current = true;
    hasBootstrappedSessionRef.current = true;
    setInitialSessionResolved(true);

    pendingSaveRef.current = false;
    queuedSaveRef.current = null;
    scheduledSaveRef.current = null;
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = null;
    }

    const newId = `conv-${Date.now()}`;
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    lastPersistedCountBySessionRef.current[newId] = 0;
    lastSavedKeyRef.current = "";
    setSelectedResumeId(null);
    setAllowPdfAutoRender(false);
    setLoadedResumes([]);
    setDiagnosisToolEvents([]);
    setSearchResults([]);
    setResumeEditDiffs([]);
    setActiveSearchPanel(null);
    setResumePdfPreview({});
    setResumeError(null);
    finalizeStream();

    navigate("/agent/new", { replace: true });
    window.setTimeout(() => {
      isCreatingNewSessionRef.current = false;
    }, 0);
  }, [finalizeStream, navigate]);

  const deleteSession = async (sessionId: string) => {
    const routeSessionId =
      new URLSearchParams(location.search).get("sessionId")?.trim() || null;
    const isActiveSession =
      sessionId === conversationId ||
      sessionId === currentSessionId ||
      sessionId === routeSessionId;

    if (isActiveSession) {
      pendingSaveRef.current = false;
      queuedSaveRef.current = null;
      scheduledSaveRef.current = null;
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
      }
    }

    try {
      const resp = await fetch(
        `${apiBaseUrl}/api/agent/history/${sessionId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);

      fetch(`${apiBaseUrl}/api/agent/stream/session/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      }).catch(() => undefined);

      try {
        localStorage.removeItem(`ui_state:${sessionId}`);
      } catch {
        // ignore storage errors
      }
      delete lastPersistedCountBySessionRef.current[sessionId];

      refreshSessions();

      if (isActiveSession) {
        resetToBlankSession();
      }
    } catch (error) {
      console.error("[AgentChat] Failed to delete session:", error);
      toast.error("删除会话失败，请稍后重试");
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
    isCreatingNewSessionRef.current = true;
    hasBootstrappedSessionRef.current = true;
    setInitialSessionResolved(true);

    // 先尽量保存当前会话，避免切换后丢失上下文
    saveCurrentSession();
    await waitForPendingSave();

    const canCreate = await checkCanCreateSession();
    if (!canCreate) {
      isCreatingNewSessionRef.current = false;
      return;
    }

    // 确保切换会话前清除任何待保存标记
    pendingSaveRef.current = false;

    const newId = `conv-${Date.now()}`;
    console.log("[AgentChat] Creating new session:", newId);
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    lastPersistedCountBySessionRef.current[newId] = 0;
    lastSavedKeyRef.current = "";
    setSelectedResumeId(null);
    setAllowPdfAutoRender(false);
    setLoadedResumes([]);
    setDiagnosisToolEvents([]);
    setSearchResults([]);
    setResumeEditDiffs([]);
    setActiveSearchPanel(null);
    setResumePdfPreview({});
    finalizeStream();

    navigate("/agent/new", { replace: true });

    window.setTimeout(() => {
      isCreatingNewSessionRef.current = false;
    }, 0);

    // 不再立即持久化空会话，只在用户发送第一条消息时才真正创建并入库
    // 这样可以避免用户点击+按钮后没有输入消息就产生空会话
  }, [
    checkCanCreateSession,
    finalizeStream,
    saveCurrentSession,
    waitForPendingSave,
    navigate,
  ]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (!sessionId) {
        void createNewSession();
        return;
      }
      navigate(`/agent/new?sessionId=${sessionId}`, { replace: true });
    },
    [createNewSession, navigate],
  );

  const handleCreateSession = useCallback(() => {
    void createNewSession();
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
      if (isCreatingNewSessionRef.current) return;
      void loadSession(routeSessionId);
      return;
    }

    if (isCreatingNewSessionRef.current) {
      return;
    }

    // 从历史会话 URL 切回 /agent/new（无 sessionId）时，主动创建空白新会话
    if (!isLoadingSession) {
      if (
        previousRouteSessionId ||
        (currentSessionId && !currentSessionId.startsWith("conv-"))
      ) {
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

  const applyResumeToChat = useCallback(
    async (selectedResume: SavedResume, messageId?: string) => {
      const resolvedUserId =
        user?.id ?? (selectedResume as any).user_id ?? null;
      const rawData = (selectedResume.data || {}) as Record<string, unknown>;
      const normalizedBase = isWorkspaceResumeData(rawData)
        ? (rawData as ResumeData)
        : normalizeImportedResumeToCanonical(rawData as Record<string, any>, {
            resumeId: selectedResume.id,
            title: selectedResume.name,
          });
      const resumeDataWithMeta = {
        ...normalizedBase,
        resume_id: selectedResume.id,
        user_id: resolvedUserId,
        alias: selectedResume.alias,
        _meta: {
          resume_id: selectedResume.id,
          user_id: resolvedUserId,
        },
      } as unknown as ResumeData;

      resumeDataRef.current = resumeDataWithMeta;
      setResumeData(resumeDataWithMeta);

      const linkedMessageId = messageId ?? `resume-select-${Date.now()}`;
      setLoadedResumes((prev) => {
        const nextEntry = {
          id: selectedResume.id,
          name: selectedResume.name,
          messageId: linkedMessageId,
          resumeData: resumeDataWithMeta,
        };
        const filtered = prev.filter((item) => item.id !== selectedResume.id);
        return [...filtered, nextEntry];
      });

      setAllowPdfAutoRender(true);
      setSelectedResumeId(selectedResume.id);
      setShowResumeSelector(false);
      setShowGreetingChips(false);

      // 应用新简历数据后强制重渲 PDF 预览：
      // 粘贴导入 / AI 编辑常是「更新现有简历（同 id）」，selectedResumeId 不变、旧 blob 有缓存，
      // 不 force 的话 renderResumePdfPreview 会命中「already has blob」跳过，导致解析完右侧不刷新（要手动点刷新）。
      void renderResumePdfPreview(
        { id: selectedResume.id, resumeData: resumeDataWithMeta },
        true,
      );

      console.log(
        "[AgentChat] 简历已加载到对话区:",
        selectedResume.id,
        selectedResume.name,
      );
    },
    [user?.id, renderResumePdfPreview],
  );

  // generate_resume 生成的简历：自动落地到右侧预览（生成即所见，复用导入链路）
  useEffect(() => {
    const generated = generatedResume?.resume;
    if (!generated) return;
    void (async () => {
      try {
        const resumeId = `resume_latex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const displayName = resolveImportedResumeDisplayName(
          generated as unknown as Record<string, unknown>,
        );
        const normalized = normalizeImportedResumeToCanonical(
          generated as unknown as Record<string, any>,
          { resumeId, title: `${displayName}的简历` },
        );
        const saved = await saveResume(normalized, resumeId);
        setCurrentResumeId(saved.id);
        await applyResumeToChat(saved);
      } catch (e) {
        console.error("[AgentChat] 生成简历落地预览失败:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedResume]);

  // 处理简历选择
  // 从编辑页带 resumeId 跳来时的选择：继续编辑这份 / 开启新会话
  const handleContinueEditCarry = useCallback(() => {
    if (carryResumePrompt) {
      void applyResumeToChat(carryResumePrompt);
      // 加一条引导消息进入对话态，避免继续停在空态卡片
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: "assistant",
          content: `已加载「${carryResumePrompt.name || "你的简历"}」，右侧可以看到。建议先一键优化整份，或点下方直接开始 👇`,
          timestamp: new Date().toISOString(),
          // 主动给一个主动作（首个为主 CTA），而不是让用户做「想优化哪部分」的选择题
          meta: { suggestions: ["优化整份简历", "帮我体检一下简历", "只优化某一段"] },
        },
      ]);
    }
    setCarryResumePrompt(null);
  }, [carryResumePrompt, applyResumeToChat]);

  const handleStartNewFromCarry = useCallback(() => {
    setCarryResumePrompt(null);
    navigate("/agent/new");
  }, [navigate]);

  const handleResumeSelect = useCallback(
    async (selectedResume: SavedResume) => {
      await applyResumeToChat(selectedResume);

      if (pendingResumeInput.trim() && isProcessing) {
        finalizeStream();
      }
    },
    [applyResumeToChat, pendingResumeInput, isProcessing, finalizeStream],
  );

  // 取消简历选择
  const handleResumeSelectorCancel = useCallback(() => {
    setShowResumeSelector(false);
    setPendingResumeInput("");
  }, []);

  const handleImportResume = useCallback(() => {
    setShowResumeSelector(false);
    setPendingResumeInput("");
    setAiImportModalOpen(true);
  }, []);

  const handleAIImportSave = useCallback(
    async (data: Record<string, unknown>) => {
      setAiImportModalOpen(false);
      setShowResumeSelector(false);
      setPendingResumeInput("");
      try {
        const resumeId = `resume_latex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const displayName = resolveImportedResumeDisplayName(data);
        const normalized = normalizeImportedResumeToCanonical(data, {
          resumeId,
          title: `${displayName}的简历`,
        });
        const saved = await saveResume(normalized, resumeId);
        setCurrentResumeId(saved.id);
        await applyResumeToChat(saved);

        const assistantMsg: Message = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: "assistant",
          content: `已通过 AI 智能导入简历「${saved.name}」，右侧可预览。你可以继续告诉我需要优化哪些内容。`,
          timestamp: new Date().toISOString(),
          meta: {
            importSuccess: {
              name: saved.name,
              suggestions: IMPORT_NEXT_STEP_SUGGESTIONS,
            },
          },
        };
        setMessages((prev) => {
          const updated = [...prev, assistantMsg];
          const validConversationId =
            conversationId?.trim() || currentSessionId || `conv-${Date.now()}`;
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
        setResumeError(null);
      } catch (error) {
        console.error("[AgentChat] AI 导入简历失败:", error);
        setResumeError("AI 导入简历失败，请稍后重试。");
      }
    },
    [
      applyResumeToChat,
      conversationId,
      currentSessionId,
      persistSessionSnapshot,
    ],
  );

  // 导入失败重试：按失败消息 id 存重发闭包（图片/文件路径），点「重试」重发同一份文件
  const importRetryMapRef = useRef<Map<string, () => void>>(new Map());
  const handleImportRetry = useCallback((msgId: string) => {
    const retry = importRetryMapRef.current.get(msgId);
    if (retry) {
      importRetryMapRef.current.delete(msgId);
      retry();
    }
  }, []);

  const importPastedResumeInChat = useCallback(
    async (
      userMessage: string,
      resumeText: string,
      userMessageId: string,
      nextMessages: Message[],
      isFirstMessage: boolean,
      validConversationId: string,
    ) => {
      const parsingMsgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const parseStartedAt = Date.now();
      const parsingAssistantMsg: Message = {
        id: parsingMsgId,
        role: "assistant",
        content: "正在 AI 解析简历内容、请稍候（长文本可能需要几十秒）…",
        timestamp: new Date().toISOString(),
        meta: {
          pasteImportParsing: true,
          parseStartedAt,
        },
      };
      const messagesWithParsing = [...nextMessages, parsingAssistantMsg];
      setMessages(messagesWithParsing);
      await persistSessionSnapshot(
        validConversationId,
        messagesWithParsing,
        isFirstMessage,
      );

      setIsPasteImporting(true);
      setResumeError(null);
      try {
        const parsed = await parseResumeText(apiBaseUrl, resumeText);
        const displayName = resolveImportedResumeDisplayName(parsed);

        const existingResumeId =
          resumeDataRef.current?.id ||
          selectedResumeId ||
          loadedResumes[loadedResumes.length - 1]?.id ||
          null;
        const canUpdateExisting =
          !!existingResumeId &&
          !String(existingResumeId).startsWith("uploaded-pdf-");

        const targetResumeId =
          canUpdateExisting && existingResumeId
            ? String(existingResumeId)
            : `resume_latex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        const normalized = normalizeImportedResumeToCanonical(parsed, {
          resumeId: targetResumeId,
          title: `${displayName}的简历`,
        });
        const saved = await saveResume(normalized, targetResumeId);
        setCurrentResumeId(saved.id);
        await applyResumeToChat(saved, userMessageId);

        const successContent = canUpdateExisting
          ? `已将粘贴内容解析并写入当前简历「${saved.name}」，右侧可预览。如需继续优化某段经历，直接告诉我即可。`
          : `已通过 AI 解析导入简历「${saved.name}」，右侧可预览。你可以继续告诉我需要优化哪些内容。`;

        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === parsingMsgId
              ? {
                  ...msg,
                  content: successContent,
                  timestamp: new Date().toISOString(),
                  meta: {
                    pasteImportParsing: false,
                    parseStartedAt,
                    parseElapsedMs: Date.now() - parseStartedAt,
                    importSuccess: {
                      name: saved.name,
                      suggestions: IMPORT_NEXT_STEP_SUGGESTIONS,
                    },
                  },
                }
              : msg,
          );
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
      } catch (error) {
        console.error("[AgentChat] 对话粘贴导入失败:", error);
        const errText =
          error instanceof Error ? error.message : "简历解析失败，请稍后重试。";
        setResumeError(errText);
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === parsingMsgId
              ? {
                  ...msg,
                  content: `简历解析失败：${errText}。你也可以点击「展示简历」→「导入简历」重试。`,
                  timestamp: new Date().toISOString(),
                  meta: {
                    pasteImportParsing: false,
                    parseStartedAt,
                    parseElapsedMs: Date.now() - parseStartedAt,
                  },
                }
              : msg,
          );
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
      } finally {
        setIsPasteImporting(false);
      }
    },
    [
      apiBaseUrl,
      applyResumeToChat,
      loadedResumes,
      persistSessionSnapshot,
      selectedResumeId,
    ],
  );

  // 图片简历导入：镜像粘贴文本导入链路——先进入对话并显示解析动画，
  // 走视觉识别接口解析后落地渲染右侧预览，全程不发给 Agent、不做诊断分析。
  const importResumeImagesInChat = useCallback(
    async (userMessage: string, imageFiles: File[]) => {
      const picked = imageFiles.slice(0, 2);
      const skipped = imageFiles.length - picked.length;

      // 用户消息（带图片缩略图），立即进入对话视图
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const attachmentMeta = picked.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      }));
      const userMessageEntry: Message = {
        id: uniqueId,
        role: "user",
        content: userMessage.trim() || "解析这份简历图片",
        timestamp: new Date().toISOString(),
        attachments: attachmentMeta,
      };
      const nextMessages = [...messages, userMessageEntry];
      const isFirstMessage = messages.length === 0;
      setMessages(nextMessages);
      setShowGreetingChips(false);

      let validConversationId = conversationId;
      if (!validConversationId || validConversationId.trim() === "") {
        validConversationId = `conv-${Date.now()}`;
        setConversationId(validConversationId);
      }
      if (!currentSessionId) {
        setCurrentSessionId(validConversationId);
      }
      if (isFirstMessage) {
        await persistSessionSnapshot(validConversationId, nextMessages, true);
      }

      // 解析动画消息
      const parsingMsgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const parseStartedAt = Date.now();
      const parsingAssistantMsg: Message = {
        id: parsingMsgId,
        role: "assistant",
        content: "正在识别图片中的简历内容、请稍候（约十几秒）…",
        timestamp: new Date().toISOString(),
        meta: { pasteImportParsing: true, parseStartedAt },
      };
      const messagesWithParsing = [...nextMessages, parsingAssistantMsg];
      setMessages(messagesWithParsing);
      await persistSessionSnapshot(
        validConversationId,
        messagesWithParsing,
        isFirstMessage,
      );

      setIsPasteImporting(true);
      setResumeError(null);

      // 右侧预览进入识别态
      const resumeEntryId = `resume_latex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      updateResumePdfState(resumeEntryId, {
        loading: true,
        progress: "正在识别图片中的简历内容...",
        error: null,
      });
      setAllowPdfAutoRender(true);
      setSelectedResumeId(resumeEntryId);

      try {
        const formData = new FormData();
        picked.forEach((file) => formData.append("files", file));
        formData.append("model", "glm-ocr");

        const response = await fetch(`${apiBaseUrl}/api/resume/upload-image`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          const detail =
            errBody && typeof errBody.detail === "string"
              ? errBody.detail
              : `图片识别失败（${response.status}）`;
          throw new Error(detail);
        }

        const data = await response.json();
        const parsedResume = data?.resume;
        if (!parsedResume || typeof parsedResume !== "object") {
          throw new Error("未识别出结构化简历内容，请换更清晰的图片重试。");
        }

        const displayName = resolveImportedResumeDisplayName(parsedResume);
        const canonical = normalizeImportedResumeToCanonical(parsedResume, {
          resumeId: resumeEntryId,
          title: `${displayName}的简历`,
        });
        const saved = await saveResume(canonical, resumeEntryId);
        setCurrentResumeId(saved.id);
        await applyResumeToChat(saved, uniqueId);

        const successContent =
          `已识别并导入简历「${saved.name}」，右侧可预览。你可以继续告诉我要优化哪些内容。` +
          (skipped > 0
            ? `（一次最多解析 2 张，已忽略多余 ${skipped} 张）`
            : "");
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === parsingMsgId
              ? {
                  ...msg,
                  content: successContent,
                  timestamp: new Date().toISOString(),
                  meta: {
                    pasteImportParsing: false,
                    parseStartedAt,
                    parseElapsedMs: Date.now() - parseStartedAt,
                    importSuccess: {
                      name: saved.name,
                      suggestions: IMPORT_NEXT_STEP_SUGGESTIONS,
                    },
                  },
                }
              : msg,
          );
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
      } catch (error) {
        console.error("[AgentChat] 图片简历识别失败:", error);
        const errText =
          error instanceof Error ? error.message : "图片识别失败，请稍后重试。";
        setResumeError(errText);
        updateResumePdfState(resumeEntryId, {
          loading: false,
          progress: "",
          error: errText,
        });
        // 存重试闭包：重发同一批图片，失败不静默、一键可重试
        importRetryMapRef.current.set(parsingMsgId, () => {
          void importResumeImagesInChat(userMessage, picked);
        });
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === parsingMsgId
              ? {
                  ...msg,
                  content: `图片识别失败：${errText}`,
                  timestamp: new Date().toISOString(),
                  meta: {
                    pasteImportParsing: false,
                    parseStartedAt,
                    parseElapsedMs: Date.now() - parseStartedAt,
                    importRetry: true,
                  },
                }
              : msg,
          );
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
      } finally {
        setIsPasteImporting(false);
      }
    },
    [
      apiBaseUrl,
      messages,
      conversationId,
      currentSessionId,
      persistSessionSnapshot,
      applyResumeToChat,
      updateResumePdfState,
      setAllowPdfAutoRender,
      setSelectedResumeId,
    ],
  );

  // 纯解析导入简历文件（PDF 走 /api/resume/upload-pdf，图片委托图片链路）——只解析入库并加载到会话，
  // 全程不发给 Agent、不做优化分析。给「按 JD 优化简历」卡的第一步用。
  const importResumeFileInChat = useCallback(
    async (file: File) => {
      if (file.type.startsWith("image/")) {
        await importResumeImagesInChat("解析这份简历", [file]);
        return;
      }
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const userMessageEntry: Message = {
        id: uniqueId,
        role: "user",
        content: "解析这份简历",
        timestamp: new Date().toISOString(),
        attachments: [{ name: file.name, type: file.type, size: file.size }],
      };
      const nextMessages = [...messages, userMessageEntry];
      const isFirstMessage = messages.length === 0;
      setMessages(nextMessages);

      let validConversationId = conversationId;
      if (!validConversationId || validConversationId.trim() === "") {
        validConversationId = `conv-${Date.now()}`;
        setConversationId(validConversationId);
      }
      if (!currentSessionId) setCurrentSessionId(validConversationId);

      const parsingMsgId = `${Date.now()}-p`;
      const parseStartedAt = Date.now();
      const parsingMsg: Message = {
        id: parsingMsgId,
        role: "assistant",
        content: "正在解析简历文件、请稍候…",
        timestamp: new Date().toISOString(),
        meta: { pasteImportParsing: true, parseStartedAt },
      };
      const withParsing = [...nextMessages, parsingMsg];
      setMessages(withParsing);
      await persistSessionSnapshot(validConversationId, withParsing, isFirstMessage);

      setIsPasteImporting(true);
      setResumeError(null);
      const resumeEntryId = `resume_file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      updateResumePdfState(resumeEntryId, {
        loading: true,
        progress: "正在解析简历内容...",
        error: null,
      });
      setAllowPdfAutoRender(true);
      setSelectedResumeId(resumeEntryId);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${apiBaseUrl}/api/resume/upload-pdf`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          const detail =
            errBody && typeof errBody.detail === "string"
              ? errBody.detail
              : `简历解析失败（${response.status}）`;
          throw new Error(detail);
        }
        const data = await response.json();
        const parsedResume = data?.resume;
        if (!parsedResume || typeof parsedResume !== "object") {
          throw new Error("未解析出结构化简历内容，请换 PDF 或改用「粘贴简历文本」。");
        }
        const displayName = resolveImportedResumeDisplayName(parsedResume);
        const canonical = normalizeImportedResumeToCanonical(parsedResume, {
          resumeId: resumeEntryId,
          title: `${displayName}的简历`,
        });
        const saved = await saveResume(canonical, resumeEntryId);
        setCurrentResumeId(saved.id);
        await applyResumeToChat(saved, uniqueId);
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === parsingMsgId
              ? {
                  ...msg,
                  content: `已解析导入简历「${saved.name}」，右侧可预览。`,
                  timestamp: new Date().toISOString(),
                  meta: {
                    pasteImportParsing: false,
                    parseStartedAt,
                    parseElapsedMs: Date.now() - parseStartedAt,
                    importSuccess: {
                      name: saved.name,
                      suggestions: IMPORT_NEXT_STEP_SUGGESTIONS,
                    },
                  },
                }
              : msg,
          );
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
      } catch (error) {
        console.error("[AgentChat] 简历文件解析失败:", error);
        const errText =
          error instanceof Error ? error.message : "简历解析失败，请稍后重试。";
        setResumeError(errText);
        updateResumePdfState(resumeEntryId, { loading: false, progress: "", error: errText });
        // 存重试闭包：重发同一份文件，失败不静默、一键可重试
        importRetryMapRef.current.set(parsingMsgId, () => {
          void importResumeFileInChat(file);
        });
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === parsingMsgId
              ? {
                  ...msg,
                  content: `简历解析失败：${errText}`,
                  timestamp: new Date().toISOString(),
                  meta: {
                    pasteImportParsing: false,
                    parseStartedAt,
                    parseElapsedMs: Date.now() - parseStartedAt,
                    importRetry: true,
                  },
                }
              : msg,
          );
          void persistSessionSnapshot(validConversationId, updated, false);
          return updated;
        });
      } finally {
        setIsPasteImporting(false);
      }
    },
    [
      apiBaseUrl,
      messages,
      conversationId,
      currentSessionId,
      persistSessionSnapshot,
      applyResumeToChat,
      updateResumePdfState,
      setAllowPdfAutoRender,
      setSelectedResumeId,
      importResumeImagesInChat,
    ],
  );

  const handleCreateResume = useCallback(() => {
    setShowResumeSelector(false);
    setPendingResumeInput("");
    const assistantMsg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "assistant",
      content: CREATE_RESUME_GUIDE_TEXT,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => {
      const updated = [...prev, assistantMsg];
      const validConversationId =
        conversationId?.trim() || currentSessionId || `conv-${Date.now()}`;
      void persistSessionSnapshot(validConversationId, updated, prev.length === 0);
      return updated;
    });
    setShowGreetingChips(false);
    setResumeError(null);
  }, [conversationId, currentSessionId, persistSessionSnapshot]);

  const sendUserTextMessage = useCallback(
    async (
      userMessage: string,
      attachments?: File[],
      resumeDataOverride?: ResumeData | null,
    ) => {
      if (
        (!userMessage.trim() && (!attachments || attachments.length === 0)) ||
        isProcessing ||
        isPasteImporting
      )
        return;

      const trimmedMessage = userMessage.trim();
      // 任何真实发送都先收起问候引导胶囊；命中问候 fast-path 时下方会重新打开
      setShowGreetingChips(false);
      const pasteResumeText =
        !attachments || attachments.length === 0
          ? extractPasteImportResumeText(trimmedMessage)
          : null;

      // 粘贴导入优先于 Agent：走 /api/resume/parse 全量结构化
      if (pasteResumeText) {
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

        let validConversationId = conversationId;
        if (!validConversationId || validConversationId.trim() === "") {
          validConversationId = `conv-${Date.now()}`;
          setConversationId(validConversationId);
        }
        if (!currentSessionId) {
          setCurrentSessionId(validConversationId);
        }
        if (isFirstMessage) {
          await persistSessionSnapshot(
            validConversationId,
            nextMessages,
            true,
          );
        }

        await importPastedResumeInChat(
          userMessage,
          pasteResumeText,
          uniqueId,
          nextMessages,
          isFirstMessage,
          validConversationId,
        );
        return;
      }

      // 发送普通消息时关闭选择器，避免与流式回复叠在一起并反复触发滚动
      if (!isSelectExistingResumeIntentText(trimmedMessage)) {
        setShowResumeSelector(false);
      }

      if (
        isCreateResumeIntentText(trimmedMessage) &&
        (!attachments || attachments.length === 0)
      ) {
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

        let validConversationId = conversationId;
        if (!validConversationId || validConversationId.trim() === "") {
          validConversationId = `conv-${Date.now()}`;
          setConversationId(validConversationId);
        }
        if (!currentSessionId) {
          setCurrentSessionId(validConversationId);
        }
        const assistantMsg: Message = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: "assistant",
          content: CREATE_RESUME_GUIDE_TEXT,
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...nextMessages, assistantMsg];
        setMessages(finalMessages);
        setShowGreetingChips(false);
        await persistSessionSnapshot(
          validConversationId,
          finalMessages,
          isFirstMessage,
        );
        setResumeError(null);
        return;
      }

      const hasResumeContext =
        !!resumeDataRef.current ||
        loadedResumes.some((item) => !!item.resumeData);

      if (
        isGreetingOnlyText(trimmedMessage) &&
        (!attachments || attachments.length === 0) &&
        !hasResumeContext
      ) {
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

        let validConversationId = conversationId;
        if (!validConversationId || validConversationId.trim() === "") {
          validConversationId = `conv-${Date.now()}`;
          setConversationId(validConversationId);
        }
        if (!currentSessionId) {
          setCurrentSessionId(validConversationId);
        }

        const assistantMsg: Message = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: "assistant",
          content: GREETING_CREATE_RESUME_GUIDANCE,
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...nextMessages, assistantMsg];
        setMessages(finalMessages);
        setShowGreetingChips(true);
        await persistSessionSnapshot(
          validConversationId,
          finalMessages,
          isFirstMessage,
        );
        setResumeError(null);
        return;
      }

      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      currentRunUserInputRef.current = userMessage.trim();
      hasPatchInCurrentStreamRef.current = false;
      // 新一轮消息开始：把上一轮未处理的 pending patch 标记为 superseded
      supersedePendingPatches();
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
      loadedResumes,
      importPastedResumeInChat,
      isPasteImporting,
    ],
  );

  // 首页 hero 输入框带来的第一条消息：会话就绪后自动发出一次。
  // 复用 sendUserTextMessage（其内部会自动识别粘贴的简历文本并走解析），不新建平行链路。
  // 必须放在 sendUserTextMessage 定义之后，否则依赖数组会在 TDZ 中访问它而报错。
  // 优化对比卡收尾：本批全部处理完（无 pending）且至少应用了一处 → 插入收尾卡（下载 PDF / 去编辑器）
  const prevPendingCountRef = useRef(0);
  useEffect(() => {
    const pendingCount = pendingPatches.filter((p) => p.status === "pending").length;
    const appliedCount = pendingPatches.filter((p) => p.status === "applied").length;
    if (prevPendingCountRef.current > 0 && pendingCount === 0 && appliedCount > 0) {
      const doneMsg: Message = {
        id: `${Date.now()}-apply-done`,
        role: "assistant",
        content: `已应用 ${appliedCount} 处优化，右侧预览已更新。可以下载 PDF，或去编辑器精修排版。`,
        timestamp: new Date().toISOString(),
        meta: { applyDone: { count: appliedCount } },
      };
      setMessages((prev) => {
        const updated = [...prev, doneMsg];
        const sid = conversationId?.trim() || currentSessionId;
        if (sid) void persistSessionSnapshot(sid, updated, false);
        return updated;
      });
    }
    prevPendingCountRef.current = pendingCount;
  }, [pendingPatches, conversationId, currentSessionId, persistSessionSnapshot]);

  const heroInitialConsumedRef = useRef(false);
  useEffect(() => {
    if (heroInitialConsumedRef.current || !initialSessionResolved) return;
    const fromHome = (location.state as { fromHome?: number } | null)?.fromHome;
    if (!fromHome) return;
    const openJd = sessionStorage.getItem("agent_open_jd_card") === "1";
    const pending = sessionStorage.getItem("agent_initial_text") || "";
    const hasImages = hasHeroHandoffImages();
    if (!openJd && !pending && !hasImages) return;
    if (
      isProcessing ||
      isPasteImporting ||
      isCreatingNewSessionRef.current ||
      messages.length > 0
    )
      return;
    heroInitialConsumedRef.current = true;
    sessionStorage.removeItem("agent_initial_text");
    if (openJd) {
      // 首页「按 JD 改简历」chip：先落成一轮对话（用户消息 + AI 引导回复），
      // 再在下方弹出 JD 优化交互卡——避免停在空态首页、卡片突兀浮底。
      sessionStorage.removeItem("agent_open_jd_card");
      const ts = Date.now();
      const jdMessages: Message[] = [
        {
          id: `${ts}-jd-q`,
          role: "user",
          content: "按目标岗位 JD 帮我改简历",
          timestamp: new Date().toISOString(),
        },
        {
          id: `${ts}-jd-a`,
          role: "assistant",
          content:
            "好的！请把你的简历和目标岗位的 JD（职位描述）发我，我来帮你逐条对齐、重写亮点、补齐匹配关键词 👇",
          timestamp: new Date().toISOString(),
        },
      ];
      setMessages(jdMessages);
      const jdConvId =
        conversationId?.trim() || currentSessionId || `conv-${ts}`;
      if (!conversationId) setConversationId(jdConvId);
      if (!currentSessionId) setCurrentSessionId(jdConvId);
      void persistSessionSnapshot(jdConvId, jdMessages, true);
      setShowJdCard(true);
      return;
    }
    if (hasImages) {
      // 首页粘贴的简历截图：复用图片解析链路（进对话 + 解析动画 + 渲染，不发 Agent、不诊断）
      void importResumeImagesInChat(pending || "解析这份简历", takeHeroHandoffImages());
    } else {
      void sendUserTextMessage(pending);
    }
  }, [
    initialSessionResolved,
    location.state,
    isProcessing,
    isPasteImporting,
    messages.length,
    sendUserTextMessage,
    importResumeImagesInChat,
  ]);

  const submitMessageWithAttachments = useCallback(
    async (userMessage: string, attachmentsToProcess: File[]) => {
      setResumeError(null);
      setIsUploadingFile(true);
      try {
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
        setResumeError(
          error instanceof Error ? error.message : "文件上传失败，请稍后重试",
        );
        throw error;
      } finally {
        setIsUploadingFile(false);
      }
    },
    [
      apiBaseUrl,
      user?.id,
      sendUserTextMessage,
      updateResumePdfState,
      setResumeData,
      setLoadedResumes,
      setAllowPdfAutoRender,
      setSelectedResumeId,
    ],
  );

  const handleFillCreateResumePrompt = useCallback(() => {
    handleCreateResume();
  }, [handleCreateResume]);

  const addAttachmentFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPendingAttachments((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const unique = files.filter(
        (file) =>
          !existingKeys.has(
            `${file.name}-${file.size}-${file.lastModified}`,
          ),
      );
      return [...prev, ...unique];
    });
  }, []);

  const handleUploadFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      if (selectedFiles.length === 0) return;
      if (isProcessing) {
        toast.error("当前正在处理消息，请稍后再上传。");
        event.target.value = "";
        return;
      }
      addAttachmentFiles(selectedFiles);
      event.target.value = "";
    },
    [isProcessing, addAttachmentFiles],
  );

  // 截图 / 剪贴板图片粘贴进输入框：作为简历图片附件收下，发送时统一走图片识别链路
  const handlePasteFiles = useCallback(
    (files: File[]) => {
      if (isProcessing) return;
      addAttachmentFiles(files);
    },
    [isProcessing, addAttachmentFiles],
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
  // ——「按 JD 优化简历」交互卡回调 ——
  // 卡内上传简历文件：只解析入库、加载到会话，全程不发 Agent（点「开始优化」才优化）
  const handleJdCardUploadResume = useCallback(
    (file: File) => {
      if (isProcessing || isPasteImporting || isUploadingFile) return;
      void importResumeFileInChat(file);
    },
    [isProcessing, isPasteImporting, isUploadingFile, importResumeFileInChat],
  );

  // 卡内粘贴简历文本：sendUserTextMessage 内部会自动识别为粘贴简历并走 /api/resume/parse 解析导入
  const handleJdCardPasteResume = useCallback(
    (text: string) => {
      if (!text.trim() || isProcessing || isPasteImporting) return;
      void sendUserTextMessage(text);
    },
    [isProcessing, isPasteImporting, sendUserTextMessage],
  );

  // 简历已在 context + JD 已给：让 Agent 按 JD 逐条优化（走已补的「按 JD 改简历（已有简历）」prompt 脚本）
  const handleJdCardStartOptimize = useCallback(
    (jdText: string) => {
      if (!jdText.trim()) return;
      setShowJdCard(false);
      void sendUserTextMessage(
        `我的目标岗位 JD 如下，请对照它逐条优化我的整份简历：重写各段经历、突出与 JD 匹配的技能与成果、补齐缺失的关键词。\n\n【目标岗位 JD】\n${jdText.trim()}`,
      );
    },
    [sendUserTextMessage],
  );

  // 收尾卡：下载当前右侧预览的 PDF；预览还没生成时给提示
  const handleDownloadPdf = useCallback(() => {
    const preview = selectedResumeId ? resumePdfPreview[selectedResumeId] : null;
    const blob = preview?.blob;
    if (!blob) {
      toast("右侧 PDF 预览生成后即可下载，稍等片刻再点");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resumeData?.basic?.name || "简历"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedResumeId, resumePdfPreview, resumeData]);

  // 收尾卡：去编辑器精修（当前简历已通过 setCurrentResumeId 记录，编辑器会加载它）
  const handleGoEditor = useCallback(() => {
    navigate("/workspace/latex");
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!trimmedInput && !hasAttachments) || isProcessing || isUploadingFile || isPasteImporting)
      return;

    // 每轮新消息开始前清理可能残留的状态

    // 清除之前的错误
    setResumeError(null);

    const userMessage = formatChatInput(trimmedInput);
    const attachmentsToProcess = pendingAttachments;
    setInput("");
    setPendingAttachments([]);
    try {
      if (!hasAttachments) {
        await sendUserTextMessage(userMessage);
        return;
      }

      // 图片附件走「解析导入」链路（进对话 + 解析动画 + 展示，不发 Agent）；
      // 其余（PDF / 文本）仍交给 Agent 处理。
      const imageAttachments = attachmentsToProcess.filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageAttachments.length > 0) {
        await importResumeImagesInChat(userMessage, imageAttachments);
        return;
      }

      await submitMessageWithAttachments(userMessage, attachmentsToProcess);
    } catch (error) {
      console.error("[AgentChat] Failed to send message:", error);
      setPendingAttachments(attachmentsToProcess);
    }
  };

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      // 输入法 composing 期间（如中文选词按 Enter 确认）不提交
      if (event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      if (!input.trim() || isProcessing || isPasteImporting) {
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

  const activeSessionId = currentSessionId || conversationId;

  // 空态（无消息、非处理中、非简历选择器）：参考 Manus 把输入框居中展示，
  // 输入框移进 ChatEmptyState；有消息时回到底部输入区。
  const isEmptyState =
    messages.length === 0 && !isProcessing && !showResumeSelector;

  const composerNode = (
    <Composer
      input={input}
      isProcessing={isProcessing || isPasteImporting}
      isUploadingFile={isUploadingFile}
      isResumePreviewActive={isResumePreviewActive}
      pendingAttachments={pendingAttachments}
      fileInputRef={fileInputRef}
      onSubmit={handleSubmit}
      onInputChange={setInput}
      onKeyDown={handleComposerKeyDown}
      onFileChange={handleUploadFile}
      onPasteFiles={handlePasteFiles}
      onRemoveAttachment={handleRemoveAttachment}
      onClickUpload={handleClickUpload}
      onShowResumeSelector={() => {
        // 当前会话已有简历：直接展示它（渲染右侧预览），不弹"开始处理简历"选择面板
        const current =
          selectedLoadedResume ||
          loadedResumes[loadedResumes.length - 1] ||
          null;
        if (current) {
          setSelectedResumeId(current.id);
          setAllowPdfAutoRender(true);
          void renderResumePdfPreview(current, true);
          return;
        }
        // 一份简历都没有时，才打开选择器让用户创建 / 导入 / 选择
        setResumeSelectorInitialStep("entry");
        setShowResumeSelector(true);
      }}
      onStop={handleStopGeneration}
    />
  );

  return (
    <WorkspaceLayout
      agentSession={{
        currentSessionId: activeSessionId,
        sessionsRefreshKey,
        onSelectSession: handleSelectSession,
        onCreateSession: handleCreateSession,
        onDeleteSession: deleteSession,
        onRenameSession: renameSession,
      }}
    >
      <div className="h-full bg-chat-canvas dark:bg-slate-950 flex flex-col overflow-hidden font-chat">
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left: Chat */}
          <section className="flex-1 min-w-0 flex flex-col h-full">
            <div className="shrink-0 px-4 py-2 border-b border-chat-border/40 dark:border-slate-800 flex items-center justify-between gap-3 bg-chat-canvas/80 dark:bg-slate-950/80">
              <ModelSelector value={selectedModel} onChange={handleModelChange} />
              <div className="min-w-0 flex items-center gap-2 text-xs text-gray-400">
                <span className="shrink-0">会话 ID</span>
                <code
                  className="truncate rounded bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono"
                  title={activeSessionId || undefined}
                >
                  {activeSessionId || "—"}
                </code>
              </div>
            </div>
            <CustomScrollbar as="main" className="flex-1 px-4 py-8 flex flex-col">
              <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                {loadingResume && (
                  <div className="text-sm text-gray-400 dark:text-slate-500 mb-4">
                    正在加载简历...
                  </div>
                )}
                {resumeError && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg mb-4">
                    <span className="text-sm text-red-600 dark:text-red-400 flex-1">{resumeError}</span>
                    <button
                      onClick={() => {
                        setResumeError(null);
                        const lastUser = [...messages].reverse().find((m) => m.role === "user");
                        if (lastUser) void sendUserTextMessage(lastUser.content);
                      }}
                      className="text-xs font-medium text-red-600 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-md px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/40 shrink-0"
                    >
                      重新发送
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(resumeError);
                        toast.success("已复制错误信息");
                      }}
                      className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline shrink-0"
                    >
                      复制
                    </button>
                  </div>
                )}
                {isLoadingSession && (
                  <div className="text-xs text-gray-400 dark:text-slate-500 mb-4">
                    正在加载会话...
                  </div>
                )}

                {isEmptyState &&
                  (carryResumePrompt ? (
                    <div className="w-full max-w-lg mx-auto px-4 flex-1 flex flex-col justify-center">
                      <div className="rounded-2xl border border-chat-border bg-chat-surface p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="mb-1 text-sm text-chat-ink-muted dark:text-slate-400">
                          从编辑页带来了
                        </div>
                        <div className="mb-5 truncate text-lg font-bold text-chat-ink dark:text-slate-100">
                          「{carryResumePrompt.name || "未命名简历"}」
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={handleContinueEditCarry}
                            className="flex-1 rounded-xl bg-chat-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] dark:bg-amber-500"
                          >
                            继续编辑这份
                          </button>
                          <button
                            type="button"
                            onClick={handleStartNewFromCarry}
                            className="flex-1 rounded-xl border border-chat-border bg-white px-4 py-2.5 text-sm font-semibold text-chat-ink-muted transition-all hover:border-chat-accent/50 hover:text-chat-ink active:scale-[0.98] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                          >
                            开启新会话
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ChatEmptyState
                      onCreateResume={handleFillCreateResumePrompt}
                      onImportResume={handleImportResume}
                      onSelectExisting={() => {
                        setResumeSelectorInitialStep("existing");
                        setShowResumeSelector(true);
                      }}
                      composerSlot={composerNode}
                    />
                  ))}

                <MessageTimeline
                  messages={messages}
                  loadedResumes={loadedResumes}
                  searchResults={searchResults}
                  resumeEditDiffs={resumeEditDiffs}
                  diagnosisToolEvents={diagnosisToolEvents}
                  pendingPatches={pendingPatches}
                  copiedId={copiedId}
                  stripResumeEditMarkdown={stripResumeEditMarkdown}
                  onSetCopiedId={setCopiedId}
                  onImportRetry={handleImportRetry}
                  onOpenSearchPanel={setActiveSearchPanel}
                  onOpenResume={(resumeForMessage) => {
                    setAllowPdfAutoRender(true);
                    setSelectedResumeId(resumeForMessage.id);
                    if (resumeForMessage.resumeData) {
                      setResumeData(resumeForMessage.resumeData);
                    }
                  }}
                  onOpenResumeSelector={() => {
                    setResumeSelectorInitialStep("entry");
                    setShowResumeSelector(true);
                  }}
                  onRegenerate={() => {
                    const userMessages = messages.filter((m) => m.role === "user");
                    const lastUserMsg = userMessages[userMessages.length - 1];
                    if (lastUserMsg) {
                      void sendUserTextMessage(lastUserMsg.content);
                    }
                  }}
                  onSuggestionClick={(msg) => {
                    setInput("");
                    void sendUserTextMessage(msg);
                  }}
                  onDownloadPdf={handleDownloadPdf}
                  onGoEditor={handleGoEditor}
                  onOptimizeForJd={() => setShowJdCard(true)}
                />

                <StreamingLane
                  currentThought={currentThought}
                  currentAnswer={currentAnswer}
                  isProcessing={isProcessing}
                  suggestions={currentSuggestions}
                  onSuggestionClick={(msg) => {
                    setInput("");
                    void sendUserTextMessage(msg);
                  }}
                  shouldHideResponseInChat={pendingPatches.some(
                    (p) => p.message_id === "current",
                  )}
                  hasPendingPatchCards={pendingPatches.some(
                    (p) => p.message_id === "current",
                  )}
                  currentEditDiff={
                    // 当前轮已经有任何 patch 卡片（无论状态），就不再走旧的 editDiff 路径
                    pendingPatches.some(p => p.message_id === 'current')
                      ? undefined
                      : resumeEditDiffs.find((r) => r.messageId === "current")
                  }
                  currentSearch={searchResults.find((r) => r.messageId === "current")}
                  currentDiagnosisTools={diagnosisToolEvents
                    .filter((item) => item.messageId === "current")
                    .map((item) => item.data)}
                  stripResumeEditMarkdown={stripResumeEditMarkdown}
                  onOpenSearchPanel={setActiveSearchPanel}
                  onResponseTypewriterComplete={finalizeAfterTypewriter}
                />

                {/* 仅渲染当前流式消息 (message_id === 'current') 的 patch 卡片；
                    历史消息的 patch 卡片由 MessageTimeline 按 message_id 关联渲染。 */}
                {pendingPatches.some(p => p.message_id === 'current') && (
                  <div className="px-4 py-1 space-y-2">
                    <ApplyAllPatchesBar
                      patches={pendingPatches.filter(p => p.message_id === 'current')}
                    />
                    {pendingPatches
                      .filter(p => p.message_id === 'current')
                      .map(patch => (
                        <ResumeDiffCard
                          key={patch.patch_id}
                          patch={patch}
                          defaultCollapsed={pendingPatches.filter(p => p.message_id === 'current' && p.status === 'pending').length >= 2}
                        />
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

                {/* 按 JD 优化简历交互卡（首页「按 JD 改简历」chip 进入） */}
                {showJdCard && (
                  <div className="px-4 py-2">
                    <JdOptimizeChatCard
                      resumeLoaded={Boolean(resumeData)}
                      resumeName={resumeData?.basic?.name}
                      busy={isPasteImporting || isProcessing || isUploadingFile}
                      onUploadResumeFile={handleJdCardUploadResume}
                      onPasteResumeText={handleJdCardPasteResume}
                      onStartOptimize={handleJdCardStartOptimize}
                      onDismiss={() => setShowJdCard(false)}
                    />
                  </div>
                )}

                {/* 问候引导胶囊：发「你好」且无简历时的零延迟意图引导（替代旧的大卡） */}
                {showGreetingChips && (
                  <div className="px-4 py-2">
                    <IntentChips
                      chips={[
                        {
                          icon: Wand2,
                          label: "对话创建（推荐）",
                          onClick: () => {
                            setShowGreetingChips(false);
                            handleFillCreateResumePrompt();
                          },
                        },
                        {
                          icon: Upload,
                          label: "导入简历",
                          onClick: () => {
                            setShowGreetingChips(false);
                            handleImportResume();
                          },
                        },
                        {
                          icon: FileText,
                          label: "选择已有",
                          onClick: () => {
                            setShowGreetingChips(false);
                            setResumeSelectorInitialStep("existing");
                            setShowResumeSelector(true);
                          },
                        },
                        {
                          icon: Search,
                          label: "岗位分析",
                          onClick: () => {
                            setShowGreetingChips(false);
                            setInput("分析这个 JD，看看我的简历还要补充什么");
                          },
                        },
                        {
                          icon: Zap,
                          label: "快速问答",
                          onClick: () => {
                            setShowGreetingChips(false);
                            setInput("怎么写出让 HR 眼前一亮的简历总结");
                          },
                        },
                      ]}
                    />
                  </div>
                )}

                {/* 简历选择器：放在对话流末尾，与最新消息同区域展示 */}
                {showResumeSelector && (
                  <ResumeSelector
                    initialStep={resumeSelectorInitialStep}
                    onSelect={handleResumeSelect}
                    onCreateResume={handleCreateResume}
                    onImportResume={handleImportResume}
                    onFillCreatePrompt={handleFillCreateResumePrompt}
                    onCancel={handleResumeSelectorCancel}
                  />
                )}

                {/* 处理中占位由 StreamingLane 内的星芒 ThinkingIndicator 统一负责，此处不再重复 */}

                <div ref={messagesEndRef} />
              </div>
            </CustomScrollbar>

            {/* Input Area（有消息时固定底部；空态下输入框移到中间，见 ChatEmptyState） */}
            {!isEmptyState && (
              <div className="bg-chat-canvas dark:bg-slate-950 px-4 py-4 pb-8">
                <div className="max-w-3xl mx-auto w-full">{composerNode}</div>
              </div>
            )}
          </section>

          {/* Right: Resume Preview - 只在有选中简历时显示 */}
          {selectedResumeId && (
            <AgentPdfPreviewPanel
              resumeName={selectedLoadedResume?.name}
              pdfBlob={selectedResumePdfState.blob}
              loading={selectedResumePdfState.loading}
              progress={selectedResumePdfState.progress}
              error={selectedResumePdfState.error}
              justUpdated={previewJustUpdated}
              onRerender={() => {
                if (selectedLoadedResume) {
                  void renderResumePdfPreview(selectedLoadedResume, true);
                }
              }}
              onClose={() => {
                setAllowPdfAutoRender(false);
                setSelectedResumeId(null);
              }}
            />
          )}
        </div>
        <SearchResultPanel
          isOpen={!!activeSearchPanel}
          query={activeSearchPanel?.query || ""}
          totalResults={activeSearchPanel?.total_results || 0}
          results={activeSearchPanel?.results || []}
          onClose={() => setActiveSearchPanel(null)}
        />
        <AIImportModal
          isOpen={aiImportModalOpen}
          sectionType="all"
          sectionTitle="导入简历"
          onClose={() => setAiImportModalOpen(false)}
          onSave={handleAIImportSave}
        />
      </div>
    </WorkspaceLayout>
  );
}
