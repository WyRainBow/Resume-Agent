/**
 * Safe HTML Renderer —— 移植自 Resume-Matcher components/resume/safe-html.tsx。
 * 差异:清洗改用本地白名单序列化(sanitizeHtml.ts),不引 dompurify 依赖。
 */
import React from 'react'
import { sanitizeInlineHtml } from './sanitizeHtml'

interface SafeHtmlProps {
  /** HTML content to render (will be sanitized) */
  html: string
  /** Additional CSS classes */
  className?: string
  /** Render as a different element (default: span) */
  as?: 'span' | 'div' | 'p'
}

/**
 * Renders HTML content with XSS protection.
 * Only allows: <strong>, <em>, <u>, <a> tags.
 * Used in resume templates to render formatted bullet points.
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({ html, className, as: Component = 'span' }) => {
  if (!html) {
    return null
  }

  const cleanHtml = sanitizeInlineHtml(html)

  return (
    <Component
      className={['[&_a]:text-inherit [&_a]:underline', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  )
}

/**
 * 渲染带内联 **加粗** markdown 的单行字段（公司名 / 职位 / 学校名）。
 * 编辑区 BoldInput 以 `**文本**` 形式存储加粗，这里转成 <strong> 再走 SafeHtml，
 * 与后端 LaTeX（latex_utils 的 **→\textbf）保持同一份加粗约定。无 ** 时等价于纯文本。
 */
export const InlineBold: React.FC<{
  text?: string
  className?: string
  as?: 'span' | 'div' | 'p'
}> = ({ text, className, as }) => {
  if (!text) return null
  const html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return <SafeHtml html={html} className={className} as={as} />
}

export default SafeHtml
