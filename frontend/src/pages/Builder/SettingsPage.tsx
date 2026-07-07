/**
 * Builder 设置页 —— 按 Resume-Matcher /settings 中文版形态重写。
 * 来源:apps/frontend/app/(default)/settings/page.tsx(骨架:黑边容器/白头部/系统状态四卡/LLM 配置/危险区域/底栏)
 *
 * 差异(有意为之,非遗漏):
 * - 提供商只保留 DeepSeek(DashScope 兼容接口),固定选中;智谱/豆包不在此页出现
 * - 模型与 BASE URL 由服务端配置,此页只读展示,仅管理 API 密钥
 * - 不做 RM 的「推理深度」下拉:后端无 reasoning effort 能力
 * - 「重置数据库」按钮有意禁用:RM 是本地单用户库,我们是多用户生产库,不提供一键清空
 * - 接我方真实后端:/api/config/keys、/api/config/stats(均 admin 专属)、/api/ai/config、/api/ai/test-keys、/api/health
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  FlaskConical,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Server,
  Trash2,
  TriangleAlert,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { SwissButton } from './components/SwissButton'
import {
  type AiConfig,
  type ConfigStats,
  type KeysStatus,
  type TestKeysResult,
  clearAllKeys,
  deleteKey,
  getAiConfig,
  getConfigStats,
  getKeysStatus,
  pingBackend,
  saveKeys,
  testKeys,
} from './api'

const INPUT_CLASS =
  'w-full h-10 px-3 font-mono text-sm border border-black rounded-none bg-white ' +
  'placeholder:text-[#878E99] focus:outline-none focus:ring-2 focus:ring-blue-700'

const READONLY_INPUT_CLASS = cn(INPUT_CLASS, 'bg-[#F1F2F5]')

const LABEL_CLASS = 'font-mono text-xs font-bold uppercase tracking-wider'

const HINT_CLASS = 'font-mono text-xs text-[#878E99]'

const STATUS_CARD_CLASS = 'border border-black bg-white p-4 shadow-[2px_2px_0px_0px_#000000]'

function formatLastFetched(date: Date): string {
  if (Date.now() - date.getTime() < 60_000) return '刚刚'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function BuilderSettingsPage() {
  const navigate = useNavigate()

  const [statusLoading, setStatusLoading] = useState(true)
  const [backendUp, setBackendUp] = useState(false)
  const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null)
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null)
  const [stats, setStats] = useState<ConfigStats | null>(null)
  const [statusError, setStatusError] = useState('')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestKeysResult | null>(null)

  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [clearConfirming, setClearConfirming] = useState(false)

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError('')
    const up = await pingBackend()
    setBackendUp(up)
    if (up) {
      try {
        const [keys, config, statsData] = await Promise.all([
          getKeysStatus(),
          getAiConfig(),
          getConfigStats(),
        ])
        setKeysStatus(keys)
        setAiConfig(config)
        setStats(statsData)
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : String(err))
        setKeysStatus(null)
        setStats(null)
      }
    }
    setLastFetched(new Date())
    setStatusLoading(false)
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const handleTestKeys = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testKeys()
      setTestResult(result)
    } catch (err) {
      toast.error(`测试失败:${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const key = keyInput.trim()
    if (!key) {
      toast.error('没有要保存的密钥(留空表示保留现有密钥)')
      return
    }
    setSaving(true)
    try {
      await saveKeys({ deepseek_key: key })
      toast.success('API 密钥已保存到服务器配置')
      setKeyInput('')
      setTestResult(null)
      await refreshStatus()
    } catch (err) {
      toast.error(`保存失败:${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async () => {
    setDeleteConfirming(false)
    try {
      await deleteKey('deepseek')
      toast.success('已删除 DeepSeek API 密钥')
      setTestResult(null)
      await refreshStatus()
    } catch (err) {
      toast.error(`删除失败:${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleClearKeys = async () => {
    setClearConfirming(false)
    try {
      await clearAllKeys()
      toast.success('已清除所有 API 密钥')
      setTestResult(null)
      await refreshStatus()
    } catch (err) {
      toast.error(`清除失败:${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const deepseekTest = testResult?.deepseek
  const modelValue = aiConfig ? aiConfig.models['deepseek'] || aiConfig.defaultModel : ''

  return (
    <div className="flex flex-col items-center justify-start p-6 md:p-12 min-h-screen overflow-y-auto bg-[#F0F0E8]">
      <div className="w-full max-w-4xl border border-black bg-[#F0F0E8] shadow-[8px_8px_0px_0px_#000000]">
        {/* Header */}
        <div className="border-b border-black p-8 bg-white flex justify-between items-start">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">设置</h1>
            <p className="font-mono text-xs text-[#878E99] mt-2 uppercase tracking-wider">
              {'// '}配置您的偏好
            </p>
          </div>
          <SwissButton variant="outline" size="sm" onClick={() => navigate('/builder/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
            返回
          </SwissButton>
        </div>

        <div className="p-8 space-y-10">
          {/* 系统状态 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                    系统状态
                  </h2>
                </div>
                {lastFetched && (
                  <span className="font-mono text-xs text-[#878E99] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatLastFetched(lastFetched)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <SwissButton
                  variant="ghost"
                  size="sm"
                  onClick={handleTestKeys}
                  disabled={testing || !backendUp}
                  className="gap-1 text-xs"
                >
                  {testing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FlaskConical className="w-3 h-3" />
                  )}
                  测试 Key
                </SwissButton>
                <SwissButton
                  variant="ghost"
                  size="sm"
                  onClick={refreshStatus}
                  disabled={statusLoading}
                  className="gap-1 text-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} />
                  刷新
                </SwissButton>
              </div>
            </div>

            {statusLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#878E99]" />
              </div>
            ) : !backendUp ? (
              <div className="flex flex-col items-center justify-center p-8 gap-3 border border-dashed border-red-300 bg-red-50">
                <p className="font-mono text-xs text-red-600 uppercase">无法连接</p>
                <p className="font-mono text-xs text-[#444850]">后端未启动或不可达(/api/health)</p>
                <SwissButton
                  variant="outline"
                  size="sm"
                  onClick={refreshStatus}
                  className="gap-1 text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  重试
                </SwissButton>
              </div>
            ) : statusError ? (
              <div className="flex flex-col items-center justify-center p-8 gap-3 border border-dashed border-red-300 bg-red-50">
                <p className="font-mono text-xs text-red-600 uppercase">{statusError}</p>
                <p className="font-mono text-xs text-[#444850]">
                  状态接口为管理员专属,请确认当前账号为管理员
                </p>
              </div>
            ) : keysStatus && stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* LLM */}
                <div className={STATUS_CARD_CLASS}>
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-[#878E99]" />
                    <span className="font-mono text-xs uppercase text-[#878E99]">LLM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {keysStatus.deepseek.configured ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-mono text-sm font-bold">
                      {keysStatus.deepseek.configured ? '已配置' : '未配置'}
                    </span>
                  </div>
                  {deepseekTest?.configured && (
                    <div
                      className={`font-mono text-[10px] mt-1 ${deepseekTest.ok ? 'text-green-700' : 'text-red-600'}`}
                      title={deepseekTest.error || ''}
                    >
                      {deepseekTest.ok ? '测试通过' : '测试失败'}
                    </div>
                  )}
                </div>

                {/* 数据库 */}
                <div className={STATUS_CARD_CLASS}>
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-[#878E99]" />
                    <span className="font-mono text-xs uppercase text-[#878E99]">数据库</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {stats.db_ok ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-mono text-sm font-bold">
                      {stats.db_ok ? '已连接' : '异常'}
                    </span>
                  </div>
                </div>

                {/* 简历 */}
                <div className={STATUS_CARD_CLASS}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#878E99]" />
                    <span className="font-mono text-xs uppercase text-[#878E99]">简历</span>
                  </div>
                  <span className="font-mono text-2xl font-bold">{stats.resumes}</span>
                </div>

                {/* 用户 */}
                <div className={STATUS_CARD_CLASS}>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-[#878E99]" />
                    <span className="font-mono text-xs uppercase text-[#878E99]">用户</span>
                  </div>
                  <span className="font-mono text-2xl font-bold">{stats.users}</span>
                </div>
              </div>
            ) : null}
          </section>

          {/* LLM 配置 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-black/10 pb-2">
              <KeyRound className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">LLM 配置</h2>
            </div>

            <div className="space-y-5">
              {/* 提供商 */}
              <div className="space-y-2">
                <div className={LABEL_CLASS}>提供商</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 font-mono text-xs uppercase bg-blue-700 text-white border border-black shadow-[2px_2px_0px_0px_#000000]"
                  >
                    DEEPSEEK
                  </button>
                </div>
                <p className={HINT_CLASS}>已选择: DeepSeek(DashScope 兼容接口)</p>
              </div>

              {/* 模型 */}
              <div className="space-y-2">
                <label htmlFor="model" className={LABEL_CLASS}>
                  模型
                </label>
                <input
                  id="model"
                  type="text"
                  readOnly
                  className={READONLY_INPUT_CLASS}
                  value={modelValue}
                />
                <p className={HINT_CLASS}>
                  默认: {aiConfig ? aiConfig.defaultModel : '—'} ·
                  模型由服务端配置,此页仅管理密钥
                </p>
              </div>

              {/* API 密钥 */}
              <div className="space-y-2">
                <label htmlFor="api-key" className={LABEL_CLASS}>
                  API 密钥 (可选)
                </label>
                <input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  className={INPUT_CLASS}
                  placeholder="留空以保留现有密钥"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
                <p className={HINT_CLASS}>留空以保留现有密钥</p>
              </div>

              <div className="flex justify-end">
                <SwissButton size="sm" onClick={handleSave} disabled={saving || !backendUp}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? '保存中…' : '保存密钥'}
                </SwissButton>
              </div>

              {/* 已保存的 API 密钥 */}
              {keysStatus?.deepseek.configured && (
                <div className="space-y-2 border border-black bg-[#EEF2FF] p-3">
                  <p className="font-mono text-xs uppercase tracking-wide text-[#444850]">
                    已保存的 API 密钥
                  </p>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      <span className="font-bold">DeepSeek</span>
                      <span className="font-mono text-xs text-[#878E99]">
                        {keysStatus.deepseek.preview}
                      </span>
                    </span>
                    {deleteConfirming ? (
                      <button
                        type="button"
                        className="h-7 px-2 font-mono text-[10px] uppercase bg-red-600 text-white rounded-none"
                        onClick={handleDeleteKey}
                        onBlur={() => setDeleteConfirming(false)}
                        title="再点一次确认删除"
                      >
                        确认删除
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="font-mono text-xs uppercase text-red-600 hover:underline"
                        onClick={() => setDeleteConfirming(true)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* BASE URL */}
              <div className="space-y-2">
                <label htmlFor="base-url" className={LABEL_CLASS}>
                  BASE URL
                </label>
                <input
                  id="base-url"
                  type="text"
                  readOnly
                  className={READONLY_INPUT_CLASS}
                  value={stats ? stats.deepseek_base_url : ''}
                />
                <p className={HINT_CLASS}>DashScope 兼容接口地址,由服务端配置</p>
              </div>
            </div>
          </section>

          {/* 危险区域 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-red-200 pb-2">
              <TriangleAlert className="w-4 h-4 text-red-600" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-red-600">
                危险区域
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* 清除 API 密钥 */}
              <div className="border border-red-200 bg-red-50/40 p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-red-900 mb-1">清除 API 密钥</h3>
                  <p className="text-xs text-red-700">
                    从配置中删除所有存储的 API 密钥。此操作无法撤销。
                  </p>
                </div>
                <SwissButton
                  variant="outline"
                  size="sm"
                  onClick={clearConfirming ? handleClearKeys : () => setClearConfirming(true)}
                  onBlur={() => setClearConfirming(false)}
                  disabled={!backendUp}
                  className={clearConfirming ? 'bg-red-600 text-white hover:bg-red-700 hover:text-white' : ''}
                  title={clearConfirming ? '再点一次确认清除' : undefined}
                >
                  <KeyRound className="w-4 h-4" />
                  {clearConfirming ? '确认清除' : '清除 API 密钥'}
                </SwissButton>
              </div>

              {/* 重置数据库(有意禁用) */}
              <div className="border border-red-200 bg-red-50/40 p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-red-900 mb-1">重置数据库</h3>
                  <p className="text-xs text-red-700">
                    删除所有数据,包括简历和生成的内容。此操作无法撤销。
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  title="生产环境已禁用——多用户数据库不提供一键清空"
                  className="inline-flex items-center gap-2 h-8 px-4 font-mono text-xs uppercase tracking-wide rounded-none border border-black bg-red-600 text-white opacity-50 cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  重置数据库
                </button>
                <p className={HINT_CLASS}>生产环境已禁用——多用户数据库不提供一键清空</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-black p-4 flex justify-between font-mono text-xs">
          <span className="inline-flex items-center gap-2 text-[#878E99]">
            <img src="/favicon.svg" alt="" className="w-4 h-4" />
            简历构建模块
          </span>
          {backendUp ? (
            <span className="inline-flex items-center gap-2 text-green-700 font-bold">
              <span className="w-2 h-2 bg-green-700 inline-block"></span>
              状态: 就绪
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-red-600 font-bold">
              <span className="w-2 h-2 bg-red-600 inline-block"></span>
              状态: 离线
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
