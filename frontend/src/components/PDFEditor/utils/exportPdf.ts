/**
 * PDF 导出工具
 * 将编辑后的内容合并到 PDF 中
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { EditItem } from '../types'
import { pxToPt, hexToPdfRgb } from './coordinates'

/**
 * 导出编辑后的 PDF
 * @param originalBlob 原始 PDF Blob
 * @param edits 所有编辑项
 * @param scale 渲染时使用的缩放比例
 * @returns 新的 PDF Blob
 */
export const exportEditedPdf = async (
  originalBlob: Blob,
  edits: Map<string, EditItem>,
  scale: number
): Promise<Blob> => {
  // 加载原始 PDF
  const arrayBuffer = await originalBlob.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  
  // 预加载标准字体
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  
  const pages = pdfDoc.getPages()

  // 按页面分组编辑项
  const editsByPage = new Map<number, EditItem[]>()
  for (const edit of edits.values()) {
    const pageEdits = editsByPage.get(edit.pageNumber) || []
    pageEdits.push(edit)
    editsByPage.set(edit.pageNumber, pageEdits)
  }

  // 处理每个页面的编辑
  for (const [pageNumber, pageEdits] of editsByPage) {
    const pageIndex = pageNumber - 1
    if (pageIndex < 0 || pageIndex >= pages.length) continue

    const pdfPage = pages[pageIndex]
    const { height: pageHeight } = pdfPage.getSize()

    for (const edit of pageEdits) {
      // 跳过未修改的内容
      if (edit.newText === edit.originalText) continue

      const pos = edit.position

      // 将屏幕坐标转换为 PDF 坐标
      const x = pxToPt(pos.left, scale)
      const width = pxToPt(pos.width, scale)
      const height = pxToPt(pos.height, scale)
      const fontSize = pxToPt(pos.fontSize, scale)
      
      // PDF Y 坐标是从底部算起的
      const topInPt = pxToPt(pos.top, scale)
      const y = pageHeight - topInPt - height

      // 1. 先绘制白色背景遮盖原文
      pdfPage.drawRectangle({
        x: x - 2,
        y: y - 2,
        width: width + 4,
        height: height + 4,
        color: rgb(1, 1, 1), // 白色
      })

      // 2. 绘制新文本
      pdfPage.drawText(edit.newText, {
        x,
        y: y + height * 0.2, // 调整基线位置
        size: fontSize,
        font: helveticaFont,
        color: rgb(0, 0, 0), // 黑色
      })
    }
  }

  // 保存并返回新的 PDF
  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
}

/**
 * 下载 PDF 文件
 */
export const downloadPdf = (blob: Blob, filename?: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `resume_edited_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
