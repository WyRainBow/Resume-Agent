/**
 * 生日 / 年龄展示：编辑区与 PDF/HTML 渲染共用
 */

export function getAgeFromBirthDate(birthDate: string): number | null {
  const raw = (birthDate || '').trim()
  if (!raw) return null
  const m = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null
  const d = m[3] ? Number(m[3]) : 1
  const now = new Date()
  let age = now.getFullYear() - y
  const nowMonth = now.getMonth() + 1
  const nowDay = now.getDate()
  if (nowMonth < mo || (nowMonth === mo && nowDay < d)) age -= 1
  return age >= 0 && age <= 120 ? age : null
}

export function formatBirthDateForHeader(
  birthDate: string,
  mode: 'birthDate' | 'age'
): string {
  const raw = (birthDate || '').trim()
  if (!raw) return ''
  const age = getAgeFromBirthDate(raw)
  if (mode === 'age') {
    return age !== null ? `${age}岁` : raw
  }
  return raw
}

function compactContactToken(text: string): string {
  return text.replace(/[\s：:·\-]/g, '').toLowerCase()
}

/** 折叠联系栏中重复的「21 岁 · 21 岁」类片段 */
export function collapseDuplicateContactSegments(status: string): string {
  const trimmed = (status || '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return trimmed
  const compactParts = parts.map(compactContactToken)
  if (new Set(compactParts).size === 1) return parts[0]
  const deduped: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0 && compactParts[i] === compactParts[i - 1]) continue
    deduped.push(parts[i])
  }
  return deduped.join(' · ')
}

const AGE_ONLY_RE = /^(?:年龄[：:]\s*)?\d{1,3}\s*岁$/
const DATE_ONLY_RE = /^\d{4}[-/]\d{2}(?:[-/]\d{2})?$/

/** 状态字段是否只是一个年龄或生日年月（会被最新计算值替换） */
function statusIsPureAgeOrDate(s: string): boolean {
  return AGE_ONLY_RE.test(s) || DATE_ONLY_RE.test(s)
}

/** 状态字段内容是否与生日/年龄展示重复（避免 PDF 出现「21岁 · 21岁」） */
export function statusDuplicatesBirth(
  status: string | undefined,
  birthDate: string | undefined,
  mode: 'birthDate' | 'age' = 'birthDate'
): boolean {
  const s = (status || '').trim()
  const birth = (birthDate || '').trim()
  if (!s || !birth) return false
  const birthText = formatBirthDateForHeader(birth, mode)
  if (!birthText) return false
  const compactStatus = compactContactToken(s)
  const compactBirth = compactContactToken(birthText)
  if (compactBirth && compactStatus.includes(compactBirth)) return true
  if (compactContactToken(birth) && compactStatus.includes(compactContactToken(birth))) return true
  return false
}

/** 提交渲染或展示时：解析最终应输出的状态字段值，避免年龄重复或跨年错位 */
export function resolveEmploymentStatusForRender(
  status: string | undefined,
  birthDate: string | undefined,
  mode: 'birthDate' | 'age' = 'birthDate'
): string | undefined {
  const s = collapseDuplicateContactSegments((status || '').trim())
  if (!birthDate?.trim()) return s || undefined
  // 状态字段只是一个年龄/日期时，直接用最新计算值替换，避免跨年后 "20 岁 · 21 岁"
  if (s && statusIsPureAgeOrDate(s)) return undefined
  if (s && statusDuplicatesBirth(s, birthDate, mode)) return undefined
  return s || undefined
}
