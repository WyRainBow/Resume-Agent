import { useEffect, useState } from 'react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { getApiBaseUrl, canUseAdminFeature } from '@/lib/runtimeEnv'

type UserStats = {
  total_users: number
}

type PromptItem = {
  key: string
  title: string
  description: string
  variables: string[]
  content: string
}

const PROMPT_META: Record<string, { title: string; description: string; variables: string[] }> = {
  rewrite_text_prompt_template: {
    title: '划词润色模板',
    description: '用于 /api/resume/rewrite-text/stream',
    variables: ['locale', 'path_hint', 'instruction', 'source_text'],
  },
  rewrite_default_instruction: {
    title: '字段润色默认指令',
    description: '用于 /api/resume/rewrite 与 /api/resume/rewrite/stream 的兜底',
    variables: [],
  },
}

function parsePromptItems(payload: any): PromptItem[] {
  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  const templateSource =
    payload && typeof payload === 'object'
      ? (payload.templates && typeof payload.templates === 'object'
          ? payload.templates
          : payload)
      : {}

  const pairs = Object.entries(templateSource).filter(
    ([key, value]) => typeof key === 'string' && typeof value === 'string'
  ) as Array<[string, string]>

  return pairs.map(([key, content]) => {
    const meta = PROMPT_META[key] || {
      title: key,
      description: '通用提示词项',
      variables: [],
    }
    return {
      key,
      title: meta.title,
      description: meta.description,
      variables: meta.variables,
      content,
    }
  })
}

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<UserStats | null>(null)

  const [promptLoading, setPromptLoading] = useState(true)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptError, setPromptError] = useState('')
  const [promptSuccess, setPromptSuccess] = useState('')
  const [promptItems, setPromptItems] = useState<PromptItem[]>([])

  useEffect(() => {
    if (!canUseAdminFeature()) {
      setError('无权限访问后台管理系统')
      setLoading(false)
      setPromptLoading(false)
      return
    }

    const loadStats = async () => {
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

    const loadPrompts = async () => {
      setPromptLoading(true)
      setPromptError('')
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/config/prompts`, {
          headers: getAuthHeaders(),
        })
        if (!resp.ok) {
          throw new Error(`提示词加载失败: ${resp.status}`)
        }

        const data = await resp.json()
        const items = parsePromptItems(data)
        setPromptItems(items)
      } catch (e: any) {
        setPromptError(e?.message || '提示词加载失败')
      } finally {
        setPromptLoading(false)
      }
    }

    loadStats()
    loadPrompts()
  }, [])

  const handlePromptChange = (key: string, nextContent: string) => {
    setPromptItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, content: nextContent } : item))
    )
  }

  const handleSavePrompt = async () => {
    setPromptSaving(true)
    setPromptError('')
    setPromptSuccess('')

    const promptsPayload = promptItems.reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.content
      return acc
    }, {})

    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/config/prompts`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompts: promptsPayload }),
      })
      if (!resp.ok) {
        throw new Error(`保存失败: ${resp.status}`)
      }
      setPromptSuccess('提示词已保存')
    } catch (e: any) {
      setPromptError(e?.message || '提示词保存失败')
    } finally {
      setPromptSaving(false)
    }
  }

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

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">提示词管理</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">统一管理系统 Prompt，后续可持续扩展</p>
            </div>

            {promptLoading ? (
              <div className="text-slate-500">提示词加载中...</div>
            ) : (
              <>
                {promptItems.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    当前没有可管理的提示词项，请检查后端配置。
                  </div>
                ) : (
                  promptItems.map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.description}</div>
                      </div>
                      <textarea
                        className="w-full min-h-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={item.content}
                        onChange={(e) => handlePromptChange(item.key, e.target.value)}
                        placeholder={`请输入 ${item.title}`}
                      />
                      {item.variables.length > 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          可用变量：{item.variables.map((v) => `\`{${v}}\``).join('、')}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}

                {promptError ? (
                  <div className="text-sm text-red-600 dark:text-red-400">{promptError}</div>
                ) : null}
                {promptSuccess ? (
                  <div className="text-sm text-emerald-600 dark:text-emerald-400">{promptSuccess}</div>
                ) : null}

                <div>
                  <button
                    type="button"
                    onClick={handleSavePrompt}
                    disabled={promptSaving || promptItems.length === 0}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    {promptSaving ? '保存中...' : '保存提示词'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  )
}
