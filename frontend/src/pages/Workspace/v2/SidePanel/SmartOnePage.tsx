/**
 * 智能一页组件
 * 自动调整排版设置，使简历内容适应一页
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wand2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { GlobalSettings } from '../types'

// 排版配置预设（从最宽松到最紧凑）
const LAYOUT_PRESETS = [
  // Level 0: 宽松
  { latexFontSize: 12, latexMargin: 'relaxed' as const, latexLineSpacing: 1.5, label: '宽松' },
  // Level 1: 标准
  { latexFontSize: 11, latexMargin: 'standard' as const, latexLineSpacing: 1.3, label: '标准' },
  // Level 2: 较紧
  { latexFontSize: 11, latexMargin: 'standard' as const, latexLineSpacing: 1.15, label: '较紧' },
  // Level 3: 紧凑（字体不变）
  { latexFontSize: 11, latexMargin: 'compact' as const, latexLineSpacing: 1.15, label: '紧凑' },
  // Level 4: 更紧凑（减小字体）
  { latexFontSize: 10, latexMargin: 'compact' as const, latexLineSpacing: 1.15, label: '更紧凑' },
  // Level 5: 非常紧凑
  { latexFontSize: 10, latexMargin: 'compact' as const, latexLineSpacing: 1.0, label: '非常紧凑' },
  // Level 6: 极度紧凑
  { latexFontSize: 9, latexMargin: 'compact' as const, latexLineSpacing: 1.0, label: '极度紧凑' },
]

// 根据当前设置找到对应的 level
function findCurrentLevel(settings: GlobalSettings): number {
  const fontSize = settings.latexFontSize || 11
  const margin = settings.latexMargin || 'standard'
  const lineSpacing = settings.latexLineSpacing || 1.15

  // 找到最接近的 preset
  for (let i = 0; i < LAYOUT_PRESETS.length; i++) {
    const preset = LAYOUT_PRESETS[i]
    if (
      preset.latexFontSize === fontSize &&
      preset.latexMargin === margin &&
      Math.abs(preset.latexLineSpacing - lineSpacing) < 0.1
    ) {
      return i
    }
  }

  // 如果没找到精确匹配，根据紧凑程度估算
  if (fontSize <= 9 && margin === 'compact' && lineSpacing <= 1.0) {
    return LAYOUT_PRESETS.length - 1
  }
  if (fontSize >= 12 || margin === 'relaxed' || lineSpacing >= 1.5) {
    return 0
  }
  return 2 // 默认返回"较紧"级别
}

interface SmartOnePageProps {
  globalSettings: GlobalSettings
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void
  pdfBlob: Blob | null
  loading: boolean
  onRenderComplete?: (numPages: number) => void
}

type OptimizeStatus = 'idle' | 'analyzing' | 'optimizing' | 'success' | 'failed'

export function SmartOnePage({
  globalSettings,
  updateGlobalSettings,
  pdfBlob,
  loading,
  onRenderComplete,
}: SmartOnePageProps) {
  const [status, setStatus] = useState<OptimizeStatus>('idle')
  const [message, setMessage] = useState('')
  const [currentLevel, setCurrentLevel] = useState(() => findCurrentLevel(globalSettings))

  // 应用指定级别的预设
  const applyPreset = useCallback((level: number) => {
    if (level < 0 || level >= LAYOUT_PRESETS.length) return
    
    const preset = LAYOUT_PRESETS[level]
    updateGlobalSettings({
      latexFontSize: preset.latexFontSize,
      latexMargin: preset.latexMargin,
      latexLineSpacing: preset.latexLineSpacing,
    })
    setCurrentLevel(level)
  }, [updateGlobalSettings])

  // 智能优化：逐步调整到更紧凑的设置
  const handleSmartOptimize = useCallback(async () => {
    setStatus('analyzing')
    setMessage('正在分析简历内容...')

    // 检查当前是否有 PDF
    if (!pdfBlob) {
      setStatus('failed')
      setMessage('请先渲染 PDF')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }

    // 获取当前页数
    try {
      const { getDocument } = await import('pdfjs-dist')
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const pdf = await getDocument({ data: arrayBuffer }).promise
      const numPages = pdf.numPages

      if (numPages === 1) {
        setStatus('success')
        setMessage('已经是一页了！')
        setTimeout(() => setStatus('idle'), 2000)
        return
      }

      // 需要优化
      setStatus('optimizing')
      setMessage(`当前 ${numPages} 页，正在优化...`)

      // 找到下一个更紧凑的级别
      const nextLevel = currentLevel + 1
      if (nextLevel >= LAYOUT_PRESETS.length) {
        setStatus('failed')
        setMessage('已经是最紧凑的设置了，内容仍超过一页')
        setTimeout(() => setStatus('idle'), 3000)
        return
      }

      // 应用更紧凑的设置
      applyPreset(nextLevel)
      setMessage(`已切换到「${LAYOUT_PRESETS[nextLevel].label}」模式，等待重新渲染...`)

      // 等待一会儿让渲染完成
      setTimeout(() => {
        setStatus('success')
        setMessage('设置已优化，请查看效果')
        setTimeout(() => setStatus('idle'), 2000)
      }, 1500)

    } catch (error) {
      console.error('Smart optimize error:', error)
      setStatus('failed')
      setMessage('分析失败，请重试')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }, [pdfBlob, currentLevel, applyPreset])

  // 一键应用最紧凑设置
  const handleApplyCompact = useCallback(() => {
    applyPreset(LAYOUT_PRESETS.length - 1)
    setStatus('success')
    setMessage('已应用最紧凑设置')
    setTimeout(() => setStatus('idle'), 2000)
  }, [applyPreset])

  // 重置为标准设置
  const handleReset = useCallback(() => {
    applyPreset(1) // Level 1: 标准
    setStatus('success')
    setMessage('已重置为标准设置')
    setTimeout(() => setStatus('idle'), 2000)
  }, [applyPreset])

  const isProcessing = status === 'analyzing' || status === 'optimizing'

  return (
    <div className="space-y-3">
      {/* 智能优化按钮 */}
      <motion.button
        whileHover={{ scale: isProcessing ? 1 : 1.02 }}
        whileTap={{ scale: isProcessing ? 1 : 0.98 }}
        onClick={handleSmartOptimize}
        disabled={isProcessing || loading}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg',
          'text-sm font-medium transition-all duration-200',
          isProcessing || loading
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md hover:shadow-lg hover:from-violet-600 hover:to-purple-600'
        )}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wand2 className="w-4 h-4" />
        )}
        {isProcessing ? '优化中...' : '智能一页'}
      </motion.button>

      {/* 快捷操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleApplyCompact}
          disabled={isProcessing || loading}
          className={cn(
            'flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors',
            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
            'hover:bg-slate-200 dark:hover:bg-slate-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          最紧凑
        </button>
        <button
          onClick={handleReset}
          disabled={isProcessing || loading}
          className={cn(
            'flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors',
            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
            'hover:bg-slate-200 dark:hover:bg-slate-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          重置
        </button>
      </div>

      {/* 当前级别指示 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-400 dark:text-slate-500">紧凑度</span>
        <div className="flex gap-1">
          {LAYOUT_PRESETS.map((_, index) => (
            <button
              key={index}
              onClick={() => applyPreset(index)}
              disabled={isProcessing || loading}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-200',
                index === currentLevel
                  ? 'bg-violet-500 scale-125'
                  : 'bg-slate-300 dark:bg-slate-600 hover:bg-violet-300 dark:hover:bg-violet-700',
                'disabled:cursor-not-allowed'
              )}
              title={LAYOUT_PRESETS[index].label}
            />
          ))}
        </div>
      </div>

      {/* 状态消息 */}
      <AnimatePresence>
        {status !== 'idle' && message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
              status === 'success' && 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
              status === 'failed' && 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
              (status === 'analyzing' || status === 'optimizing') && 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
            )}
          >
            {status === 'success' && <CheckCircle className="w-3.5 h-3.5" />}
            {status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
            {(status === 'analyzing' || status === 'optimizing') && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 提示 */}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        点击「智能一页」自动调整排版，或手动点击圆点选择紧凑度
      </p>
    </div>
  )
}

export default SmartOnePage
