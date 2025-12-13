/**
 * 缩放控制组件
 * 预览区域底部的缩放控制条
 */
import React from 'react'

interface ZoomControlProps {
  scale: number
  setScale: React.Dispatch<React.SetStateAction<number>>
}

export function ZoomControl({ scale, setScale }: ZoomControlProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      zIndex: 20,
      border: '1px solid rgba(0, 0, 0, 0.05)',
    }}>
      <button
        onClick={() => setScale(prev => Math.max(0.5, +(prev - 0.1).toFixed(1)))}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#f3f4f6',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        -
      </button>
      <span style={{ fontSize: '14px', color: '#333', minWidth: '50px', textAlign: 'center', fontWeight: 500 }}>
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={() => setScale(prev => Math.min(2, +(prev + 0.1).toFixed(1)))}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#f3f4f6',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        +
      </button>
    </div>
  )
}
