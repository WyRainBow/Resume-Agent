/**
 * PDF 查看器选择器
 * 直接使用标准 PDFViewer
 */

import React from 'react'
import { PDFViewer } from './PDFViewer'
import type { PDFEditorProps } from './types'

export const PDFViewerSelector: React.FC<PDFEditorProps> = (props) => {
  return <PDFViewer {...props} />
}
