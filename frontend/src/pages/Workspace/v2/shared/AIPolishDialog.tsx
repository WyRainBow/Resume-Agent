/**
 * AI 润色对话框组件
 * 参考 magic-resume 实现，优化为使用豆包模型
 */
import { useEffect, useState, useRef } from 'react'
import { Loader2, Sparkles, Wand2, Zap } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { rewriteResumeStream } from '../../../../services/api'
import { useTypewriter } from '../../../../hooks/useTypewriter'
import type { ResumeData } from '../../types'

interface AIPolishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  onApply: (content: string) => void
  resumeData: ResumeData
  path: string // JSON 路径，例如 "projects.0.description"
}

export default function AIPolishDialog({
  open,
  onOpenChange,
  content,
  onApply,
  resumeData,
  path,
}: AIPolishDialogProps) {
  const [isPolishing, setIsPolishing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const polishedContentRef = useRef<HTMLDivElement>(null)

  // 使用优化的打字机效果
  const { text: polishedContent, isTyping, appendContent, skipToEnd, reset } = useTypewriter({
    initialDelay: 300,
    baseDelay: 25,
    punctuationDelay: 150,
    enableSmartTokenization: true,
    speedVariation: 0.2,
    maxBufferSize: 200
  })

  const handlePolish = async () => {
    try {
      setIsPolishing(true)
      reset() // 重置打字机状态

      // 使用豆包模型进行润色
      // 如果用户没有提供具体指令，使用默认的润色指令
      const instruction = '请优化这段文本，使其更加专业、简洁、有吸引力。使用更专业的词汇，突出关键成就，保持简洁清晰，使用主动语气，保留原有HTML格式标签（如 <strong>、<ul>、<li> 等）。'

      await rewriteResumeStream(
        'zhipu', // 默认使用智谱模型
        resumeData as any,
        path,
        instruction,
        (chunk: string) => {
          // 使用打字机效果追加内容
          appendContent(chunk)

          // 自动滚动到底部
          requestAnimationFrame(() => {
            if (polishedContentRef.current) {
              const container = polishedContentRef.current
              container.scrollTop = container.scrollHeight
            }
          })
        },
        () => {
          setIsPolishing(false)
        },
        (error: string) => {
          console.error('AI 润色失败:', error)
          setIsPolishing(false)
        }
      )
    } catch (error) {
      console.error('AI 润色错误:', error)
      setIsPolishing(false)
    }
  }

  useEffect(() => {
    if (open) {
      handlePolish()
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      reset()
    }
  }, [open])

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    onOpenChange(false)
    reset()
  }

  const handleApply = () => {
    onApply(polishedContent)
    handleClose()
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isPolishing) {
      onOpenChange(newOpen)
      reset()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleOpenChange(false)
        }
      }}
    >
      <div
        className={cn(
          'relative w-full max-w-5xl mx-4',
          'bg-white dark:bg-neutral-900',
          'border border-neutral-200 dark:border-neutral-800',
          'rounded-lg shadow-2xl',
          'overflow-hidden'
        )}
      >
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <Sparkles className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                  AI 润色
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {isPolishing ? '正在优化中...' : isTyping ? '正在打字显示...' : '优化完成，请查看右侧结果'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <span className="text-neutral-500 dark:text-neutral-400">✕</span>
            </button>
          </div>
        </div>

        {/* 内容区域 - 左右对比 */}
        <div className="grid grid-cols-2 gap-6 p-6">
          {/* 左侧：原文 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-600" />
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                原文
              </span>
            </div>
            <div
              className={cn(
                'relative rounded-lg border',
                'bg-neutral-50 dark:bg-neutral-800/50',
                'border-neutral-200 dark:border-neutral-800',
                'p-6 h-[400px] overflow-auto shadow-sm'
              )}
            >
              <div
                className={cn(
                  'prose dark:prose-invert max-w-none',
                  'text-neutral-700 dark:text-neutral-300'
                )}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </div>

          {/* 右侧：润色后 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  润色后
                </span>
              </div>
              {isTyping && (
                <button
                  onClick={skipToEnd}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs',
                    'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50',
                    'text-purple-600 dark:text-purple-400 rounded-md transition-colors'
                  )}
                >
                  <Zap className="h-3 w-3" />
                  立即显示
                </button>
              )}
            </div>
            <div
              ref={polishedContentRef}
              className={cn(
                'relative rounded-lg border',
                'bg-purple-50/50 dark:bg-purple-900/20',
                'border-purple-200 dark:border-purple-800',
                'p-6 h-[400px] overflow-auto shadow-sm scroll-smooth'
              )}
            >
              {isPolishing && !polishedContent && !isTyping ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      AI 正在优化中...
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'prose dark:prose-invert max-w-none',
                    'text-neutral-800 dark:text-neutral-200',
                    'transition-all duration-300'
                  )}
                  dangerouslySetInnerHTML={{ __html: polishedContent || content }}
                />
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
          <button
            onClick={handlePolish}
            disabled={isPolishing}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg',
              'bg-gradient-to-r from-purple-500 to-pink-500',
              'hover:from-pink-500 hover:to-purple-500',
              'text-white font-medium',
              'shadow-lg shadow-purple-500/20',
              'transition-all duration-300',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {isPolishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                重新生成
              </>
            )}
          </button>

          <button
            onClick={handleApply}
            disabled={!polishedContent || isPolishing}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg',
              'bg-blue-500 hover:bg-blue-600',
              'text-white font-medium',
              'shadow-lg shadow-blue-500/20',
              'transition-all duration-300',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            应用润色
          </button>
        </div>
      </div>
    </div>
  )
}

