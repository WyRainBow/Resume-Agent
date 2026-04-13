export interface JDIntentMatch {
  matched: boolean
  sourceType: 'url' | 'text'
  value: string
}

const JD_INTENT_PATTERNS = [
  /岗位分析/,
  /jd分析/i,
  /jd匹配/i,
  /岗位对齐/,
  /职位匹配/,
  /招聘链接/,
  /岗位描述/,
  /优化简历.*岗位/,
  /针对.*岗位.*简历/,
]

const URL_PATTERN = /(https?:\/\/[^\s]+)/i

export function detectJDIntent(input: string): JDIntentMatch | null {
  const trimmed = String(input || '').trim()
  if (!trimmed) return null
  const matched = JD_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed))
  if (!matched) return null
  const urlMatch = trimmed.match(URL_PATTERN)
  if (urlMatch) {
    return { matched: true, sourceType: 'url', value: urlMatch[1] }
  }
  const looksLikeJDText = trimmed.length >= 80 || trimmed.includes('\n')
  return { matched: true, sourceType: 'text', value: looksLikeJDText ? trimmed : '' }
}
