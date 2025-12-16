/**
 * PDF.js Worker 配置
 */

import * as pdfjsLib from 'pdfjs-dist'

// 配置 worker 源
export function configurePDFWorker() {
  // 使用 CDN
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  // 优化 PDF.js 性能配置
  pdfjsLib.GlobalWorkerOptions.workerPort = null
}

// 初始化PDF配置
export const initPDF = () => {
  configurePDFWorker()
}
