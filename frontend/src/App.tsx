import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthModal } from './components/AuthModal'
import { ThemeInit } from './components/ThemeInit'
import ErrorBoundary from './ErrorBoundary'
import { isAgentEnabled } from './lib/runtimeEnv'
import ResumeDashboard from './pages/ResumeDashboard'

const AgentChat = lazy(() => import('./pages/AgentChat/SophiaChat'))
const CreateNew = lazy(() => import('./pages/CreateNew'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/Login'))
const ResumeCreator = lazy(() => import('./pages/ResumeCreator'))
const StatsDashboardPage = lazy(() => import('./pages/StatsDashboard'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const ResumeEntryPage = lazy(() => import('./pages/ResumeEntry'))
const ApplicationProgressPage = lazy(() => import('./pages/ApplicationProgress'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const SharePage = lazy(() => import('./pages/SharePage'))
const Workspace = lazy(() => import('./pages/Workspace/v2'))
const HTMLWorkspace = lazy(() => import('./pages/Workspace/v2/html'))
const LaTeXWorkspace = lazy(() => import('./pages/Workspace/v2/latex'))
const ReportEdit = lazy(() => import('./pages/ReportEdit'))
const ReportsPage = lazy(() => import('./pages/Reports'))

function RouteFallback() {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">加载中...</p>
      </div>
    </div>
  )
}

function App() {
  const agentEnabled = isAgentEnabled()
  try {
    return (
      <ErrorBoundary>
        <ThemeInit />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              {/* 简历入口（侧栏「简历」点击后） */}
              <Route path="/resume-entry" element={<ResumeEntryPage />} />
              {/* 工作区路由 */}
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/workspace/latex" element={<LaTeXWorkspace />} />
              <Route path="/workspace/latex/:resumeId" element={<LaTeXWorkspace />} />
              <Route path="/workspace/html" element={<HTMLWorkspace />} />
              <Route path="/workspace/html/:resumeId" element={<HTMLWorkspace />} />
              {agentEnabled ? (
                <>
                  <Route path="/agent/new" element={<AgentChat />} />
                  <Route path="/agent/:resumeId" element={<AgentChat />} />
                  <Route path="/workspace/agent/new" element={<AgentChat />} />
                  <Route path="/workspace/agent/:resumeId" element={<AgentChat />} />
                </>
              ) : (
                <>
                  <Route path="/agent/new" element={<Navigate to="/workspace" replace />} />
                  <Route path="/agent/:resumeId" element={<Navigate to="/workspace" replace />} />
                  <Route path="/workspace/agent/new" element={<Navigate to="/workspace" replace />} />
                  <Route path="/workspace/agent/:resumeId" element={<Navigate to="/workspace" replace />} />
                </>
              )}
              {/* 其他路由 */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<StatsDashboardPage />} />
              <Route path="/my-resumes" element={<ResumeDashboard />} />
              <Route path="/applications" element={<ApplicationProgressPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/create-new" element={<CreateNew />} />
              {/* 简历创建路由 */}
              <Route path="/resume-creator" element={<ResumeCreator />} /> {/* 新手创建简历 */}
              <Route path="/share/:shareId" element={<SharePage />} />
              {/* 报告相关路由 */}
              <Route path="/reports/:reportId?" element={<ReportsPage />} />
              {/* 保留旧的编辑路由以兼容 */}
              <Route path="/reports/:reportId/edit" element={<ReportEdit />} />
            </Routes>
          </Suspense>
          <AuthModal />
        </BrowserRouter>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Error in App component:', error);
    return <div>应用加载出错，请查看控制台。</div>;
  }
}

export default App
