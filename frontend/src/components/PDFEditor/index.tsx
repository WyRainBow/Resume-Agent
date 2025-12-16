/**
 * PDF 编辑器入口
 * 导出所有公共 API
 */

// 主组件
export { PDFViewer } from './PDFViewer'
export { PDFViewerSelector } from './PDFViewerSelector'

// 类型
export type {
  PDFEditorProps,
  EditItem,
  TextItem,
  TextPosition,
  EditorState,
  PageData,
} from './types'

// 工具函数
export { exportEditedPdf, downloadPdf } from './utils/exportPdf'

// Hooks
export { useEditState } from './hooks/useEditState'
export { usePDFDocument } from './hooks/usePDFDocument'
