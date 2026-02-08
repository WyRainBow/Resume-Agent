/**
 * 剥离 HTML 标签，保留纯文本内容
 * 用于清理富文本编辑器中残留的 HTML（如 <div><br></div>）
 */
export function stripHtmlTags(text: string): string {
  if (!text) return text
  let result = text.replace(/<\s*(?:br|div|p)\s*\/?>/gi, ' ')
  result = result.replace(/<[^>]+>/g, '')
  return result.replace(/\s+/g, ' ').trim()
}
