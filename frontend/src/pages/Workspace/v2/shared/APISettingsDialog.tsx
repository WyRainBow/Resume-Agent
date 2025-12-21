/**
 * API 设置对话框组件
 * 用于全局配置 AI 模型和 API Key
 */
import { useState, useEffect } from 'react'
import { X, Save, Key, Settings, TestTube, CheckCircle2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { aiTest, getKeysStatus, saveKeys } from '../../../../services/api'
import TokenMonitor from '../../../../components/TokenMonitor'

// 处理 API_BASE，确保有协议前缀
const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const API_BASE = rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`

// 智谱 AI 图标组件 - BigModel 风格的三维六边形图标
const ZhipuAIIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      {/* 顶部左侧 - 浅蓝色 */}
      <linearGradient id="topLeftGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      {/* 顶部右侧 - 深蓝色 */}
      <linearGradient id="topRightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
      {/* 底部 - 紫蓝色 */}
      <linearGradient id="bottomGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
      {/* 星星发光效果 */}
      <filter id="glow">
        <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* 六边形 - 三维效果，分三个面 */}
    {/* 顶部左侧面 */}
    <path
      d="M12 3L18.5 7L12 10.5L5.5 7L12 3Z"
      fill="url(#topLeftGradient)"
    />
    {/* 顶部右侧面 */}
    <path
      d="M18.5 7L18.5 17L12 21L12 10.5L18.5 7Z"
      fill="url(#topRightGradient)"
    />
    {/* 底侧面 */}
    <path
      d="M5.5 7L5.5 17L12 21L12 10.5L5.5 7Z"
      fill="url(#bottomGradient)"
    />
    
    {/* 中心白色四角星/钻石 - 带发光效果 */}
    <path
      d="M12 10L13.5 12.5L16.5 13L14.5 15L15 18L12 16.5L9 18L9.5 15L7.5 13L10.5 12.5L12 10Z"
      fill="white"
      filter="url(#glow)"
      opacity="0.95"
    />
  </svg>
)

interface APISettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function APISettingsDialog({
  open,
  onOpenChange,
}: APISettingsDialogProps) {
  const [zhipuKey, setZhipuKey] = useState('')
  const [zhipuModel] = useState('glm-4-flash') // 固定使用 GLM-4-Flash
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>('')
  const [testUsage, setTestUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined>()
  const [backendConfigured, setBackendConfigured] = useState(false) // 后端是否已配置 API Key

  // 加载当前配置
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  const loadConfig = async () => {
    try {
      const data = await getKeysStatus()
      if (data.zhipu) {
        setBackendConfigured(data.zhipu.configured)
        if (data.zhipu.configured) {
          // 后端已配置，显示预览（不显示完整 Key）
          setZhipuKey(data.zhipu.preview || '已配置')
        } else {
          setZhipuKey('')
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      setBackendConfigured(false)
    }
  }

  const handleSave = async () => {
    // 如果后端已配置，不需要保存
    if (backendConfigured) {
      alert('后端已配置 API Key：无需再次配置。所有用户可直接使用。')
      onOpenChange(false)
      return
    }

    setLoading(true)
    setSaveSuccess(false)
    
    try {
      const result = await saveKeys(zhipuKey, undefined)
      
      if (!result.success) {
        throw new Error(result.message || '保存失败')
      }

      // 保存模型配置到 localStorage
      localStorage.setItem('ai_provider', 'zhipu')
      localStorage.setItem('ai_model', zhipuModel)

      // 重新加载配置
      await loadConfig()

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onOpenChange(false)
      }, 1500)
    } catch (error: any) {
      console.error('保存失败:', error)
      alert(`保存失败: ${error.message || '请重试'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  const handleTest = async () => {
    // 如果后端未配置且前端也没有输入 Key，提示输入
    if (!backendConfigured && !zhipuKey.trim()) {
      alert('请先输入 API Key 或确保后端已配置 API Key')
      return
    }

    setTesting(true)
    setTestResult('')
    setTestUsage(undefined)

    try {
      // 如果后端未配置，先保存 API Key
      if (!backendConfigured && zhipuKey.trim()) {
        await saveKeys(zhipuKey, undefined)
      }

      // 测试 API（使用后端配置的 Key）
      const result = await aiTest('zhipu', '请用一句话介绍人工智能')
      setTestResult(result.result || '测试成功')
      if (result.usage) {
        setTestUsage(result.usage)
      }
    } catch (error: any) {
      setTestResult(`测试失败: ${error.message || '未知错误'}`)
    } finally {
      setTesting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className={cn(
          'relative w-full max-w-md mx-4',
          'bg-white dark:bg-slate-900',
          'rounded-2xl shadow-2xl',
          'border border-slate-200 dark:border-slate-700',
          'overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                API 设置
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                配置 AI 模型和 API Key
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'transition-colors',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 智谱 AI 配置 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ZhipuAIIcon className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                智谱 AI (GLM-4-Flash)
              </h3>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
                {backendConfigured && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    后端已配置
                  </span>
                )}
              </label>
              {backendConfigured ? (
                <div className="w-full px-4 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">后端已配置 API Key：所有用户可直接使用。无需再次配置</span>
                </div>
              ) : (
                <input
                  type="password"
                  value={zhipuKey}
                  onChange={(e) => setZhipuKey(e.target.value)}
                  placeholder="请输入智谱 AI API Key（如果后端未配置）"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg',
                    'bg-slate-50 dark:bg-slate-800',
                    'border border-slate-200 dark:border-slate-700',
                    'text-slate-900 dark:text-slate-100',
                    'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'transition-all'
                  )}
                />
              )}
            </div>

          </div>

          {/* AI 测试 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <TestTube className="w-4 h-4" />
                API 测试
              </label>
              <button
                onClick={handleTest}
                disabled={testing || (!backendConfigured && !zhipuKey.trim())}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium',
                  'bg-blue-500 hover:bg-blue-600 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors flex items-center gap-2'
                )}
              >
                {testing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    测试中...
                  </>
                ) : (
                  '测试连接'
                )}
              </button>
            </div>
            {testResult && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-300">{testResult}</p>
                {testUsage && (
                  <div className="mt-2">
                    <TokenMonitor usage={testUsage} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 提示信息 */}
          <div className={cn(
            "p-4 rounded-lg border",
            backendConfigured 
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          )}>
            <p className={cn(
              "text-sm",
              backendConfigured
                ? "text-green-700 dark:text-green-300"
                : "text-blue-700 dark:text-blue-300"
            )}>
              {backendConfigured 
                ? " 后端已配置 API Key：所有用户可直接使用 AI 功能。无需再次配置。"
                : "配置完成后：所有 AI 功能将使用智谱 AI 模型。API Key 将安全保存在后端服务器。"
              }
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleClose}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'text-slate-700 dark:text-slate-300',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'transition-colors',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading || backendConfigured || !zhipuKey.trim()}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
              backendConfigured 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white',
              !backendConfigured && 'hover:from-blue-600 hover:to-indigo-700',
              'shadow-lg shadow-blue-500/30',
              'transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              saveSuccess && 'bg-gradient-to-r from-green-500 to-emerald-600'
            )}
          >
            {backendConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                已配置
              </>
            ) : loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </>
            ) : saveSuccess ? (
              <>
                <Save className="w-4 h-4" />
                已保存
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

