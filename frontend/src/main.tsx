import React from 'react'
import ReactDOM from 'react-dom/client'
import './tailwind.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { EnvironmentProvider } from './contexts/EnvironmentContext'
import { configureAuthWebRequests } from './lib/configureAuthWebRequests'

// 应用成功启动后清除 chunk 热更新标记，避免影响后续正常导航
sessionStorage.removeItem('resume-agent:chunk-reload')
configureAuthWebRequests()

try {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <EnvironmentProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </EnvironmentProvider>
  );
} catch (error) {
  console.error('Error rendering app:', error);
}
