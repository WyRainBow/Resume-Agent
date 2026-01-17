import React from 'react'
import ReactDOM from 'react-dom/client'
import './tailwind.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'

try {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
} catch (error) {
  console.error('Error rendering app:', error);
}

