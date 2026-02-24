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
let _lastError: string | null = null

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
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
    const retries = [0, 1000, 2000]
    for (let i = 0; i < retries.length; i++) {
      try {
        if (retries[i] > 0) {
          await delay(retries[i])
        }
        const resp = await fetch('/api/logos')
        if (!resp.ok) {
          const errMsg = await parseErrorMessage(resp)
          throw new Error(errMsg)
        }
        const data = await resp.json()
        _cachedLogos = data.logos || []
        _loaded = true
        _lastError = null
        // 通知所有订阅者
        _listeners.forEach((fn) => fn(_cachedLogos))
        return _cachedLogos
      } catch (err) {
        _lastError = stringifyError(err)
        if (i === retries.length - 1) {
          console.error('[Logo] 获取 Logo 列表失败:', err)
          _fetchPromise = null // 允许重试
          return []
        }
      }
    }
    return []
  })()

  return _fetchPromise
}

/**
 * 获取已缓存的 Logo 列表（同步，需要先调用 fetchLogos）
 */
export function getCachedLogos(): CompanyLogo[] {
  return _cachedLogos
}

export function getLastLogoError(): string | null {
  return _lastError
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
  const token = localStorage.getItem('auth_token')

  const resp = await fetch('/api/logos/upload', {
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

  // 刷新列表
  await refreshLogos()

  return data.logo as CompanyLogo
}

// 模块被导入时自动预加载 Logo 列表
fetchLogos()
