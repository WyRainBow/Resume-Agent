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

      try {
        // 获取设备像素比
        const devicePixelRatio = window.devicePixelRatio || 1
        const isMobile = window.innerWidth < 768
        
        // 移动设备优化：降低渲染质量以提高性能
        const maxDeviceRatio = isMobile ? 1 : 2
        const renderScale = scale * Math.min(devicePixelRatio, maxDeviceRatio)

        // 跟随 PDF 页面的内嵌旋转信息，避免预览与真实 PDF 方向不一致
        const pageRotation = page.rotate || 0
        const viewport = page.getViewport({ scale: renderScale, rotation: pageRotation })

        // 保存 PDF 原始高度（用于坐标转换）
        const originalViewport = page.getViewport({ scale: 1, rotation: pageRotation })
        setPageHeight(originalViewport.height)

        // 设置显示尺寸（使用原始 scale）
        const displayViewport = page.getViewport({ scale, rotation: pageRotation })
        setDimensions({
          width: displayViewport.width,
          height: displayViewport.height
        })

        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        // 设置 Canvas 实际尺寸（高分辨率）
        canvas.width = viewport.width
        canvas.height = viewport.height

        // 设置 Canvas 显示尺寸（CSS 像素）
        canvas.style.width = `${displayViewport.width}px`
        canvas.style.height = `${displayViewport.height}px`

        // 渲染 PDF
        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        })
        
        await renderTask.promise
      } catch (error) {
        console.error('PDF page rendering error:', error)
        // 静默处理，让 PDFViewer 捕获错误
      }
    }

    renderPage()
  }, [page, pageNumber, scale])

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
