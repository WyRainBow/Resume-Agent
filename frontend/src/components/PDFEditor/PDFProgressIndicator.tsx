/**
 * PDF 生成进度指示器
 * 显示流式PDF生成的实时进度
 */
import React from 'react'

interface PDFProgressIndicatorProps {
  progress: string
  visible: boolean
}

export function PDFProgressIndicator({ progress, visible }: PDFProgressIndicatorProps) {
  if (!visible) return null

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      padding: '24px 32px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      textAlign: 'center',
      minWidth: '300px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* 动画图标 */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse 2s infinite'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 12L22 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 12L2 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 12V22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* 进度文本 */}
        <div>
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#333',
            marginBottom: '8px'
          }}>
            正在生成简历 PDF
          </div>
          <div style={{
            fontSize: '14px',
            color: '#666',
            fontFamily: 'monospace'
          }}>
            {progress}
          </div>
        </div>

        {/* 加载条 */}
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#e5e7eb',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            background: 'linear-gradient(90deg, #667eea, #764ba2)',
            borderRadius: '2px',
            animation: 'slide 1.5s infinite ease-in-out'
          }} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.95); }
        }

        @keyframes slide {
          0% { left: -100%; width: 30%; }
          50% { left: 50%; width: 40%; }
          100% { left: 100%; width: 30%; }
        }
      `}</style>
    </div>
  )
}