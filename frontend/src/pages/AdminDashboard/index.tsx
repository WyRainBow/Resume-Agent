import { useEffect, useState } from 'react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { getApiBaseUrl, canUseAdminFeature } from '@/lib/runtimeEnv'

type UserStats = {
  total_users: number
}

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<UserStats | null>(null)

  useEffect(() => {
    if (!canUseAdminFeature()) {
      setError('无权限访问后台管理系统')
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/admin/stats/users`, {
          headers: getAuthHeaders(),
        })
        if (!resp.ok) {
          throw new Error(`请求失败: ${resp.status}`)
        }
        const data = (await resp.json()) as UserStats
        setStats(data)
      } catch (e: any) {
        setError(e?.message || '获取用户统计失败')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <WorkspaceLayout>
      <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">后台管理系统</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">平台基础数据看板</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-500">
              加载中...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-6 text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="text-sm text-slate-500 dark:text-slate-400">用户总数</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {stats?.total_users ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  )
}

