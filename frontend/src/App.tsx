import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthModal } from './components/AuthModal'
import { ChangelogModal } from './components/ChangelogModal'
import { ThemeInit } from './components/ThemeInit'
import ErrorBoundary from './ErrorBoundary'
import { Toaster } from './lib/toast'
import { ConfirmHost } from './lib/confirm'
import { lazyWithRetry } from './lib/lazyWithRetry'
import { canUseAdminFeature, isAgentEnabled } from './lib/runtimeEnv'
import { useAuth } from './contexts/AuthContext'
import ResumeDashboard from './pages/ResumeDashboard'
import { ResumeProvider } from './contexts/ResumeContext'

const AgentChat = lazyWithRetry(() => import('./pages/AgentChat/CocoChat'))
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'))
const CreateNew = lazyWithRetry(() => import('./pages/CreateNew'))
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'))
const LoginPage = lazyWithRetry(() => import('./pages/Login'))
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'))
const SharePage = lazyWithRetry(() => import('./pages/SharePage'))
const Workspace = lazyWithRetry(() => import('./pages/Workspace/v2'))
const BuilderPage = lazyWithRetry(() => import('./pages/Builder'))
const BuilderDashboardPage = lazyWithRetry(() => import('./pages/Builder/DashboardPage'))
const BuilderSettingsPage = lazyWithRetry(() => import('./pages/Builder/SettingsPage'))
/** 旧编辑器路由兼容：/workspace/latex|html/:resumeId → 统一 /workspace/:resumeId */
function WorkspaceLegacyRedirect() {
  const { resumeId } = useParams<{ resumeId?: string }>()
  return <Navigate to={resumeId ? `/workspace/${resumeId}` : '/workspace'} replace />
}
const LeetCodePage = lazyWithRetry(() => import('./pages/LeetCode'))
const TermsPage = lazyWithRetry(() => import('./pages/Legal/Terms'))
const PrivacyPage = lazyWithRetry(() => import('./pages/Legal/Privacy'))
const RefundPage = lazyWithRetry(() => import('./pages/Legal/Refund'))
const ChangelogPage = lazyWithRetry(() => import('./pages/Changelog'))
const AccountPage = lazyWithRetry(() => import('./pages/Account'))
const PricingPage = lazyWithRetry(() => import('./pages/Pricing'))
const ClicoClonePage = lazyWithRetry(() => import('./pages/ClicoClonePage'))

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
  // 订阅 AuthContext，确保登录/登出后路由权限会更新
  const { isAuthenticated, loading: authLoading } = useAuth()
  const agentPageEnabled = isAgentEnabled()
  const canUseAdmin = !authLoading && isAuthenticated && canUseAdminFeature()
  try {
    if (authLoading) {
      return <RouteFallback />
    }
    return (
      <ErrorBoundary>
        <ResumeProvider>
          <ThemeInit />
          <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              {/* 工作区路由 */}
              <Route path="/workspace" element={<Workspace />} />
              {/* /workspace/new：强制从默认模板新建（区别于裸 /workspace 载入当前简历） */}
              <Route path="/workspace/new" element={<Workspace />} />
              <Route path="/workspace/:resumeId" element={<Workspace />} />
              {/* 旧路由兼容：latex/html 编辑器已合并进统一 /workspace */}
              <Route path="/workspace/latex" element={<Navigate to="/workspace/new" replace />} />
              <Route path="/workspace/latex/:resumeId" element={<WorkspaceLegacyRedirect />} />
              <Route path="/workspace/html" element={<Navigate to="/workspace" replace />} />
              <Route path="/workspace/html/:resumeId" element={<WorkspaceLegacyRedirect />} />
              {/* 模板市场 Builder(RM 风格,独立新页,后续再并入导航) */}
              <Route path="/builder" element={<BuilderPage />} />
              <Route path="/builder/dashboard" element={<BuilderDashboardPage />} />
              {canUseAdmin ? (
                <Route path="/builder/settings" element={<BuilderSettingsPage />} />
              ) : (
                <Route path="/builder/settings" element={<Navigate to="/builder/dashboard" replace />} />
              )}
              <Route path="/builder/:resumeId" element={<BuilderPage />} />
              {agentPageEnabled ? (
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
              <Route path="/my-resumes" element={<ResumeDashboard />} />
              <Route path="/settings" element={<SettingsPage />} />
              {canUseAdmin ? (
                <Route path="/admin" element={<AdminDashboard />} />
              ) : (
                <Route path="/admin" element={<Navigate to="/workspace" replace />} />
              )}
              <Route path="/create-new" element={<CreateNew />} />
              <Route path="/leetcode/*" element={<LeetCodePage />} />
              <Route path="/share/:shareId" element={<SharePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/refund" element={<RefundPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/clico-clone" element={<ClicoClonePage />} />
            </Routes>
          </Suspense>
          <Toaster />
          <ConfirmHost />
          <AuthModal />
          <ChangelogModal />
        </BrowserRouter>
        </ResumeProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Error in App component:', error);
    return <div>应用加载出错，请查看控制台。</div>;
  }
}

export default App
