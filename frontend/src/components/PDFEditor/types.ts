/**
 * PDF 编辑器类型定义
 */

import * as pdfjsLib from 'pdfjs-dist'

// PDF 文本项（来自 PDF.js TextLayer）
export interface TextItem {
  str: string           // 文本内容
  dir: string           // 文本方向
  width: number         // 宽度
  height: number        // 高度
  transform: number[]   // 变换矩阵 [scaleX, skewX, skewY, scaleY, x, y]
  fontName: string      // 字体名称
  hasEOL: boolean       // 是否有换行
}

// 文本位置信息
export interface TextPosition {
  left: number
  top: number
  width: number
  height: number
  fontSize: number
}

// 编辑项
export interface EditItem {
  id: string                    // 唯一标识
  pageNumber: number            // 页码 (1-based)
  originalText: string          // 原始文本
  newText: string               // 修改后的文本
  position: TextPosition        // 位置信息
  fontName: string              // 字体名称
  isEditing: boolean            // 是否正在编辑
}

// 页面数据
export interface PageData {
  pageNumber: number
  width: number
  height: number
  scale: number
  textItems: TextItem[]
}

// 编辑器状态
export interface EditorState {
  edits: Map<string, EditItem>  // 所有编辑项
  activeEditId: string | null   // 当前激活的编辑项 ID
  isExporting: boolean          // 是否正在导出
}

// 缓存页面
export interface CachedPage {
  pageNumber: number
  page: pdfjsLib.PDFPageProxy
  viewport: pdfjsLib.PageViewport
  canvas?: HTMLCanvasElement
  lastUsed: number
  textItems?: any[]
  isLoading?: boolean
}

// 编辑器 Props
export interface PDFEditorProps {
  pdfBlob: Blob | null
  scale?: number
  onScaleChange?: (scale: number) => void
  onContentChange?: (originalText: string, newText: string) => void
}
