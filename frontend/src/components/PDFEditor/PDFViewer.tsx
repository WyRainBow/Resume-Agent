/**
 * PDF 查看器主组件
 * 整合 PDF 渲染和编辑功能
 */

import React, { useEffect, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFPage } from './PDFPage'
import { usePDFDocument } from './hooks/usePDFDocument'
import { useEditState } from './hooks/useEditState'
import type { PDFEditorProps } from './types'
import { editorStyles } from './styles'

export const PDFViewer: React.FC<PDFEditorProps> = ({
  pdfBlob,
  scale = 1.2,
  onContentChange,
}) => {
  const { pdfDoc, numPages, loading, error } = usePDFDocument(pdfBlob)
  const [pages, setPages] = useState<pdfjsLib.PDFPageProxy[]>([])
  const {
    edits,
    startEdit,
    updateEdit,
    finishEdit,
    cancelEdit,
    reEdit,
    getPageEdits,
    clearAllEdits,
  } = useEditState()

  // 当 PDF 变更时清空编辑状态
  useEffect(() => {
    if (pdfBlob) {
      clearAllEdits()
    }
  }, [pdfBlob, clearAllEdits])

  const handleFinishEdit = (editId: string) => {
    const edit = edits.get(editId)
    finishEdit(editId)
    
    // 如果内容有变化，通知父组件
    if (edit && onContentChange && edit.newText !== edit.originalText) {
      setTimeout(() => {
        onContentChange(edit.originalText, edit.newText)
      }, 0)
    }
  }

  // 加载所有页面
  useEffect(() => {
    if (!pdfDoc) {
      setPages([])
      return
    }

    const loadPages = async () => {
      const loadedPages: pdfjsLib.PDFPageProxy[] = []
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i)
        loadedPages.push(page)
      }
      setPages(loadedPages)
    }

    loadPages()
  }, [pdfDoc, numPages])

  // 渲染加载状态
  if (loading) {
    return (
      <div style={editorStyles.container}>
        <div style={editorStyles.loadingOverlay}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ color: 'white', fontWeight: 500 }}>加载中...</div>
        </div>
      </div>
    )
  }

  // 渲染错误状态
  if (error) {
    return (
      <div style={editorStyles.container}>
        <div style={{
          ...editorStyles.scrollArea,
          justifyContent: 'center',
        }}>
          <div style={{ color: '#fca5a5', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', marginBottom: '8px', fontWeight: 500 }}>加载失败</div>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{error}</div>
          </div>
        </div>
      </div>
    )
  }

  // 渲染空状态
  if (!pdfBlob) {
    return (
      <div style={editorStyles.container}>
        <div style={{
          ...editorStyles.scrollArea,
          justifyContent: 'center',
        }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ fontWeight: 500 }}>请先生成简历</div>
          </div>
        </div>
      </div>
    )
  }

  // 页面加载中
  if (pdfDoc && pages.length === 0) {
    return (
      <div style={editorStyles.container}>
        <div style={editorStyles.loadingOverlay}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ color: 'white', fontWeight: 500 }}>加载页面中...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={editorStyles.container}>
      <div style={editorStyles.scrollArea}>
        {pages.map((page, index) => (
          <PDFPage
            key={index}
            page={page}
            pageNumber={index + 1}
            scale={scale}
            pageEdits={getPageEdits(index + 1)}
            onStartEdit={startEdit}
            onUpdateEdit={updateEdit}
            onFinishEdit={handleFinishEdit}
            onCancelEdit={cancelEdit}
            onReEdit={reEdit}
          />
        ))}
      </div>
    </div>
  )
}
