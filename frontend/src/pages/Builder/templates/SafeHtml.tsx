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

export default SafeHtml
