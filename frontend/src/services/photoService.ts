// 用户照片上传服务

// 处理 API_BASE，确保有协议前缀
const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
let API_BASE = ''
if (rawApiBase) {
  API_BASE = rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`
} else {
  if (import.meta.env.PROD) {
    API_BASE = ''
  } else {
    API_BASE = 'http://localhost:9000'
  }
}

export type UploadPhotoResult = {
  url: string
  key: string
}

export async function uploadUserPhoto(file: File, token: string): Promise<UploadPhotoResult> {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch(`${API_BASE}/api/photos/upload`, {
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
