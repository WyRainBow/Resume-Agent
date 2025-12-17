/**
 * 工具栏组件
 * 包含视图切换、基础操作和核心功能按钮
 */
import React from 'react'

interface ToolbarProps {
  showResumeList: boolean
  setShowResumeList: (show: boolean) => void
  setShowAIImport: (show: boolean) => void
  setShowGuide: (show: boolean) => void
  onReset: () => void
  onAIOptimize: () => void
  onNewResume?: () => void  // 新建简历功能
  onImportLatex?: () => void  // 导入 LaTeX 功能
  onImportJson?: () => void  // 导入 JSON 功能
  onSaveToLibrary?: () => void  // 保存到简历库
  loadingPdf: boolean
  optimizing: boolean
  hasResume: boolean
  hasPdfBlob: boolean  // 是否有 PDF 数据
}

export function Toolbar({
  showResumeList,
  setShowResumeList,
  setShowAIImport,
  setShowGuide,
  onReset,
  onAIOptimize,
  onNewResume,
  onImportLatex,
  onImportJson,
  onSaveToLibrary,
  loadingPdf,
  optimizing,
  hasResume,
  hasPdfBlob,
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
      {/* 第一行：基础操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 新建简历 */}
          {onNewResume && (
            <button
              onClick={onNewResume}
              disabled={loadingPdf}
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '6px',
                color: '#86efac',
                fontSize: '12px',
                fontWeight: 500,
                cursor: loadingPdf ? 'not-allowed' : 'pointer',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '14px' }}>+</span>
              新建
            </button>
          )}

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '8px' }}>
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

        {/* 导入 LaTeX */}
        <button
          onClick={onImportLatex}
          disabled={loadingPdf}
          style={{
            height: '32px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            color: '#86efac',
            fontSize: '12px',
            fontWeight: 500,
            cursor: loadingPdf ? 'not-allowed' : 'pointer',
            opacity: loadingPdf ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          LaTeX
        </button>

        {/* 导入 JSON */}
        <button
          onClick={onImportJson}
          disabled={loadingPdf}
          style={{
            height: '32px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            color: '#93c5fd',
            fontSize: '12px',
            fontWeight: 500,
            cursor: loadingPdf ? 'not-allowed' : 'pointer',
            opacity: loadingPdf ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          JSON
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

        {/* 保存到简历库 */}
        <button
          onClick={onSaveToLibrary}
          disabled={!hasPdfBlob || loadingPdf}
          style={{
            height: '32px',
            padding: '0 12px',
            background: hasPdfBlob ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)' : 'rgba(255, 255, 255, 0.08)',
            border: hasPdfBlob ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: hasPdfBlob ? '#93c5fd' : 'rgba(255,255,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (!hasPdfBlob || loadingPdf) ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            gap: '4px',
          }}
          title="保存到简历库"
        >
          保存
        </button>
      </div>
    </div>
  )
}
