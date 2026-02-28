/**
 * 工作区布局容器
 * 左侧固定边栏（工作区切换），右侧动态内容区
 */
import { useState, useEffect, useRef, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Edit,
  FileText,
  LayoutDashboard,
  Table2,
  Settings,
  ChevronDown,
  Save,
  Download,
  LogIn,
  User,
  LogOut,
  CalendarDays,
  LayoutTemplate,
  History,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentResumeId } from "@/services/resumeStorage";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { getApiBaseUrl, isAgentEnabled } from "@/lib/runtimeEnv";

// 工作区类型
type WorkspaceType =
  | "resume"
  | "edit"
  | "agent"
  | "dashboard"
  | "myResumes"
  | "applications"
  | "calendar"
  | "settings"
  | "templates";

function getRoleFromToken(): string {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      const payloadPart = token.split(".")[1];
      if (payloadPart) {
        const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        const tokenRole = String(payload?.role || "").toLowerCase();
        if (tokenRole) return tokenRole;
      }
    }
    const authUserRaw = localStorage.getItem("auth_user");
    if (authUserRaw) {
      const authUser = JSON.parse(authUserRaw);
      return String(authUser?.role || "").toLowerCase();
    }
    return "";
  } catch {
    return "";
  }
}

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** 复刻参考图：圆角矩形 + 内竖线（左窄右宽），细描边 */
function SidebarToggleIcon({
  expand = false,
  className,
}: {
  expand?: boolean;
  className?: string;
}) {
  const lineX = expand ? 17 : 7; // 展开态：线偏右；收起态：线偏左
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
      <line x1={lineX} y1="6" x2={lineX} y2="18" />
    </svg>
  );
}

/** Agent 按钮图标：使用 Sparkles 图标并添加渐变背景和动画 */
function AgentIcon({ active = false }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md transition-all duration-300 shrink-0",
        active
          ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-md shadow-indigo-500/20"
          : "bg-slate-100 dark:bg-slate-800",
        "w-6 h-6",
      )}
    >
      <Sparkles
        className={cn(
          "w-4 h-4 transition-colors duration-300",
          active
            ? "text-white animate-pulse"
            : "text-slate-500 dark:text-slate-400",
        )}
      />
      {active && (
        <motion.div
          layoutId="activeGlow"
          className="absolute inset-0 rounded-md bg-white/20 blur-[2px]"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
}

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  onSave?: () => void;
  onDownload?: () => void;
}

export default function WorkspaceLayout({
  children,
  onSave,
  onDownload,
}: WorkspaceLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout, openModal } = useAuth();
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const logoutMenuRef = useRef<HTMLDivElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("workspace-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("workspace-sidebar-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  // 根据路径确定当前工作区
  const getCurrentWorkspace = (): WorkspaceType => {
    if (location.pathname === "/resume-entry") {
      return "resume";
    }
    // 检测是否是简历创建页面（保留 resume-creator）
    if (
      location.pathname === "/resume-creator" ||
      location.pathname.startsWith("/workspace/agent") ||
      location.pathname.startsWith("/agent")
    ) {
      return "agent";
    }
    if (location.pathname === "/dashboard") {
      return "dashboard";
    }
    if (location.pathname === "/my-resumes") {
      return "myResumes";
    }
    if (location.pathname === "/applications") {
      return "applications";
    }
    if (location.pathname === "/calendar") {
      return "calendar";
    }
    if (location.pathname === "/settings") {
      return "settings";
    }
    if (location.pathname === "/templates") {
      return "templates";
    }
    // workspace/html 或 workspace/latex 都算编辑区
    if (location.pathname.startsWith("/workspace")) {
      return "edit";
    }
    return "edit";
  };

  const currentWorkspace = getCurrentWorkspace();
  const roleFromToken = getRoleFromToken();
  const agentFeatureEnabled = isAgentEnabled();
  const canUseAgent =
    agentFeatureEnabled &&
    isAuthenticated &&
    (roleFromToken === "admin" || roleFromToken === "member");
  const canUseApplyEntry = canUseAgent;

  useEffect(() => {
    if (currentWorkspace !== "agent") return;
    if (canUseAgent) return;
    navigate("/workspace", { replace: true });
  }, [canUseAgent, currentWorkspace, navigate]);

  useEffect(() => {
    if (currentWorkspace !== "resume") return;
    if (canUseApplyEntry) return;
    navigate("/workspace", { replace: true });
  }, [canUseApplyEntry, currentWorkspace, navigate]);

  const [jobCenterOpen, setJobCenterOpen] = useState(() => {
    return (
      currentWorkspace === "resume" ||
      currentWorkspace === "applications" ||
      currentWorkspace === "calendar" ||
      currentWorkspace === "dashboard"
    );
  });
  const [jobCenterHovered, setJobCenterHovered] = useState(false);
  const hoverTimeoutRef = useRef<any>(null);

  const handleJobCenterMouseEnter = () => {
    if (!sidebarCollapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setJobCenterHovered(true);
  };

  const handleJobCenterMouseLeave = () => {
    if (!sidebarCollapsed) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setJobCenterHovered(false);
    }, 100);
  };

  const sidebarWidthPx = sidebarCollapsed ? 96 : 260;

  // 点击外部区域关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        logoutMenuRef.current &&
        !logoutMenuRef.current.contains(event.target as Node)
      ) {
        setShowLogoutMenu(false);
      }
    };

    if (showLogoutMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showLogoutMenu]);

  const resolveWorkspacePath = (workspace: WorkspaceType): string => {
    if (workspace === "resume") return "/resume-entry";
    if (workspace === "agent") {
      const currentResumeId = getCurrentResumeId();
      return currentResumeId ? `/agent/${currentResumeId}` : "/agent/new";
    }
    if (workspace === "dashboard") return "/dashboard";
    if (workspace === "myResumes") return "/my-resumes";
    if (workspace === "applications") return "/applications";
    if (workspace === "calendar") return "/calendar";
    if (workspace === "settings") return "/settings";
    if (workspace === "templates") return "/templates";
    return "/workspace";
  };

  const handleWorkspaceChange = (
    workspace: WorkspaceType,
    e?: MouseEvent<HTMLButtonElement>,
  ) => {
    const targetPath = resolveWorkspacePath(workspace);
    if (e?.metaKey || e?.ctrlKey) {
      window.open(targetPath, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(targetPath);
  };

  const isJobCenterActive =
    currentWorkspace === "resume" ||
    currentWorkspace === "applications" ||
    currentWorkspace === "calendar" ||
    currentWorkspace === "dashboard";

  const handleSelectSession = (sessionId: string) => {
    if (!canUseAgent) return;
    navigate(`/agent/new?sessionId=${sessionId}`, { replace: true });
  };

  const handleCreateSession = () => {
    if (!canUseAgent) return;
    navigate("/agent/new");
  };

  const deleteSession = async (sessionId: string) => {
    if (!canUseAgent) return;
    try {
      const resp = await fetch(
        `${getApiBaseUrl()}/api/agent/history/${sessionId}`,
        { method: "DELETE", headers: getAuthHeaders() },
      );
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);
      setSessionsRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const renameSession = async (sessionId: string, title: string) => {
    if (!canUseAgent) return;
    try {
      const resp = await fetch(
        `${getApiBaseUrl()}/api/agent/history/sessions/${sessionId}/title`,
        {
          method: "PUT",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ title }),
        },
      );
      if (!resp.ok) throw new Error(`Failed to rename session: ${resp.status}`);
      setSessionsRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to rename session:", error);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-[#FAFAFA] dark:bg-slate-950 font-sans selection:bg-slate-200 selection:text-slate-900">
      {/* 左侧固定边栏 */}
      <aside
        className={cn(
          "shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800 flex flex-col transition-[width] duration-200",
          sidebarCollapsed ? "w-24" : "w-[260px]",
        )}
      >
        {/* Logo + 收缩按钮：收起时合并，展开时并列 */}
        <div className="border-b border-slate-100 dark:border-slate-800 shrink-0 p-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-1 w-full px-1">
              <div
                className="cursor-pointer group shrink-0 flex items-center gap-2.5 min-w-0"
                onClick={() => navigate("/")}
              >
                <div className="w-9 h-9 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow-sm group-hover:scale-105 transition-transform shrink-0">
                  <span className="text-white font-black text-sm italic">
                    RA
                  </span>
                </div>
                <span className="text-slate-900 dark:text-slate-100 font-bold text-base truncate">
                  Resume.AI
                </span>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                className={cn(
                  "rounded-lg transition-colors shrink-0 p-1.5",
                  "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300",
                )}
                title="收起侧边栏"
              >
                <SidebarToggleIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="relative group h-10 w-full flex items-center justify-center">
              {/* 收起态默认状态：仅 Logo */}
              <div className="flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0 w-full">
                <div className="w-9 h-9 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow-sm shrink-0">
                  <span className="text-white font-black text-sm italic">
                    RA
                  </span>
                </div>
              </div>

              {/* 收起态悬停状态：展开按钮 */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                title="展开侧边栏"
              >
                <SidebarToggleIcon expand className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* 工作区切换：收缩时仅隐藏文字，图标与 padding 不变 */}
        <div className="flex-1 flex flex-col min-h-0 py-3 px-2">
          <nav
            className={cn(
              "space-y-0.5 flex flex-col shrink-0",
              sidebarCollapsed ? "items-center" : "",
            )}
          >
            {/* 编辑区 */}
            <button
              onClick={(e) => handleWorkspaceChange("edit", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "edit"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="编辑区"
            >
              <Edit className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">编辑简历</span>
              )}
            </button>

            {/* AI 对话区（仅 admin/member） */}
            {canUseAgent && (
              <button
                onClick={(e) => handleWorkspaceChange("agent", e)}
                className={cn(
                  "w-full rounded-lg transition-all duration-300 group",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                  currentWorkspace === "agent"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
                title="AI 对话"
              >
                <Sparkles className={cn("w-6 h-6 shrink-0", currentWorkspace === "agent" ? "text-slate-900" : "text-slate-600")} />
                {!sidebarCollapsed && (
                  <span
                    className={cn(
                      "text-base font-medium transition-colors duration-300",
                      currentWorkspace === "agent"
                        ? "text-slate-900"
                        : "text-slate-600 dark:text-slate-400",
                    )}
                  >
                    AI 助手
                  </span>
                )}
              </button>
            )}

            {/* 我的简历 */}
            <button
              onClick={(e) => handleWorkspaceChange("myResumes", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "myResumes"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="我的简历"
            >
              <FileText className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">我的简历</span>
              )}
            </button>

            {/* 求职中心（二级：投递进展、仪表盘） */}
            <div
              className="w-full relative"
              onMouseEnter={handleJobCenterMouseEnter}
              onMouseLeave={handleJobCenterMouseLeave}
            >
              <button
                onClick={(e) => {
                  if (sidebarCollapsed) {
                    handleWorkspaceChange(
                      canUseApplyEntry ? "resume" : "applications",
                      e,
                    );
                    return;
                  }
                  setJobCenterOpen((prev) => !prev);
                }}
                className={cn(
                  "w-full rounded-lg transition-all duration-200",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center justify-between gap-2.5 py-2.5 px-2.5",
                  isJobCenterActive
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
                title="求职中心"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LayoutDashboard className="w-6 h-6 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-base font-medium truncate">
                      求职中心
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      jobCenterOpen ? "rotate-180" : "rotate-0",
                    )}
                  />
                )}
              </button>

              {/* 收起态悬停弹出菜单 */}
              <AnimatePresence>
                {sidebarCollapsed && jobCenterHovered && (
                    <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-full top-0 ml-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-[100] p-1.5 space-y-0.5"
                  >
                    {canUseApplyEntry && (
                      <button
                        onClick={(e) => {
                          handleWorkspaceChange("resume", e);
                          setJobCenterHovered(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          currentWorkspace === "resume"
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                        )}
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        申请
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        handleWorkspaceChange("applications", e);
                        setJobCenterHovered(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        currentWorkspace === "applications"
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                      )}
                    >
                      <Table2 className="w-4 h-4 shrink-0" />
                      投递进展
                    </button>
                    <button
                      onClick={(e) => {
                        handleWorkspaceChange("calendar", e);
                        setJobCenterHovered(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        currentWorkspace === "calendar"
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                      )}
                    >
                      <CalendarDays className="w-4 h-4 shrink-0" />
                      面试日历
                    </button>
                    <button
                      onClick={(e) => {
                        handleWorkspaceChange("dashboard", e);
                        setJobCenterHovered(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        currentWorkspace === "dashboard"
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                      )}
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0" />
                      仪表盘
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {!sidebarCollapsed && jobCenterOpen && (
                <div className="mt-1 ml-3 pl-3 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
                  {canUseApplyEntry && (
                    <button
                      onClick={(e) => handleWorkspaceChange("resume", e)}
                      className={cn(
                        "w-full rounded-md px-2.5 py-2 text-left text-sm transition-all duration-200",
                        currentWorkspace === "resume"
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                      )}
                      title="申请"
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileText className="w-4 h-4 shrink-0" />
                        申请
                      </span>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleWorkspaceChange("applications", e)}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left text-sm transition-all duration-200",
                      currentWorkspace === "applications"
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                    title="投递进展"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Table2 className="w-4 h-4 shrink-0" />
                      投递进展
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleWorkspaceChange("calendar", e)}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left text-sm transition-all duration-200",
                      currentWorkspace === "calendar"
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                    title="面试日历"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 shrink-0" />
                      面试日历
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleWorkspaceChange("dashboard", e)}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left text-sm transition-all duration-200",
                      currentWorkspace === "dashboard"
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                    title="仪表盘"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 shrink-0" />
                      仪表盘
                    </span>
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* 分隔线 */}
          <div className="border-t border-slate-100 dark:border-slate-800 my-1 shrink-0" />

          {/* 其他导航 */}
          <nav
            className={cn(
              "space-y-0.5 flex flex-col shrink-0",
              sidebarCollapsed ? "items-center" : "",
            )}
          >
            {/* 保存按钮 - 仅在编辑区显示 */}
            {currentWorkspace === "edit" && onSave && (
              <button
                onClick={onSave}
                className={cn(
                  "w-full rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                )}
                title="保存简历"
              >
                <Save className="w-6 h-6 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-base font-medium">保存</span>
                )}
              </button>
            )}

            {/* 下载按钮 - 仅在编辑区显示 */}
            {currentWorkspace === "edit" && onDownload && (
              <button
                onClick={onDownload}
                className={cn(
                  "w-full rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                )}
                title="下载PDF"
              >
                <Download className="w-6 h-6 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-base font-medium">下载</span>
                )}
              </button>
            )}
          </nav>

          {/* 分隔线 */}
          <div className="border-t border-slate-100 dark:border-slate-800 my-1 shrink-0" />

          {/* 历史会话 - 常驻显示 */}
          {!sidebarCollapsed && canUseAgent && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <RecentSessions
                currentSessionId={
                  (new URLSearchParams(location.search).get("sessionId") ||
                    (location.pathname.startsWith("/agent/")
                      ? location.pathname.split("/").pop()
                      : null)) as string | null
                }
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={deleteSession}
                onRenameSession={renameSession}
                refreshKey={sessionsRefreshKey}
              />
            </div>
          )}
        </div>

        {/* 底部：登录组件（与导航风格统一，图标+用户名一行） */}
        <div className="py-4 px-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <div ref={logoutMenuRef} className="relative">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                  className={cn(
                    "w-full rounded-xl transition-all duration-300 group",
                    "bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm",
                    sidebarCollapsed
                      ? "flex flex-col items-center justify-center gap-1 py-3"
                      : "flex items-center gap-3 py-2 px-3",
                  )}
                  title={user?.username || user?.email}
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate w-full text-left">
                        {user?.username || user?.email}
                      </span>
                    </div>
                  )}
                  {!sidebarCollapsed && (
                    <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-300", showLogoutMenu && "rotate-180")} />
                  )}
                </button>
                <AnimatePresence>
                  {showLogoutMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className={cn(
                        "absolute bottom-full mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[110] p-1.5 min-w-[180px]",
                        sidebarCollapsed ? "left-0" : "left-0 right-0"
                      )}
                    >
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">账号管理</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          setShowLogoutMenu(false);
                          handleWorkspaceChange("settings");
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                          "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                        )}
                      >
                        <Settings className="w-4 h-4 shrink-0" />
                        个人设置
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutMenu(false);
                          logout();
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                          "text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400",
                        )}
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        退出登录
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
                      <button
                        type="button"
                        onClick={() => openModal("login")}
                        className={cn(
                          "w-full rounded-xl transition-all duration-300 font-medium",
                          "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                          "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white hover:shadow-sm",
                          sidebarCollapsed
                            ? "flex flex-col items-center justify-center gap-1 py-3"
                            : "flex items-center gap-3 py-2.5 px-4",
                        )}
                        title="登录 / 注册"
                      >
                        <LogIn className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                        {!sidebarCollapsed && (
                          <span className="text-sm">立即登录</span>
                        )}
                      </button>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-center gap-2 mt-3 px-2">
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-600 tracking-wider">VERSION 2.0.4</span>
            </div>
          )}
        </div>
      </aside>

      {/* 右侧内容区：限制最大宽度 = 展开侧边栏时的可用宽度，避免收缩时第三列 PDF 被拉宽 */}
      <main className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        <div
          className="h-full w-full flex flex-col overflow-hidden transition-[max-width] duration-200"
          style={{
            width: "100%",
            maxWidth: `calc(100vw - ${sidebarWidthPx}px)`,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWorkspace}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
