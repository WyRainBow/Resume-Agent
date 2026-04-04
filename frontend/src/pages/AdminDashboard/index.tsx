import { useEffect, useState } from 'react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { getApiBaseUrl, canUseAdminFeature } from '@/lib/runtimeEnv'

type UserStats = {
  total_users: number
}

const DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE = `你是资深简历优化专家。请将输入文本改写为大厂风格简历表述，并严格按用户指令执行。
- 语言: {locale}
- 字段路径: {path_hint}
- 改写指令: {instruction}

【任务目标】
把流水账式描述升级为高质量成果型表述，优先体现：问题（背景/瓶颈）-> 方案（技术手段）-> 收益（量化结果）。

【改写规则】
1. 严格基于原文事实，不编造项目、技术、数据。
2. 从“做了什么”升级到“怎么做”，优先补充可落地技术动作（分析方法、优化手段、架构调整、稳定性治理）。
3. 强化技术关键词，优先保留并突出原文已有关键词（如索引、执行计划、缓存、并发、架构、链路）。
4. 强化量化结果，优先保留原文数字与趋势表达（如 80%+、百万级降至万级）。
5. 语言专业、简洁、结果导向，避免空话（如“负责了/参与了/协助了”）。
6. 用动词开头，避免主观形容词堆砌。
7. 仅输出改写后的最终内容，不要解释，不要代码块。
8. 保持原段落结构，除非用户明确要求改结构。
9. 若原文包含 HTML 标签（如 <strong>/<ul>/<li>），必须输出 HTML 片段，不要改为 Markdown。
10. 若原文包含 HTML 标签，未要求变更的标签尽量保留。
11. 当用户要求“去掉加粗/取消加粗”时，移除 <strong>/<b> 以及 font-weight:bold 样式。
12. 当用户要求加粗（加粗/bold/加黑）时，必须使用 <strong> 标签，不要输出 ** Markdown 语法。

原文：
{source_text}`

const DEFAULT_REWRITE_DEFAULT_INSTRUCTION = `请将原始经历改写为大厂风格简历条目。
改写规则：
1. 严格基于原文事实，不编造项目、技术、数据
2. 每条尽量体现“问题 -> 方案 -> 收益”
3. 从“做了什么”升级为“怎么做”，补充可落地技术手段
4. 强化技术关键词（如索引、执行计划、缓存、并发、架构、链路）
5. 强化量化结果，优先保留原文数字与趋势表达（如80%+、百万级降至万级）
6. 语言专业、简洁、结果导向，避免空话，尽量动词开头
7. 保持原有信息完整性，并保留HTML标签（如 <strong>、<ul>、<li>）`

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
  const [rewritePromptTemplate, setRewritePromptTemplate] = useState(DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE)
  const [rewriteDefaultInstruction, setRewriteDefaultInstruction] = useState(DEFAULT_REWRITE_DEFAULT_INSTRUCTION)

  useEffect(() => {
    if (!canUseAdminFeature()) {
      setError('无权限访问后台管理系统')
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      setLoading(true)
      setError('')
      setPromptLoading(true)
      setPromptError('')
      try {
        const [statsResp, promptsResp] = await Promise.all([
          fetch(`${getApiBaseUrl()}/api/admin/stats/users`, {
            headers: getAuthHeaders(),
          }),
          fetch(`${getApiBaseUrl()}/api/config/prompts`, {
            headers: getAuthHeaders(),
          }),
        ])

        if (!statsResp.ok) {
          throw new Error(`请求失败: ${statsResp.status}`)
        }
        const data = (await statsResp.json()) as UserStats
        setStats(data)

        if (promptsResp.ok) {
          const prompts = (await promptsResp.json()) as {
            rewrite_text_prompt_template?: string
            rewrite_default_instruction?: string
          }
          setRewritePromptTemplate(prompts.rewrite_text_prompt_template || DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE)
          setRewriteDefaultInstruction(prompts.rewrite_default_instruction || DEFAULT_REWRITE_DEFAULT_INSTRUCTION)
        } else {
          setRewritePromptTemplate(DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE)
          setRewriteDefaultInstruction(DEFAULT_REWRITE_DEFAULT_INSTRUCTION)
          setPromptError(`提示词加载失败: ${promptsResp.status}`)
        }
      } catch (e: any) {
        setRewritePromptTemplate(DEFAULT_REWRITE_TEXT_PROMPT_TEMPLATE)
        setRewriteDefaultInstruction(DEFAULT_REWRITE_DEFAULT_INSTRUCTION)
        setError(e?.message || '获取用户统计失败')
      } finally {
        setLoading(false)
        setPromptLoading(false)
      }
    }

    fetchStats()
  }, [])

  const handleSavePrompt = async () => {
    setPromptSaving(true)
    setPromptError('')
    setPromptSuccess('')
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/config/prompts`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          rewrite_text_prompt_template: rewritePromptTemplate,
          rewrite_default_instruction: rewriteDefaultInstruction,
        }),
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">管理划词润色使用的 Prompt 模板</p>
            </div>

            {promptLoading ? (
              <div className="text-slate-500">提示词加载中...</div>
            ) : (
              <>
                <textarea
                  className="w-full min-h-[320px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={rewritePromptTemplate}
                  onChange={(e) => setRewritePromptTemplate(e.target.value)}
                  placeholder="请输入润色提示词模板"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  划词润色模板变量：`{'{locale}'}`、`{'{path_hint}'}`、`{'{instruction}'}`、`{'{source_text}'}`
                </div>
                <textarea
                  className="w-full min-h-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={rewriteDefaultInstruction}
                  onChange={(e) => setRewriteDefaultInstruction(e.target.value)}
                  placeholder="请输入字段润色默认指令"
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  字段润色默认指令：用于 `/api/resume/rewrite` 与 `/api/resume/rewrite/stream` 在未输入指令时的兜底 Prompt
                </div>
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
                    disabled={promptSaving}
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
