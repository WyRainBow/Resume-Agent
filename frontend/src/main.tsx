import React from 'react'
import ReactDOM from 'react-dom/client'
import './tailwind.css'
import App from './App'

try {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <App />
  );
} catch (error) {
  console.error('Error rendering app:', error);
}

