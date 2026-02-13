import React from 'react'
import ReactDOM from 'react-dom/client'
import './tailwind.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { EnvironmentProvider } from './contexts/EnvironmentContext'

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
