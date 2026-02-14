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
  Save,
  Download,
  LogIn,
  User,
  LogOut,
  CalendarDays,
  LayoutTemplate,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentResumeId } from "@/services/resumeStorage";
import { RecentSessions } from "@/components/sidebar/RecentSessions";
import { getApiBaseUrl } from "@/lib/runtimeEnv";

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

/** Agent 按钮图标：对话气泡轮廓 + 气泡内三点（参考图样式） */
function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 气泡轮廓：圆角矩形 */}
      <rect x="3" y="3" width="18" height="14" rx="2.5" />
      {/* 气泡内三点（省略号） */}
      <circle cx="8.5" cy="10" r="1.2" fill="currentColor" />
      <circle cx="12" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.2" fill="currentColor" />
    </svg>
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

  const handleSelectSession = (sessionId: string) => {
    navigate(`/agent/new?sessionId=${sessionId}`, { replace: true });
  };

  const handleCreateSession = () => {
    navigate("/agent/new");
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(
        `${getApiBaseUrl()}/api/agent/history/${sessionId}`,
        { method: "DELETE" },
      );
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);
      setSessionsRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const renameSession = async (sessionId: string, title: string) => {
    try {
      const resp = await fetch(
        `${getApiBaseUrl()}/api/agent/history/sessions/${sessionId}/title`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    <div className="h-screen flex overflow-hidden bg-[#F8F9FA] dark:bg-slate-950">
      {/* 左侧固定边栏：收缩时 aside 宽度跟着变，第一列紧贴侧边栏 */}
      <aside
        className={cn(
          "shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-[width] duration-200",
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
                <div className="w-9 h-9 bg-white dark:bg-white rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow-sm group-hover:scale-105 transition-transform shrink-0">
                  <span className="text-slate-900 font-black text-sm italic">
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
                <div className="w-9 h-9 bg-white dark:bg-white rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow-sm shrink-0">
                  <span className="text-slate-900 font-black text-sm italic">
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
        <div className="flex-1 flex flex-col min-h-0 py-3 px-2 overflow-hidden">
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
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="编辑区"
            >
              <Edit className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">编辑</span>
              )}
            </button>

            {/* 简历入口：图一样式，文档图标 + 简历 */}
            <button
              onClick={(e) => handleWorkspaceChange("resume", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "resume"
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="简历"
            >
              <FileText className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">简历</span>
              )}
            </button>

            {/* AI 对话区 */}
            <button
              onClick={(e) => handleWorkspaceChange("agent", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "agent"
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="AI 对话"
            >
              <AgentIcon className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">AI</span>
              )}
            </button>

            {/* 我的简历 */}
            <button
              onClick={(e) => handleWorkspaceChange("myResumes", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "myResumes"
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="我的简历"
            >
              <FileText className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">我的简历</span>
              )}
            </button>

            {/* 投递进展表 */}
            <button
              onClick={(e) => handleWorkspaceChange("applications", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "applications"
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="投递进展表"
            >
              <Table2 className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">投递进展表</span>
              )}
            </button>

            {/* 面试日历 */}
            <button
              onClick={(e) => handleWorkspaceChange("calendar", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "calendar"
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="面试日历"
            >
              <CalendarDays className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">面试日历</span>
              )}
            </button>

            {/* 仪表盘 */}
            <button
              onClick={(e) => handleWorkspaceChange("dashboard", e)}
              className={cn(
                "w-full rounded-lg transition-all duration-200",
                sidebarCollapsed
                  ? "flex flex-col items-center justify-center gap-1 py-2.5"
                  : "flex items-center gap-2.5 py-2.5 px-2.5",
                currentWorkspace === "dashboard"
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
              )}
              title="仪表盘"
            >
              <LayoutDashboard className="w-6 h-6 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-base font-medium">仪表盘</span>
              )}
            </button>
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
          {!sidebarCollapsed && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <RecentSessions
                baseUrl={getApiBaseUrl()}
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
        <div className="py-2 px-2 border-t border-slate-100 dark:border-slate-800">
          <div ref={logoutMenuRef} className="relative">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                  className={cn(
                    "w-full rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                    sidebarCollapsed
                      ? "flex flex-col items-center justify-center gap-1 py-2.5"
                      : "flex items-center gap-2.5 py-2.5 px-2.5",
                  )}
                  title={user?.username || user?.email}
                >
                  <User className="w-6 h-6 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-base font-medium truncate text-left">
                      {user?.username || user?.email}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showLogoutMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 right-0 mb-1 space-y-1"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          setShowLogoutMenu(false);
                          handleWorkspaceChange("settings");
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg",
                          "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                          "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-medium transition-colors",
                        )}
                      >
                        <Settings className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                        设置
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutMenu(false);
                          logout();
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg",
                          "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                          "text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/20 text-[10px] font-medium transition-colors",
                        )}
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
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
                  "w-full rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                )}
                title="登录 / 注册"
              >
                <LogIn className="w-6 h-6 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-base font-medium">登录</span>
                )}
              </button>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="text-xs text-slate-400 dark:text-slate-500 text-center leading-tight mt-1.5 px-1">
              v2.0
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
