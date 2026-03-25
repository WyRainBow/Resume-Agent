/**
 * 按路径读取对象值，支持数组索引
 * 例：getByPath(obj, "experience[0].details")
 */
export function getByPath(obj: any, path: string): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  return parts.reduce((curr, key) => curr?.[key], obj)
}

/**
 * 按路径写入对象值，返回新对象（不可变）
 */
export function setByPath(obj: any, path: string, value: any): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  const result = structuredClone(obj)
  let curr = result
  for (let i = 0; i < parts.length - 1; i++) {
    curr = curr[parts[i]]
  }
  curr[parts[parts.length - 1]] = value
  return result
}

/**
 * 按 paths 数组批量写入 after 中的值到 resume。
 * 支持两种 after 格式：
 *   1. 嵌套结构: {experience: [{details: "..."}]}  → getByPath 取值
 *   2. 扁平 _raw 格式: {_raw: "新内容"} → 直接将 _raw 写入每个 path
 */
export function applyPatchPaths(resume: any, paths: string[], after: any): any {
  let result = resume

  // Backend sends {_raw: "..."} when the change is a single string value.
  // In this case apply _raw directly to each path.
  if (after && typeof after === 'object' && '_raw' in after) {
    const rawValue = (after as any)._raw
    for (const path of paths) {
      result = setByPath(result, path, rawValue)
    }
    return result
  }

  // Normal nested format: extract value at each path from after object
  for (const path of paths) {
    const value = getByPath(after, path)
    if (value !== undefined) {
      result = setByPath(result, path, value)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// 简历字段值规范化（从 resumeEditDiff.ts 迁移至此）
// ---------------------------------------------------------------------------

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripMarkdownMarkers(value: string): string {
  return value
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function looksLikeHtml(value: string): boolean {
  return /<([a-z][^/>]*?)>/i.test(value)
}

function toInlineHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

function markdownishTextToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let bulletBuffer: string[] = []

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return
    blocks.push(
      `<ul class="custom-list">${bulletBuffer
        .map((item) => `<li><p>${toInlineHtml(item)}</p></li>`)
        .join('')}</ul>`,
    )
    bulletBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets()
      continue
    }

    const bulletMatch = trimmed.match(/^([-*•]|\d+[.)])\s+(.+)$/)
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[2].trim())
      continue
    }

    flushBullets()
    const titleLine = trimmed.match(/^([^:：]{1,40})[:：]\s*(.+)$/)
    if (titleLine) {
      blocks.push(
        `<p><strong>${toInlineHtml(titleLine[1].trim())}：</strong>${toInlineHtml(
          titleLine[2].trim(),
        )}</p>`,
      )
      continue
    }
    blocks.push(`<p>${toInlineHtml(trimmed)}</p>`)
  }

  flushBullets()
  if (blocks.length === 0) return ''
  return `${blocks.join('')}<p></p>`
}

/**
 * 对简历字段的补丁值进行规范化处理：
 * - 纯文本字段：去掉 markdown/html 标记
 * - 富文本字段（details/description/skillContent/summary）：转换为 HTML
 */
export function normalizeResumePatchValue(
  value: unknown,
  path?: string,
  field?: string,
): unknown {
  if (typeof value !== 'string') return value
  const raw = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!raw) return ''

  const normalizedPath = String(path || '')
  const fallbackField = String(field || '')
  const leafFromPath = normalizedPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .pop()
  const leaf =
    typeof leafFromPath === 'string' && !/^\d+$/.test(leafFromPath)
      ? leafFromPath
      : fallbackField

  const richTextFields = new Set([
    'details',
    'description',
    'skillContent',
    'summary',
  ])
  if (!richTextFields.has(leaf)) {
    return decodeHtmlEntities(stripMarkdownMarkers(raw))
  }

  const cleanedRichRaw = stripMarkdownMarkers(raw)
  if (looksLikeHtml(cleanedRichRaw)) {
    return cleanedRichRaw
  }

  return markdownishTextToHtml(cleanedRichRaw)
}

// ---------------------------------------------------------------------------
// 旧版 markdown diff 解析工具（供 SophiaChat / useToolEventRouter 兼容层使用）
// ---------------------------------------------------------------------------

const BEFORE_LABEL = /(?:^|\n)\s*修改前\s*[:：]?/im
const AFTER_LABEL = /(?:^|\n)\s*修改后\s*[:：]?/im

function findLabelPosition(
  content: string,
  label: RegExp,
  fromIndex = 0,
): { index: number; length: number } | null {
  const matcher = new RegExp(label.source, label.flags.replace('g', ''))
  const sliced = content.slice(fromIndex)
  const match = matcher.exec(sliced)
  if (!match) return null
  return {
    index: fromIndex + match.index,
    length: match[0].length,
  }
}

function normalizeDiffSegment(raw: string): string {
  let value = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!value) return ''

  if (/^\s*`{1,3}/.test(value)) {
    value = value.replace(/^\s*`{1,3}[^\n]*\n?/, '')
    const closingIndex = value.search(/\n`{1,3}\s*(?:\n|$)/)
    if (closingIndex >= 0) {
      value = value.slice(0, closingIndex)
    }
  }

  value = value.replace(/^\s*text\s*\n/i, '')
  value = value.replace(/^\s*[:：]\s*/, '')
  value = value.replace(/\n?\s*`{1,3}\s*$/, '')
  return value.trim()
}

export function extractResumeEditDiff(content: string): {
  before: string
  after: string
} | null {
  if (!content) return null

  const beforePos = findLabelPosition(content, BEFORE_LABEL)
  if (!beforePos) return null
  const afterPos = findLabelPosition(
    content,
    AFTER_LABEL,
    beforePos.index + beforePos.length,
  )
  if (!afterPos) return null

  const beforeRaw = content.slice(
    beforePos.index + beforePos.length,
    afterPos.index,
  )
  const afterRaw = content.slice(afterPos.index + afterPos.length)
  const before = normalizeDiffSegment(beforeRaw)
  const after = normalizeDiffSegment(afterRaw)

  if (!before && !after) return null
  return { before, after }
}

export function stripResumeEditMarkdown(content: string): string {
  if (!content) return ''
  const beforePos = findLabelPosition(content, BEFORE_LABEL)
  if (!beforePos) return content.trim()
  return content
    .slice(0, beforePos.index)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToReadableText(value: string): string {
  if (!value) return ''
  const withLines = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/ul>|<\/ol>/gi, '\n')
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<b[^>]*>/gi, '')
    .replace(/<\/b>/gi, '')

  const stripped = withLines.replace(/<[^>]+>/g, ' ')
  const decoded = decodeHtmlEntities(stripped)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const dedupedLines: string[] = []
  for (const line of decoded.split('\n')) {
    const current = line.trim()
    if (!current) continue
    if (dedupedLines[dedupedLines.length - 1] === current) continue
    dedupedLines.push(current)
  }
  return dedupedLines.join('\n')
}

function compactProgressiveLines(raw: string): string {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length <= 1) return lines.join('\n')

  const compacted: string[] = []
  for (const line of lines) {
    const last = compacted[compacted.length - 1] || ''
    if (!last) {
      compacted.push(line)
      continue
    }
    if (line === last) continue
    if (line.startsWith(last)) {
      compacted[compacted.length - 1] = line
      continue
    }
    if (last.startsWith(line)) {
      continue
    }
    compacted.push(line)
  }
  return compacted.join('\n')
}

export function formatResumeDiffPreview(value?: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = looksLikeHtml(raw)
    ? htmlToReadableText(raw)
    : decodeHtmlEntities(stripMarkdownMarkers(raw))
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
  const compacted = compactProgressiveLines(normalized)
  const MAX_LEN = 900
  if (compacted.length <= MAX_LEN) return compacted
  return `${compacted.slice(0, MAX_LEN)}\n...（内容较长，已截断展示）`
}
