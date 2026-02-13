import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthModal } from './components/AuthModal'
import { ThemeInit } from './components/ThemeInit'
import ErrorBoundary from './ErrorBoundary'
import AgentChat from './pages/AgentChat/SophiaChat'
import CreateNew from './pages/CreateNew'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/Login'
import ResumeCreator from './pages/ResumeCreator'
import ResumeDashboard from './pages/ResumeDashboard'
import ResumeEntryPage from './pages/ResumeEntry'
import ApplicationProgressPage from './pages/ApplicationProgress'
import SettingsPage from './pages/Settings'
import SharePage from './pages/SharePage'
import TemplateMarket from './pages/TemplateMarket'
import Workspace from './pages/Workspace/v2'
import HTMLWorkspace from './pages/Workspace/v2/html'
import LaTeXWorkspace from './pages/Workspace/v2/latex'
import ReportEdit from './pages/ReportEdit'
import ReportsPage from './pages/Reports'

import WorkspaceLayout from './pages/WorkspaceLayout'

function App() {
  try {
    return (
      <ErrorBoundary>
        <ThemeInit />
        <BrowserRouter>
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
            <Route path="/agent/new" element={<AgentChat />} />
            <Route path="/agent/:resumeId" element={<AgentChat />} />
            <Route path="/workspace/agent/new" element={<AgentChat />} />
            <Route path="/workspace/agent/:resumeId" element={<AgentChat />} />
            {/* 其他路由 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<ResumeDashboard />} />
            <Route path="/applications" element={<ApplicationProgressPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/templates" element={<TemplateMarket />} />
            <Route path="/create-new" element={<CreateNew />} />
            {/* 简历创建路由 */}
            <Route path="/resume-creator" element={<ResumeCreator />} /> {/* 新手创建简历 */}
            <Route path="/share/:shareId" element={<SharePage />} />
            {/* 报告相关路由 */}
            <Route path="/reports/:reportId?" element={<ReportsPage />} />
            {/* 保留旧的编辑路由以兼容 */}
            <Route path="/reports/:reportId/edit" element={<ReportEdit />} />
          </Routes>
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
