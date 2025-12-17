import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import WorkspacePage from './pages/WorkspacePage'
import ResumeDashboard from './pages/ResumeDashboard'
import ErrorBoundary from './ErrorBoundary'

function App() {
  try {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/dashboard" element={<ResumeDashboard />} />
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
