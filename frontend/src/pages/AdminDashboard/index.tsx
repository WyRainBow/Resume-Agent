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
      <div className="h-full overflow-auto bg-slate-100 dark:bg-slate-950 p-6">
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

          <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 dark:border-slate-800">
              <h2 className="text-xl font-semibold text-white">提示词管理</h2>
              <p className="mt-1 text-sm text-slate-200">统一管理系统 Prompt，支持后续持续扩展</p>
            </div>

            <div className="space-y-4 bg-slate-50/70 p-6 dark:bg-slate-900">
              {promptLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  提示词加载中...
                </div>
              ) : (
                <>
                  {promptItems.length === 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                      当前没有可管理的提示词项，请检查后端配置。
                    </div>
                  ) : (
                    promptItems.map((item, index) => (
                      <article
                        key={item.key}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                            Prompt {index + 1}
                          </span>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                          <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.key}
                          </code>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>

                        <textarea
                          className="mt-3 w-full min-h-[200px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-mono leading-6 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          value={item.content}
                          onChange={(e) => handlePromptChange(item.key, e.target.value)}
                          placeholder={`请输入 ${item.title}`}
                        />

                        {item.variables.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.variables.map((v) => (
                              <span
                                key={`${item.key}-${v}`}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {`{${v}}`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-slate-400">该提示词无变量参数</div>
                        )}
                      </article>
                    ))
                  )}

                  {promptError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                      {promptError}
                    </div>
                  ) : null}
                  {promptSuccess ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
                      {promptSuccess}
                    </div>
                  ) : null}

                  <div className="sticky bottom-0 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">修改后请保存，配置会立即影响对应改写接口。</p>
                      <button
                        type="button"
                        onClick={handleSavePrompt}
                        disabled={promptSaving || promptItems.length === 0}
                        className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {promptSaving ? '保存中...' : '保存提示词'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </WorkspaceLayout>
  )
}
