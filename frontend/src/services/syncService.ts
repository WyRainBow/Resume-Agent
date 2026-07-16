import axios from 'axios'
import { getAuthHeaders } from '@/lib/authHeaders'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { SavedResume, StorageOperationContext } from './storage/StorageAdapter'

// withCredentials:configureAuthWebRequests 只 patch 全局 axios/fetch,
// axios.create 自建实例吃不到——走 auth-web(3000)代理时 BetterAuth cookie
// 不随行,代理注不了信任头,请求全部 401(2026-07-13 实测:sync 8 连 401)。
// 代理 CORS 已确认允许凭证(allow-credentials:true + 具体 origin)。
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
})

// 注意:不做"401 就删 auth_token"——sync 是后台尽力而为的兜底动作,它的
// 失败绝不能反过来清掉用户会话凭证。此前该拦截器叠加"进 agent 页自动
// sync"后,每次 401 都静默拔 token,把存储适配器打回 local 模式,造成
// Dashboard 删除只删本地、数据库残留幽灵简历(2026-07-13 实测)。
apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

/**
 * 将调用方已经锁定的本地快照合并到当前数据库账号。
 * 会话校验和本地缓存写入统一由 resumeStorage 负责，避免绕过存储会话边界。
 */
export async function syncResumesToDatabase(
  localResumes: SavedResume[],
  context?: StorageOperationContext,
): Promise<SavedResume[]> {
  if (localResumes.length === 0) {
    return []
  }
  const payload = {
    resumes: localResumes.map(r => ({
      id: r.id,
      name: r.name,
      alias: r.alias,  // 包含备注/别名
      template_type: r.templateType || (r.data as any)?.templateType || 'latex',  // 包含模板类型
      data: r.data,
      created_at: new Date(r.createdAt).toISOString(),
      updated_at: new Date(r.updatedAt).toISOString()
    }))
  }

  const { data } = await apiClient.post('/api/resumes/sync', payload, {
    headers: getAuthHeaders(),
    signal: context?.signal,
  })

  const merged: SavedResume[] = Array.isArray(data) ? data.map((item: any) => ({
    id: item.id,
    name: item.name,
    alias: item.alias,  // 解析备注/别名
    templateType: item.template_type || (item.data as any)?.templateType || 'latex',  // 解析模板类型
    data: item.data,
    createdAt: item.created_at ? Date.parse(item.created_at) : Date.now(),
    updatedAt: item.updated_at ? Date.parse(item.updated_at) : Date.now()
  })) : []

  return merged
}
