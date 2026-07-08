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
  Settings,
  ChevronDown,
  LogIn,
  LogOut,
  LayoutTemplate,
  History,
  Sparkles,
  Shield,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { LATEST_CHANGELOG } from "@/data/changelog";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { getCurrentResumeId } from "@/services/resumeStorage";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { canUseAdminFeature, canUseAgentFeature, getApiBaseUrl, isAgentEnabled } from "@/lib/runtimeEnv";

// 工作区类型
type WorkspaceType =
  | "edit"
  | "agent"
  | "myResumes"
  | "settings"
  | "templates"
  | "admin";

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

export type AgentSessionHandlers = {
  currentSessionId: string | null;
  sessionsRefreshKey?: number;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => Promise<void> | void;
  onRenameSession: (sessionId: string, title: string) => Promise<void> | void;
};

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  agentSession?: AgentSessionHandlers;
}

export default function WorkspaceLayout({
  children,
  agentSession,
}: WorkspaceLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout, openModal } = useAuth();
  const { isDark, setTheme } = useTheme();
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
    if (
      location.pathname.startsWith("/workspace/agent") ||
      location.pathname.startsWith("/agent")
    ) {
      return "agent";
    }
    if (location.pathname === "/my-resumes") {
      return "myResumes";
    }
    if (location.pathname === "/settings") {
      return "settings";
    }
    if (location.pathname === "/admin") {
      return "admin";
    }
    if (location.pathname === "/templates") {
      return "templates";
    }
    // /workspace 及其子路径（/new、/:id、旧路由重定向）都算编辑区
    if (location.pathname.startsWith("/workspace")) {
      return "edit";
    }
    return "edit";
  };

  const currentWorkspace = getCurrentWorkspace();
  const agentEnabled = isAgentEnabled();
  const canUseAgent = isAuthenticated && canUseAgentFeature();
  const canUseAdmin = isAuthenticated && canUseAdminFeature();

  const sidebarWidthPx = sidebarCollapsed ? 96 : 200;

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
    if (workspace === "agent") {
      const currentResumeId = getCurrentResumeId();
      // 只有正在「编辑简历」页时进 AI 助手才带上当前简历（承接编辑上下文）；
      // 从我的简历 / 设置等其它页进则开新会话，不硬塞上一次编辑过的简历。
      const fromEditor = location.pathname.startsWith("/workspace");
      return currentResumeId && fromEditor
        ? `/agent/${currentResumeId}`
        : "/agent/new";
    }
    if (workspace === "myResumes") return "/my-resumes";
    if (workspace === "settings") return "/settings";
    if (workspace === "admin") return "/admin";
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

  const handleSelectSession = (sessionId: string) => {
    if (!canUseAgent) return;
    if (agentSession?.onSelectSession) {
      agentSession.onSelectSession(sessionId);
      return;
    }
    navigate(`/agent/new?sessionId=${sessionId}`, { replace: true });
  };

  const handleCreateSession = () => {
    if (!canUseAgent) return;
    if (agentSession?.onCreateSession) {
      agentSession.onCreateSession();
      return;
    }
    navigate("/agent/new", { state: { forceNew: Date.now() } });
  };

  const deleteSession = async (sessionId: string) => {
    if (!canUseAgent) return;
    if (agentSession?.onDeleteSession) {
      await agentSession.onDeleteSession(sessionId);
      return;
    }
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
    if (agentSession?.onRenameSession) {
      await agentSession.onRenameSession(sessionId, title);
      return;
    }
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

  const sidebarCurrentSessionId =
    agentSession?.currentSessionId ??
    ((new URLSearchParams(location.search).get("sessionId") ||
      (location.pathname.startsWith("/agent/")
        ? location.pathname.split("/").pop()
        : null)) as string | null);

  const sidebarSessionsRefreshKey =
    agentSession?.sessionsRefreshKey ?? sessionsRefreshKey;

  return (
    <div className="h-screen flex overflow-hidden bg-[#F0F0E8] dark:bg-[#1C1C1C] font-sans selection:bg-sky-500 selection:text-white">
      {/* 左侧固定边栏 */}
      <aside
        className={cn(
          "shrink-0 bg-[#F0F0E8] dark:bg-[#1C1C1C] border-r-2 border-black dark:border-white flex flex-col transition-[width] duration-200",
          sidebarCollapsed ? "w-24" : "w-[200px]",
        )}
      >
        {/* Logo + 收缩按钮：收起时合并，展开时并列 */}
        <div className="border-b-2 border-black dark:border-white shrink-0 p-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-1 w-full px-1">
              <div
                className="cursor-pointer group shrink-0 flex items-center gap-2.5 min-w-0"
                onClick={() => navigate("/")}
              >
                <div className="w-9 h-9 bg-sky-500 rounded-none flex items-center justify-center border border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff] group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-none transition-all shrink-0">
                  <span className="text-white font-mono font-black text-sm not-italic">
                    RA
                  </span>
                </div>
                <span className="text-black dark:text-white font-mono font-bold text-base uppercase tracking-wide truncate">
                  Resume.AI
                </span>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                className={cn(
                  "rounded-none transition-colors shrink-0 p-1.5",
                  "text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
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
                <div className="w-9 h-9 bg-sky-500 rounded-none flex items-center justify-center border border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff] shrink-0">
                  <span className="text-white font-mono font-black text-sm not-italic">
                    RA
                  </span>
                </div>
              </div>

              {/* 收起态悬停状态：展开按钮 */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute inset-0 flex items-center justify-center rounded-none opacity-0 group-hover:opacity-100 transition-all duration-200 bg-[#E5E5E0]/90 dark:bg-[#2A2A2A]/90 text-black dark:text-white"
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
                "w-full rounded-none font-mono uppercase tracking-wide transition-all duration-100 border",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "edit"
                  ? "bg-sky-500 text-white border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]"
                  : "border-transparent text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
              )}
              title="编辑区"
            >
              <Edit className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">编辑简历</span>
              )}
            </button>

            {/* AI 对话区 */}
            {agentEnabled && (
              <button
                onClick={(e) => handleWorkspaceChange("agent", e)}
                className={cn(
                  "w-full rounded-none font-mono uppercase tracking-wide transition-all duration-100 border group",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                  currentWorkspace === "agent"
                    ? "bg-sky-500 text-white border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]"
                    : "border-transparent text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
                )}
                title="AI 对话"
              >
                <Sparkles className={cn("w-6 h-6 shrink-0", currentWorkspace === "agent" ? "text-white" : "text-black dark:text-white")} />
                {!sidebarCollapsed && (
                  <span
                    className={cn(
                      "text-base font-medium transition-colors duration-100",
                      currentWorkspace === "agent"
                        ? "text-white"
                        : "text-black dark:text-white",
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
                "w-full rounded-none font-mono uppercase tracking-wide transition-all duration-100 border",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "myResumes"
                  ? "bg-sky-500 text-white border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]"
                  : "border-transparent text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
              )}
              title="我的简历"
            >
              <FileText className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">我的简历</span>
              )}
            </button>

            {canUseAdmin && (
              <button
                onClick={(e) => handleWorkspaceChange("admin", e)}
                className={cn(
                  "w-full rounded-none font-mono uppercase tracking-wide transition-all duration-100 border",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                  currentWorkspace === "admin"
                    ? "bg-sky-500 text-white border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]"
                    : "border-transparent text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
                )}
                title="后台管理系统"
              >
                <Shield className="w-6 h-6 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-base font-medium">后台管理系统</span>
                )}
              </button>
            )}
          </nav>

          {/* 分隔线 */}
          <div className="border-t-2 border-black dark:border-white my-2 shrink-0" />

          {/* 历史会话 - 常驻显示 */}
          {!sidebarCollapsed && canUseAgent && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <RecentSessions
                currentSessionId={sidebarCurrentSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={deleteSession}
                onRenameSession={renameSession}
                refreshKey={sidebarSessionsRefreshKey}
              />
            </div>
          )}
        </div>

        {/* 底部：主题切换 + 登录组件（与导航风格统一） */}
        <div className="py-4 px-3 border-t-2 border-black dark:border-white">
          {/* 深色 / 浅色切换：登录态下移入用户下拉，未登录时保留此处 */}
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={cn(
                "w-full rounded-none font-mono uppercase tracking-wide transition-all duration-100 mb-2",
                "border border-black dark:border-white bg-[#F0F0E8] dark:bg-[#2A2A2A] text-black dark:text-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:bg-[#E5E5E0] dark:hover:bg-[#333333] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
              )}
              title={isDark ? "切换到浅色模式" : "切换到深色模式"}
            >
              {isDark ? (
                <Sun className="w-5 h-5 shrink-0" />
              ) : (
                <Moon className="w-5 h-5 shrink-0" />
              )}
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">
                  {isDark ? "浅色模式" : "深色模式"}
                </span>
              )}
            </button>
          )}

          <div ref={logoutMenuRef} className="relative">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                  className={cn(
                    "w-full rounded-none transition-all duration-100 group",
                    "bg-[#F0F0E8] dark:bg-[#2A2A2A] border border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff] hover:bg-[#E5E5E0] dark:hover:bg-[#333333] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                    sidebarCollapsed
                      ? "flex flex-col items-center justify-center gap-1 py-3"
                      : "flex items-center gap-3 py-2 px-3",
                  )}
                  title={user?.username || user?.email}
                >
                  <Avatar
                    src={user?.image}
                    name={user?.username}
                    email={user?.email}
                    className="w-9 h-9 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors"
                    textClassName="text-sm"
                  />
                  {!sidebarCollapsed && (
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="text-sm font-mono font-bold uppercase tracking-wide text-black dark:text-white truncate w-full text-left">
                        {user?.username || user?.email}
                      </span>
                    </div>
                  )}
                  {!sidebarCollapsed && (
                    <ChevronDown className={cn("w-3.5 h-3.5 text-black dark:text-white transition-transform duration-300", showLogoutMenu && "rotate-180")} />
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
                        "absolute bottom-full mb-3 bg-[#F0F0E8] dark:bg-[#1C1C1C] border border-black dark:border-white rounded-none shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#ffffff] z-[110] p-1.5 min-w-[180px]",
                        sidebarCollapsed ? "left-0" : "left-0 right-0"
                      )}
                    >
                      <div className="px-3 py-2 border-b border-black dark:border-white mb-1">
                        <p className="text-[10px] font-mono font-bold text-black dark:text-white uppercase tracking-widest">账号管理</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutMenu(false);
                          navigate("/account");
                        }}
                        className={cn(
                          "w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-none text-sm font-mono font-bold uppercase tracking-wide transition-all",
                          "text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <Zap className="w-4 h-4 shrink-0 text-sky-500" />
                          账户中心
                        </span>
                        {/* 额度数字 —— 额度迁移期间暂不展示 */}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          setShowLogoutMenu(false);
                          handleWorkspaceChange("settings");
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-none text-sm font-mono font-bold uppercase tracking-wide transition-all",
                          "text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
                        )}
                      >
                        <Settings className="w-4 h-4 shrink-0" />
                        个人设置
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme(isDark ? "light" : "dark")}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-none text-sm font-mono font-bold uppercase tracking-wide transition-all",
                          "text-black dark:text-white hover:bg-[#E5E5E0] dark:hover:bg-[#2A2A2A]",
                        )}
                      >
                        {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                        {isDark ? "浅色模式" : "深色模式"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutMenu(false);
                          logout();
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-none text-sm font-mono font-bold uppercase tracking-wide transition-all",
                          "text-black dark:text-white hover:bg-red-700 hover:text-white",
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
                          "w-full rounded-none transition-all duration-100 font-mono uppercase tracking-wide group",
                          "bg-sky-500 text-white border border-black dark:border-white shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]",
                          "hover:bg-sky-600 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
                          sidebarCollapsed
                            ? "flex flex-col items-center justify-center gap-1 py-3"
                            : "flex items-center gap-3 py-2.5 px-4",
                        )}
                        title="登录 / 注册"
                      >
                        <LogIn className="w-4 h-4 shrink-0 text-white transition-colors" />
                        {!sidebarCollapsed && (
                          <span className="text-sm">立即登录</span>
                        )}
                      </button>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-center gap-2 mt-3 px-2">
              <span className="text-[10px] font-mono font-bold text-black/60 dark:text-white/60 uppercase tracking-widest">VERSION {LATEST_CHANGELOG.version}</span>
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
              className="h-full w-full flex flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
