/**
 * 公司 Logo 管理
 * Logo 数据从后端 /api/logos 接口动态获取
 * 后端统一维护 Logo 列表，前端不再硬编码
 */

export interface CompanyLogo {
  key: string
  name: string
  url: string        // 完整的 COS URL（由后端返回）
  keywords: string[] // 用于模糊匹配公司名称
}

// 缓存：从 API 获取的 Logo 列表
let _cachedLogos: CompanyLogo[] = []
let _fetchPromise: Promise<CompanyLogo[]> | null = null
let _loaded = false

// 事件通知：Logo 列表加载完成时通知订阅者
type Listener = (logos: CompanyLogo[]) => void
const _listeners: Set<Listener> = new Set()

export function onLogosLoaded(listener: Listener): () => void {
  _listeners.add(listener)
  // 如果已经加载过，立即触发
  if (_loaded && _cachedLogos.length > 0) {
    listener(_cachedLogos)
  }
  return () => _listeners.delete(listener)
}

/**
 * 从后端获取 Logo 列表（带缓存，只请求一次）
 */
export async function fetchLogos(): Promise<CompanyLogo[]> {
  if (_loaded && _cachedLogos.length > 0) {
    return _cachedLogos
  }

  if (_fetchPromise) {
    return _fetchPromise
  }

  _fetchPromise = (async () => {
    try {
      const resp = await fetch('/api/logos')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      _cachedLogos = data.logos || []
      _loaded = true
      // 通知所有订阅者
      _listeners.forEach((fn) => fn(_cachedLogos))
      return _cachedLogos
    } catch (err) {
      console.error('[Logo] 获取 Logo 列表失败:', err)
      _fetchPromise = null // 允许重试
      return []
    }
  })()

  return _fetchPromise
}

/**
 * 获取已缓存的 Logo 列表（同步，需要先调用 fetchLogos）
 */
export function getCachedLogos(): CompanyLogo[] {
  return _cachedLogos
}

/**
 * 根据 key 获取 Logo 的完整 URL
 */
export function getLogoUrl(key: string): string | null {
  const logo = _cachedLogos.find((l) => l.key === key)
  return logo?.url || null
}

/**
 * 根据公司名称模糊匹配预设 Logo
 * 返回匹配到的 Logo key，未匹配返回 null
 */
export function matchCompanyLogo(companyName: string): string | null {
  if (!companyName || _cachedLogos.length === 0) return null
  const lowerName = companyName.toLowerCase().replace(/\*\*/g, '') // 去除 markdown 加粗
  for (const logo of _cachedLogos) {
    for (const keyword of logo.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return logo.key
      }
    }
  }
  return null
}

/**
 * 根据 key 获取 Logo 配置
 */
export function getLogoByKey(key: string): CompanyLogo | null {
  return _cachedLogos.find((l) => l.key === key) || null
}

/**
 * 强制刷新 Logo 列表（清除缓存后重新获取）
 */
export async function refreshLogos(): Promise<CompanyLogo[]> {
  _loaded = false
  _fetchPromise = null
  _cachedLogos = []
  return fetchLogos()
}

/**
 * 上传自定义 Logo 到 COS
 * 返回上传后的 Logo 信息
 */
export async function uploadLogo(file: File): Promise<CompanyLogo> {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch('/api/logos/upload', {
    method: 'POST',
    body: formData,
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传失败')
  }

  const data = await resp.json()
  if (!data.success) throw new Error('上传失败')

  // 刷新列表
  await refreshLogos()

  return data.logo as CompanyLogo
}

// 模块被导入时自动预加载 Logo 列表
fetchLogos()
