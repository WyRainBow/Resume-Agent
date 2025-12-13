/**
 * 背景装饰组件
 * 渐变紫色背景装饰和动画
 */
import React from 'react'

export function BackgroundDecoration() {
  return (
    <>
      {/* 紫色渐变背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 20s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        animation: 'float 15s ease-in-out infinite reverse'
      }} />
    </>
  )
}

export const globalStyles = `
  @keyframes float {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    50% { transform: translate(30px, -30px) rotate(5deg); }
  }
  @media (max-width: 768px) {
    .main-container {
      flex-direction: column !important;
    }
    .left-panel {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 100% !important;
      border-right: none !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
      max-height: 50vh;
    }
    .right-panel {
      width: 100% !important;
      flex: 1 !important;
    }
  }
  @media (max-width: 480px) {
    .left-panel {
      max-height: 40vh;
    }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`
