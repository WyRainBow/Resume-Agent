/**
 * Builder System Settings —— 复刻自 Resume-Matcher 的 /settings 页。
 * 来源:apps/frontend/app/(default)/settings/page.tsx(骨架:黑边容器/白头部/SYSTEM STATUS 状态卡/LLM 配置表单)
 *
 * 差异(按用户决策裁剪):
 * - 只支持国产模型:DeepSeek(DashScope 兼容口)/ 智谱 GLM / 豆包;无 provider 下拉、无 base_url/model 编辑
 * - 砍掉 RM 的 features/prompts/language/reset-database 区块
 * - 接我方真实后端:GET/POST /api/config/keys(admin 专属)、GET /api/ai/test-keys、GET /api/ai/config、/api/health
 * - Key 写入服务器 .env(全局配置),页面路由与后端端点均为管理员专属
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Loader2,
  RefreshCw,
  Save,
  Server,
  XCircle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { SwissButton } from './components/SwissButton'
import {
  type AiConfig,
  type KeysStatus,
  type ProviderId,
  type TestKeysResult,
  getAiConfig,
  getKeysStatus,
  pingBackend,
  saveKeys,
  testKeys,
} from './api'

const PROVIDERS: { id: ProviderId; name: string; envKey: string; note: string }[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envKey: 'DASHSCOPE_API_KEY',
    note: 'DashScope 兼容接口 · 主力对话/生成',
  },
  { id: 'zhipu', name: '智谱 GLM', envKey: 'ZHIPU_API_KEY', note: 'OCR / 视觉解析' },
  { id: 'doubao', name: '豆包', envKey: 'DOUBAO_API_KEY', note: '备选模型' },
]

const INPUT_CLASS =
  'w-full h-10 px-3 font-mono text-sm border border-black rounded-none bg-white ' +
  'placeholder:text-[#878E99] focus:outline-none focus:ring-2 focus:ring-blue-700'

export default function BuilderSettingsPage() {
  const navigate = useNavigate()

  const [statusLoading, setStatusLoading] = useState(true)
  const [backendUp, setBackendUp] = useState(false)
  const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestKeysResult | null>(null)

  const [inputs, setInputs] = useState<Record<ProviderId, string>>({
    deepseek: '',
    zhipu: '',
    doubao: '',
  })
  const [saving, setSaving] = useState(false)

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError('')
    const up = await pingBackend()
    setBackendUp(up)
    if (up) {
      try {
        const [keys, config] = await Promise.all([getKeysStatus(), getAiConfig()])
        setKeysStatus(keys)
        setAiConfig(config)
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : String(err))
        setKeysStatus(null)
      }
    }
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
    const payload = {
      deepseek_key: inputs.deepseek.trim() || undefined,
      zhipu_key: inputs.zhipu.trim() || undefined,
      doubao_key: inputs.doubao.trim() || undefined,
    }
    if (!payload.deepseek_key && !payload.zhipu_key && !payload.doubao_key) {
      toast.error('没有要保存的 Key(留空表示保留现有配置)')
      return
    }
    setSaving(true)
    try {
      await saveKeys(payload)
      toast.success('API Key 已保存到服务器配置')
      setInputs({ deepseek: '', zhipu: '', doubao: '' })
      setTestResult(null)
      await refreshStatus()
    } catch (err) {
      toast.error(`保存失败:${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const anyUnconfigured =
    !statusLoading && backendUp && keysStatus
      ? PROVIDERS.some((p) => !keysStatus[p.id]?.configured)
      : false

  return (
    <div className="flex flex-col items-center justify-start p-6 md:p-12 min-h-screen overflow-y-auto bg-[#F0F0E8]">
      <div className="w-full max-w-4xl border border-black bg-[#F0F0E8] shadow-[8px_8px_0px_0px_#000000]">
        {/* Header */}
        <div className="border-b border-black p-8 bg-white flex justify-between items-start">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight uppercase">
              System Settings
            </h1>
            <p className="font-mono text-xs text-[#878E99] mt-2 uppercase tracking-wider">
              {'// '}模型配置 · 国产模型
            </p>
          </div>
          <SwissButton variant="outline" size="sm" onClick={() => navigate('/builder/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
            返回
          </SwissButton>
        </div>

        <div className="p-8 space-y-10">
          {/* Setup warning banner */}
          {anyUnconfigured && (
            <div className="border-2 border-amber-500 bg-amber-50 p-4 shadow-[4px_4px_0px_0px_#000000]">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-amber-500 mt-1 shrink-0"></div>
                <div className="flex-1">
                  <p className="font-mono text-sm font-bold uppercase tracking-wider text-amber-800">
                    需要配置
                  </p>
                  <p className="font-mono text-xs text-amber-700 mt-1">
                    存在未配置的模型 Key,相关 AI 能力不可用。在下方「模型配置」填入后保存。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                  系统状态
                </h2>
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
                <SwissButton variant="outline" size="sm" onClick={refreshStatus} className="gap-1 text-xs">
                  <RefreshCw className="w-3 h-3" />
                  重试
                </SwissButton>
              </div>
            ) : statusError ? (
              <div className="flex flex-col items-center justify-center p-8 gap-3 border border-dashed border-red-300 bg-red-50">
                <p className="font-mono text-xs text-red-600 uppercase">{statusError}</p>
                <p className="font-mono text-xs text-[#444850]">
                  Key 状态接口为管理员专属,请确认当前账号为管理员
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Backend Status */}
                <div className="border border-black bg-white p-4 shadow-[2px_2px_0px_0px_#000000]">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-[#878E99]" />
                    <span className="font-mono text-xs uppercase text-[#878E99]">后端</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-mono text-sm font-bold">正常</span>
                  </div>
                </div>

                {/* Provider Status Cards */}
                {PROVIDERS.map((provider) => {
                  const status = keysStatus?.[provider.id]
                  const test = testResult?.[provider.id]
                  return (
                    <div
                      key={provider.id}
                      className="border border-black bg-white p-4 shadow-[2px_2px_0px_0px_#000000]"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs uppercase text-[#878E99]">
                          {provider.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {status?.configured ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-mono text-sm font-bold">
                          {status?.configured ? '已配置' : '未配置'}
                        </span>
                      </div>
                      {status?.configured && status.preview && (
                        <div className="font-mono text-[10px] text-[#878E99] mt-1">
                          {status.preview}
                        </div>
                      )}
                      {test && test.configured && (
                        <div
                          className={`font-mono text-[10px] mt-1 ${test.ok ? 'text-green-700' : 'text-red-600'}`}
                          title={test.error || ''}
                        >
                          {test.ok ? '测试通过' : `测试失败${test.error ? ` · ${test.error.slice(0, 40)}` : ''}`}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* LLM Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-black/10 pb-2">
              <Server className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                模型配置
              </h2>
            </div>

            {/* 当前默认模型(只读,来自 /api/ai/config) */}
            {aiConfig && (
              <div className="border border-black bg-white p-4 shadow-[2px_2px_0px_0px_#000000]">
                <div className="font-mono text-xs uppercase text-[#878E99] mb-2">
                  当前默认模型
                </div>
                <div className="font-mono text-sm">
                  <span className="font-bold uppercase">{aiConfig.defaultProvider}</span>
                  <span className="text-[#878E99]"> · </span>
                  <span>{aiConfig.defaultModel}</span>
                </div>
                <div className="font-mono text-[10px] text-[#878E99] mt-1">
                  默认模型由服务端配置决定,此页仅管理各 Provider 的 API Key
                </div>
              </div>
            )}

            {/* Key 输入区:留空 = 保留现有 */}
            <div className="border border-black bg-white shadow-[4px_4px_0px_0px_#000000]">
              <div className="border-b border-black p-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-700"></div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  API Keys
                </span>
              </div>
              <div className="p-4 space-y-5">
                {PROVIDERS.map((provider) => {
                  const status = keysStatus?.[provider.id]
                  return (
                    <div key={provider.id}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <label
                          htmlFor={`key-${provider.id}`}
                          className="font-mono text-xs font-bold uppercase tracking-wider"
                        >
                          {provider.name}
                          <span className="text-[#878E99] font-normal"> · {provider.envKey}</span>
                        </label>
                        <span className="font-mono text-[10px] text-[#878E99]">
                          {provider.note}
                        </span>
                      </div>
                      <input
                        id={`key-${provider.id}`}
                        type="password"
                        autoComplete="off"
                        className={INPUT_CLASS}
                        placeholder={
                          status?.configured
                            ? `已配置(${status.preview})· 留空保留现有`
                            : '输入 API Key'
                        }
                        value={inputs[provider.id]}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                        }
                      />
                    </div>
                  )
                })}

                <div className="flex items-center justify-between pt-2 border-t border-[#F1F2F5]">
                  <span className="font-mono text-[10px] text-[#878E99]">
                    Key 保存至服务器全局配置(.env),仅管理员可读写
                  </span>
                  <SwissButton size="sm" onClick={handleSave} disabled={saving || !backendUp}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? '保存中…' : '保存 Key'}
                  </SwissButton>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
