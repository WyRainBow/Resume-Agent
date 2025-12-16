/**
 * PDF 查看器选择器
 * 根据页面数量自动选择最优查看器
 * 优先使用支持编辑功能的查看器
 */

import React, { useState, useEffect } from 'react'
import { PDFViewer } from './PDFViewer'
import { VirtualizedFastPDFViewer } from './VirtualizedFastPDFViewer'
import type { PDFEditorProps } from './types'

export const PDFViewerSelector: React.FC<PDFEditorProps> = (props) => {
  const [pageCount, setPageCount] = useState(0)
  const [useVirtualized, setUseVirtualized] = useState(false)

  // 检测PDF页数
  useEffect(() => {
    if (props.pdfBlob) {
      // 估算页数（简单方法：每页约50KB）
      const estimatedPages = Math.ceil(props.pdfBlob.size / (50 * 1024))
      setPageCount(estimatedPages)

      // 调整阈值：只有页数超过5且文件超过2MB时才使用虚拟化
      // 这样可以确保大多数简历PDF使用标准编辑器
      const shouldUseVirtualized = estimatedPages > 5 || props.pdfBlob.size > 2 * 1024 * 1024
      setUseVirtualized(shouldUseVirtualized)
    }
  }, [props.pdfBlob])

  // 开发环境下显示选择信息
  if (process.env.NODE_ENV === 'development') {
    console.log(`PDF查看器模式: ${useVirtualized ? '虚拟化高速' : '标准编辑'} (估算页数: ${pageCount}, 文件大小: ${(props.pdfBlob?.size || 0) / 1024}KB)`)
  }

  return useVirtualized ? (
    <VirtualizedFastPDFViewer {...props} />
  ) : (
    <PDFViewer {...props} />
  )
}