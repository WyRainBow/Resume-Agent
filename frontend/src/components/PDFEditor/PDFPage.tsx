/**
 * PDF 单页渲染组件
 * 包含 PDF 底图渲染 + TextLayer + 编辑层
 */

import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from './TextLayer'
import { EditOverlay } from './EditOverlay'
import { useTextLayer } from './hooks/useTextLayer'
import type { EditItem, TextPosition } from './types'
import { editorStyles } from './styles'

interface PDFPageProps {
  page: pdfjsLib.PDFPageProxy
  pageNumber: number
  scale: number
  pageEdits: EditItem[]
  onStartEdit: (params: {
    pageNumber: number
    originalText: string
    position: TextPosition
    fontName: string
  }) => void
  onUpdateEdit: (id: string, newText: string) => void
  onFinishEdit: (id: string) => void
  onCancelEdit: (id: string) => void
  onReEdit: (id: string) => void
}

export const PDFPage: React.FC<PDFPageProps> = ({
  page,
  pageNumber,
  scale,
  pageEdits,
  onStartEdit,
  onUpdateEdit,
  onFinishEdit,
  onCancelEdit,
  onReEdit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [pageHeight, setPageHeight] = useState(0)
  const { textItems } = useTextLayer(page)

  // 渲染 PDF 页面
  useEffect(() => {
    const renderPage = async () => {
      if (!canvasRef.current) return

      const viewport = page.getViewport({ scale })
      
      // 保存 PDF 原始高度（用于坐标转换）
      const originalViewport = page.getViewport({ scale: 1 })
      setPageHeight(originalViewport.height)
      
      setDimensions({ 
        width: viewport.width, 
        height: viewport.height 
      })

      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      // 设置 Canvas 尺寸（考虑 DPR）
      const dpr = window.devicePixelRatio || 1
      canvas.width = viewport.width * dpr
      canvas.height = viewport.height * dpr
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      context.scale(dpr, dpr)

      // 渲染 PDF
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise
    }

    renderPage()
  }, [page, scale])

  // 处理文本点击
  const handleTextClick = (
    text: string, 
    position: TextPosition, 
    fontName: string
  ) => {
    onStartEdit({
      pageNumber,
      originalText: text,
      position,
      fontName,
    })
  }

  return (
    <div
      style={{
        ...editorStyles.pageContainer,
        width: dimensions.width || 'auto',
        height: dimensions.height || 'auto',
      }}
    >
      {/* 底层：PDF 渲染 */}
      <canvas
        ref={canvasRef}
        style={editorStyles.pdfCanvas}
      />

      {/* 中层：可点击的文本区域 */}
      {textItems.length > 0 && pageHeight > 0 && (
        <TextLayer
          textItems={textItems}
          pageHeight={pageHeight}
          scale={scale}
          pageEdits={pageEdits}
          onTextClick={handleTextClick}
        />
      )}

      {/* 顶层：编辑覆盖层 */}
      <EditOverlay
        edits={pageEdits}
        onUpdate={onUpdateEdit}
        onFinish={onFinishEdit}
        onCancel={onCancelEdit}
        onReEdit={onReEdit}
      />
    </div>
  )
}
