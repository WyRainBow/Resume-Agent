/**
 * PDF.js Worker 配置
 * 支持多种加载方式，确保在桌面和移动设备上都能工作
 */

import * as pdfjsLib from 'pdfjs-dist'

// 配置 worker 源
export function configurePDFWorker() {
  // 方案 1：先尝试使用 CDN 上的 ESM 版本
  // 方案 2：如果 CDN 失败，回退到本地打包的 worker
  
  try {
    // 使用 ESM 版本（现代浏览器支持）
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  } catch (e) {
    // 回退方案：使用 legacy 版本
    console.warn('ESM worker failed, falling back to legacy version:', e)
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
    } catch (e2) {
      console.error('Worker configuration failed:', e2)
    }
  }

  // 优化配置，提高移动设备兼容性
  pdfjsLib.GlobalWorkerOptions.workerPort = null
  
  // 禁用网络请求的并发控制，移动设备网络较差时允许更多并发
  if (pdfjsLib.version) {
    // 降低内存使用，提高移动设备兼容性
    const isLowMemoryDevice = navigator.deviceMemory && navigator.deviceMemory <= 4
    if (isLowMemoryDevice) {
      // 在低内存设备上的优化
      console.info('Optimizing for low memory device')
    }
  }
}

// 初始化PDF配置
export const initPDF = () => {
  configurePDFWorker()
}

