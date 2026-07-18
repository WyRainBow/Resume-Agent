// 用户照片上传服务
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import { BETTER_AUTH_TOKEN } from '@/contexts/AuthContext'

export type UploadPhotoResult = {
  url: string
  key: string
}

/** 2026-07-17 身份统一：JWT 已下架，认证纯靠 BetterAuth cookie（代理注入可信头），
 * 不再注入 Authorization Bearer。保留签名兼容调用方。 */
function buildAuthHeaders(_token: string): Record<string, string> {
  return {}
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
