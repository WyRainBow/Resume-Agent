/**
 * 加载遮罩组件
 * PDF 生成时的加载状态显示
 */
import React from 'react'

interface LoadingOverlayProps {
  visible: boolean
}

export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null
  
  return (
    <div style={{
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(102, 126, 234, 0.8)', 
      backdropFilter: 'blur(5px)',
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 10,
      color: 'white',
      fontSize: '18px',
      fontWeight: 600
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        正在生成 PDF...
      </div>
    </div>
  )
}
