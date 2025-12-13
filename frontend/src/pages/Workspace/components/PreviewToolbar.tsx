/**
 * 预览工具栏组件
 * 显示 PDF 预览状态和操作按钮
 */
import React from 'react'
import { TimerDisplay } from '../../../hooks/useTimer'

interface PreviewToolbarProps {
  pdfDirty: boolean
  loadingPdf: boolean
  hasResume: boolean
  onSaveAndRender: () => void
  onDownload: () => void
  pdfTimer: {
    elapsedTime: number
    finalTime: number | null
    formatTime: (ms: number) => string
    getTimeColor: (ms: number) => string
  }
}

export function PreviewToolbar({
  pdfDirty,
  loadingPdf,
  hasResume,
  onSaveAndRender,
  onDownload,
  pdfTimer,
}: PreviewToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      background: 'rgba(0, 0, 0, 0.2)',
    }}>
      {/* 左侧：标题 + 状态 + 计时器 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 500 }}>
          PDF 预览
        </span>
        
        {/* 脏标记提示 */}
        {pdfDirty && !loadingPdf && (
          <span style={{ 
            fontSize: '11px', 
            color: '#fbbf24',
            background: 'rgba(251, 191, 36, 0.15)',
            padding: '2px 8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            ● 有未同步修改
          </span>
        )}
        
        {/* PDF 生成计时器 */}
        <TimerDisplay
          loading={loadingPdf}
          elapsedTime={pdfTimer.elapsedTime}
          finalTime={pdfTimer.finalTime}
          formatTime={pdfTimer.formatTime}
          getTimeColor={pdfTimer.getTimeColor}
        />
      </div>
      
      {/* 右侧按钮组 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* 更新预览按钮 - 只在有修改时显示 */}
        {pdfDirty && (
          <button
            onClick={onSaveAndRender}
            disabled={loadingPdf}
            style={{
              padding: '6px 14px',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '6px',
              color: '#86efac',
              fontSize: '12px',
              fontWeight: 500,
              cursor: loadingPdf ? 'not-allowed' : 'pointer',
              opacity: loadingPdf ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {loadingPdf ? '生成中...' : '🔄 更新预览'}
          </button>
        )}
        
        {/* 下载 PDF 按钮 */}
        <button
          onClick={onDownload}
          disabled={!hasResume || loadingPdf}
          style={{
            padding: '6px 14px',
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '6px',
            color: '#60a5fa',
            fontSize: '12px',
            cursor: (!hasResume || loadingPdf) ? 'not-allowed' : 'pointer',
            opacity: (!hasResume || loadingPdf) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {loadingPdf ? '生成中...' : '下载 PDF'}
        </button>
      </div>
    </div>
  )
}
