/**
 * 简历预览组件入口
 * 
 * 目前默认使用 PDF 预览（通过 PDFPane）
 * HTML 预览已拆分到 HtmlPreview.tsx，保留代码供未来使用
 */

// 导出 HTML 预览组件（保留，供 AI 排版截图等功能使用）
export { default as HtmlPreview } from './HtmlPreview'

// 导出类型
export type { ResumePreviewProps } from './types'

// 默认导出 HtmlPreview（保持向后兼容）
export { default } from './HtmlPreview'
