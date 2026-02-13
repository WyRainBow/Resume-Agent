// 用户照片上传服务
import { getApiBaseUrl } from '@/lib/runtimeEnv'

export type UploadPhotoResult = {
  url: string
  key: string
}

export async function uploadUserPhoto(file: File, token: string): Promise<UploadPhotoResult> {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch(`${getApiBaseUrl()}/api/photos/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传失败')
  }

  const data = await resp.json()
  if (!data.success) throw new Error('上传失败')

  return data.photo as UploadPhotoResult
}
