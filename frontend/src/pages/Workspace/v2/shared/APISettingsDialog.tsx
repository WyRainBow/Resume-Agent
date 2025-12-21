/**
 * API 设置对话框组件
 * 用于全局配置 AI 模型和 API Key
 */
import { useState, useEffect } from 'react'
import { X, Save, Key, Settings } from 'lucide-react'
import { cn } from '../../../../lib/utils'

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
  const [zhipuModel, setZhipuModel] = useState('glm-4.5v')
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 加载当前配置
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config/keys')
      if (response.ok) {
        const data = await response.json()
        if (data.zhipu) {
          setZhipuKey(data.zhipu.preview || '')
        }
        // 从 localStorage 加载模型配置
        const savedModel = localStorage.getItem('ai_model')
        if (savedModel) {
          setZhipuModel(savedModel)
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch('/api/config/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zhipu_key: zhipuKey,
        }),
      })

      if (!response.ok) {
        throw new Error('保存失败')
      }

      // 保存模型配置到 localStorage
      localStorage.setItem('ai_provider', 'zhipu')
      localStorage.setItem('ai_model', zhipuModel)

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onOpenChange(false)
      }, 1500)
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
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
                智谱 AI (GLM-4.5V)
              </h3>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
              </label>
              <input
                type="password"
                value={zhipuKey}
                onChange={(e) => setZhipuKey(e.target.value)}
                placeholder="请输入智谱 AI API Key"
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
            </div>

            {/* 模型选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                模型
              </label>
              <select
                value={zhipuModel}
                onChange={(e) => setZhipuModel(e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg',
                  'bg-slate-50 dark:bg-slate-800',
                  'border border-slate-200 dark:border-slate-700',
                  'text-slate-900 dark:text-slate-100',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'transition-all'
                )}
              >
                <option value="glm-4.5v">GLM-4.5V (推荐)</option>
                <option value="glm-4-flash">GLM-4-Flash (快速)</option>
                <option value="glm-4-air">GLM-4-Air (平衡)</option>
                <option value="glm-4">GLM-4 (标准)</option>
              </select>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              配置完成后：所有 AI 功能将使用智谱 AI 模型。API Key 将安全保存在本地。
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
            disabled={loading || !zhipuKey.trim()}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
              'bg-gradient-to-r from-blue-500 to-indigo-600 text-white',
              'hover:from-blue-600 hover:to-indigo-700',
              'shadow-lg shadow-blue-500/30',
              'transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              saveSuccess && 'bg-gradient-to-r from-green-500 to-emerald-600'
            )}
          >
            {loading ? (
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

