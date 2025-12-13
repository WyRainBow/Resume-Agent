/**
 * 工具栏组件
 * 包含视图切换、基础操作和核心功能按钮
 */
import React from 'react'

interface ToolbarProps {
  showEditor: boolean
  setShowEditor: (show: boolean) => void
  showResumeList: boolean
  setShowResumeList: (show: boolean) => void
  setShowAIImport: (show: boolean) => void
  setShowGuide: (show: boolean) => void
  onReset: () => void
  onAIOptimize: () => void
  loadingPdf: boolean
  optimizing: boolean
  hasResume: boolean
}

export function Toolbar({
  showEditor,
  setShowEditor,
  showResumeList,
  setShowResumeList,
  setShowAIImport,
  setShowGuide,
  onReset,
  onAIOptimize,
  loadingPdf,
  optimizing,
  hasResume,
}: ToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 20px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      background: 'rgba(0, 0, 0, 0.05)',
      gap: '12px',
    }}>
      {/* 第一行：视图切换 + 基础操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* 视图切换 */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          padding: '3px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <button
            onClick={() => setShowEditor(false)}
            style={{
              padding: '4px 10px',
              background: !showEditor ? 'rgba(167, 139, 250, 0.5)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: !showEditor ? 'white' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            JSON
          </button>
          <button
            onClick={() => setShowEditor(true)}
            style={{
              padding: '4px 10px',
              background: showEditor ? 'rgba(167, 139, 250, 0.5)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: showEditor ? 'white' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            可视化
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 重置 */}
          <button
            onClick={onReset}
            disabled={loadingPdf}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              color: '#fca5a5',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: loadingPdf ? 'not-allowed' : 'pointer',
              opacity: loadingPdf ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            重置
          </button>

          {/* 我的简历 */}
          <button
            onClick={() => setShowResumeList(!showResumeList)}
            style={{
              background: showResumeList ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              border: showResumeList ? '1px solid rgba(102, 126, 234, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#e9d5ff',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            我的简历
          </button>
        </div>
      </div>

      {/* 第二行：核心功能按钮 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px' }}>
        <button
          onClick={() => setShowAIImport(true)}
          style={{
            height: '32px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
            border: '1px solid rgba(167, 139, 250, 0.3)',
            borderRadius: '6px',
            color: '#e9d5ff',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          AI导入
        </button>

        <button
          onClick={onAIOptimize}
          disabled={!hasResume || optimizing}
          style={{
            height: '32px',
            background: optimizing 
              ? 'rgba(239, 68, 68, 0.2)' 
              : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px',
            fontWeight: 500,
            cursor: (!hasResume || optimizing) ? 'not-allowed' : 'pointer',
            opacity: !hasResume ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          {optimizing ? '排版中' : 'AI排版'}
        </button>
        
        <button
          onClick={() => setShowGuide(true)}
          style={{
            height: '32px',
            padding: '0 10px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#c4b5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
          title="查看引导"
        >
          引导
        </button>
      </div>
    </div>
  )
}
