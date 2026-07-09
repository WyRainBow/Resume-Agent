// 用户照片上传服务
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import { BETTER_AUTH_TOKEN } from '@/contexts/AuthContext'

export type UploadPhotoResult = {
  url: string
  key: string
}

/** BetterAuth 用户的 token 是占位符，不能当 Bearer 发（会顶掉代理侧的 cookie session）；
 * 该场景下省略 Authorization，纯靠 cookie 让 auth-web 代理注入可信头。 */
function buildAuthHeaders(token: string): Record<string, string> {
  if (!token || token === BETTER_AUTH_TOKEN) return {}
  return { Authorization: `Bearer ${token}` }
}

export async function uploadUserPhoto(file: File, token: string): Promise<UploadPhotoResult> {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch(`${getApiBaseUrl()}/api/photos/upload`, {
    method: 'POST',
    body: formData,
    headers: buildAuthHeaders(token),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传失败')
  }

  const data = await resp.json()
  if (!data.success) throw new Error('上传失败')

  return data.photo as UploadPhotoResult
}

export type UserPhoto = {
  url: string
  key: string
}

/** 列出当前用户已上传的照片，供复用选择（避免重复上传） */
export async function listUserPhotos(token: string): Promise<UserPhoto[]> {
  const resp = await fetch(`${getApiBaseUrl()}/api/photos/list`, {
    headers: buildAuthHeaders(token),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: '读取照片列表失败' }))
    throw new Error(err.detail || '读取照片列表失败')
  }

  const data = await resp.json()
  return (data.photos || []) as UserPhoto[]
}
