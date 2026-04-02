/**
 * 学校 Logo 管理
 * 数据从后端 /api/school-logos 接口动态获取
 */

export interface SchoolLogo {
  key: string
  name: string
  group?: string
  url: string
  keywords: string[]
}

export interface SchoolLogoGroup {
  key: string
  name: string
  logos: SchoolLogo[]
}

let _cachedSchoolLogos: SchoolLogo[] = []
let _cachedSchoolLogoGroups: SchoolLogoGroup[] = []
let _fetchPromise: Promise<SchoolLogo[]> | null = null
let _loaded = false
let _lastError: string | null = null

function normalizeForMatch(text: string): string {
  return (text || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]·\-—_/]/g, '')
    .replace(/中华人民共和国/g, '')
    .replace(/中国/g, '')
    .toLowerCase()
}

async function parseErrorMessage(resp: Response): Promise<string> {
  const fallback = `HTTP ${resp.status}`
  try {
    const data = await resp.clone().json()
    if (data?.detail?.message) return data.detail.message
    if (data?.detail && typeof data.detail === 'string') return data.detail
    if (data?.error_message) return data.error_message
    if (data?.error) return data.error
  } catch {
    // ignore json parse failure
  }
  try {
    const text = await resp.text()
    if (text) return text.slice(0, 200)
  } catch {
    // ignore body read failure
  }
  return fallback
}

function buildGroupsFromFlat(logos: SchoolLogo[]): SchoolLogoGroup[] {
  const grouped = new Map<string, SchoolLogo[]>()
  for (const logo of logos) {
    const key = logo.group || '未分组'
    const list = grouped.get(key) || []
    list.push(logo)
    grouped.set(key, list)
  }
  return Array.from(grouped.entries()).map(([key, items]) => ({
    key,
    name: key,
    logos: items,
  }))
}

/**
 * 从后端获取学校 Logo 列表（带缓存，只请求一次）
 */
export async function fetchSchoolLogos(): Promise<SchoolLogo[]> {
  if (_loaded && _cachedSchoolLogos.length > 0) {
    return _cachedSchoolLogos
  }
  if (_fetchPromise) {
    return _fetchPromise
  }

  _fetchPromise = (async () => {
    try {
      const resp = await fetch('/api/school-logos')
      if (!resp.ok) {
        throw new Error(await parseErrorMessage(resp))
      }
      const data = await resp.json()
      _cachedSchoolLogos = data.logos || []
      _cachedSchoolLogoGroups = data.groups?.length ? data.groups : buildGroupsFromFlat(_cachedSchoolLogos)
      _loaded = true
      _lastError = null
      return _cachedSchoolLogos
    } catch (err) {
      _lastError = err instanceof Error ? err.message : String(err)
      console.error('[SchoolLogo] 获取 Logo 列表失败:', err)
      _fetchPromise = null
      return []
    }
  })()

  return _fetchPromise
}

export function getCachedSchoolLogos(): SchoolLogo[] {
  return _cachedSchoolLogos
}

export function getCachedSchoolLogoGroups(): SchoolLogoGroup[] {
  return _cachedSchoolLogoGroups
}

export function getLastSchoolLogoError(): string | null {
  return _lastError
}

export function getSchoolLogoUrl(key: string): string | null {
  const logo = _cachedSchoolLogos.find((l) => l.key === key)
  return logo?.url || null
}

export function getSchoolLogoByKey(key: string): SchoolLogo | undefined {
  return _cachedSchoolLogos.find((l) => l.key === key)
}

export async function uploadSchoolLogo(file: File, group: string): Promise<SchoolLogo> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('group', group)
  const token = localStorage.getItem('auth_token')

  const resp = await fetch('/api/school-logos/upload', {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('请先登录并使用有权限的账号上传 Logo')
    }
    const err = await resp.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传失败')
  }

  const data = await resp.json()
  if (!data.success) throw new Error('上传失败')

  await refreshSchoolLogos()
  return data.logo as SchoolLogo
}

/**
 * 根据学校名称模糊匹配学校 Logo
 */
export function matchSchoolLogo(schoolName: string): string | null {
  if (!schoolName || _cachedSchoolLogos.length === 0) return null
  const target = normalizeForMatch(schoolName)
  if (!target) return null

  for (const logo of _cachedSchoolLogos) {
    const nameNorm = normalizeForMatch(logo.name)
    if (nameNorm && (target.includes(nameNorm) || nameNorm.includes(target))) {
      return logo.key
    }

    for (const keyword of logo.keywords || []) {
      const keywordNorm = normalizeForMatch(keyword)
      if (keywordNorm && (target.includes(keywordNorm) || keywordNorm.includes(target))) {
        return logo.key
      }
    }
  }
  return null
}

/**
 * 强制刷新学校 Logo 列表
 */
export async function refreshSchoolLogos(): Promise<SchoolLogo[]> {
  _loaded = false
  _fetchPromise = null
  _cachedSchoolLogos = []
  _cachedSchoolLogoGroups = []
  return fetchSchoolLogos()
}

// 模块被导入时自动预加载
fetchSchoolLogos()
