/**
 * 导航头部组件
 * 包含返回首页按钮和 Logo
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'

export function NavHeader() {
  const navigate = useNavigate()
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      background: 'rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: 'rgba(255, 255, 255, 0.8)',
            padding: '8px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← 首页
        </button>
        <div style={{
          fontSize: '18px',
          fontWeight: 700,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          Resume Agent
        </div>
      </div>
    </div>
  )
}
