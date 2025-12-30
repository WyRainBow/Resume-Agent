import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Workspace from './pages/Workspace/v2'
import LaTeXWorkspace from './pages/Workspace/v2/latex'
import HTMLWorkspace from './pages/Workspace/v2/html'
import ResumeDashboard from './pages/ResumeDashboard'
import TemplateMarket from './pages/TemplateMarket'
import CreateNew from './pages/CreateNew'
import AIConversation from './pages/AIConversation' // 新增导入
import SharePage from './pages/SharePage'
import CVToolsTest from './pages/CVToolsTest' // CV 工具测试页面
import ErrorBoundary from './ErrorBoundary'

function App() {
  try {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            {/* 工作区路由 */}
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/workspace/latex" element={<LaTeXWorkspace />} />
            <Route path="/workspace/latex/:resumeId" element={<LaTeXWorkspace />} />
            <Route path="/workspace/html" element={<HTMLWorkspace />} />
            <Route path="/workspace/html/:resumeId" element={<HTMLWorkspace />} />
            {/* 其他路由 */}
            <Route path="/dashboard" element={<ResumeDashboard />} />
            <Route path="/templates" element={<TemplateMarket />} />
            <Route path="/create-new" element={<CreateNew />} />
            <Route path="/ai-conversation" element={<AIConversation />} /> {/* 新增路由 */}
            <Route path="/share/:shareId" element={<SharePage />} />
            <Route path="/conversation" element={<CVToolsTest />} /> {/* CV 工具自然语言对话页面 */}
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Error in App component:', error);
    return <div>应用加载出错，请查看控制台。</div>;
  }
}

export default App
