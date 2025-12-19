/**
 * 排版格式化对话框组件
 * 双层处理：先规则格式化，再AI增强
 * 支持三种格式转换：紧凑格式 ↔ 段落格式 ↔ 列表格式
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Layout, Zap, Wand2, CheckCircle } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { rewriteResumeStream } from '../../../../services/api'
import { useTypewriter } from '../../../../hooks/useTypewriter'
// @ts-ignore
import type { ResumeData } from '../../types'
import { formatLayoutByRules, detectContentFormat, type ContentFormat } from './formatLayoutUtils'

interface FormatLayoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string // HTML 内容
  onApply: (content: string) => void
  resumeData?: ResumeData // 用于 AI 增强
  path?: string // JSON 路径，例如 "skillContent" 或 "projects.0.description"
}

export default function FormatLayoutDialog({
  open,
  onOpenChange,
  content,
  onApply,
  resumeData,
  path = 'skillContent',
}: FormatLayoutDialogProps) {
  const [isFormatting, setIsFormatting] = useState(false)
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [formattedContent, setFormattedContent] = useState('')
  const [currentFormat, setCurrentFormat] = useState<ContentFormat>('unknown')
  const [targetFormat, setTargetFormat] = useState<'paragraph' | 'list'>('paragraph')
  const [useOrderedList, setUseOrderedList] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const formattedContentRef = useRef<HTMLDivElement>(null)

  // 使用打字机效果（仅在 AI 模式下）- 优化速度
  const { text: aiFormattedContent, isTyping, appendContent, skipToEnd, reset } = useTypewriter({
    initialDelay: 100,  // 减少初始延迟
    baseDelay: 10,      // 加快打字速度
    punctuationDelay: 50, // 减少标点延迟
    enableSmartTokenization: true,
    speedVariation: 0.1,
    maxBufferSize: 500   // 增大缓冲区
  })

  // 第一层：规则格式化
  const formatByRules = (html: string, target: 'paragraph' | 'list' | 'auto' = 'auto'): string => {
    try {
      return formatLayoutByRules(html, target, useOrderedList)
    } catch (error) {
      console.error('规则格式化失败:', error)
      return html
    }
  }

  // 第二层：AI增强 - 优化版本
  const enhanceByAI = useCallback(async (rulesFormattedContent: string) => {
    if (!resumeData) {
      console.log('无简历数据，跳过AI增强')
      return
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    setIsAIProcessing(true)
    reset()

    // 根据当前格式和目标格式生成AI指令 - 更简洁的指令
    let instruction = ''
    if (currentFormat === 'list' && targetFormat === 'paragraph') {
      instruction = '将列表转换为段落，保持"类别: 描述"格式，保留HTML标签'
    } else if (currentFormat === 'paragraph' && targetFormat === 'list') {
      instruction = `将段落转换为${useOrderedList ? '有序' : '无序'}列表，保持"类别: 描述"格式，保留HTML标签`
    } else if (currentFormat === 'compact' && targetFormat === 'paragraph') {
      instruction = '将紧凑格式转换为段落，每个"类别: 描述"独立成段，保留HTML标签'
    } else {
      instruction = '优化格式，使其更清晰易读，保持"类别: 描述"格式，保留HTML标签'
    }

    // 减少超时时间到 5 秒
    const timeoutId = setTimeout(() => {
      if (isAIProcessing && !signal.aborted) {
        console.warn('AI处理超时，使用规则格式化结果')
        setIsAIProcessing(false)
        setIsCompleted(true)
        setTimeout(() => setIsCompleted(false), 2000)
      }
    }, 5000) // 5秒超时

    try {
      await rewriteResumeStream(
        'doubao',
        resumeData as any,
        path,
        instruction,
        (chunk: string) => {
          appendContent(chunk)
          requestAnimationFrame(() => {
            if (formattedContentRef.current) {
              const container = formattedContentRef.current
              container.scrollTop = container.scrollHeight
            }
          })
        },
        () => {
          if (!signal.aborted) {
            clearTimeout(timeoutId)
            setIsAIProcessing(false)
            setIsCompleted(true)
            setTimeout(() => setIsCompleted(false), 2000)
          }
        },
        (error: string) => {
          if (!signal.aborted) {
            clearTimeout(timeoutId)
            console.error('AI增强失败:', error)
            setIsAIProcessing(false)
          }
        },
        signal  // 传递 AbortSignal
      )
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        clearTimeout(timeoutId)
        console.error('AI增强异常:', error)
        setIsAIProcessing(false)
      }
    }
  }, [currentFormat, targetFormat, useOrderedList, resumeData, path, reset, appendContent])

  // 执行格式化（双层处理）- 优化版本
  const handleFormat = useCallback(async () => {
    // 只有在真正的格式化操作时才防止重复，列表切换时允许执行
    if (isFormatting) {
      console.log('规则格式化中，跳过重复执行')
      return
    }

    try {
      setIsFormatting(true)
      setIsCompleted(false)

      // 如果正在AI处理中，重置AI状态
      if (isAIProcessing) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }
        reset()
        setIsAIProcessing(false)
      }

      // 验证输入内容
      if (!content || !content.trim()) {
        console.warn('内容为空，跳过格式化')
        setIsFormatting(false)
        return
      }

      // 第一层：规则格式化（同步执行，无需等待）
      console.log('开始规则格式化...')
      const rulesResult = formatByRules(content, targetFormat)
      console.log('规则格式化完成')
      console.log('目标格式:', targetFormat, '是否有序:', useOrderedList)
      console.log('生成的HTML:', rulesResult.substring(0, 200) + '...')
      setFormattedContent(rulesResult)

      // 立即显示规则格式化结果
      setIsFormatting(false)
      setIsCompleted(true)
      setTimeout(() => setIsCompleted(false), 2000)

      // 第二层：AI增强（异步执行，不阻塞界面）
      if (resumeData) {
        console.log('开始AI增强...')
        // 不等待 AI 完成，让用户可以立即看到规则格式化结果
        enhanceByAI(rulesResult).catch(error => {
          console.error('AI增强失败:', error)
        })
      }
    } catch (error) {
      console.error('格式化错误:', error)
      setIsFormatting(false)
      setIsCompleted(true)
      setTimeout(() => setIsCompleted(false), 2000)
    }
  }, [content, targetFormat, useOrderedList, resumeData, path, reset, isFormatting, isAIProcessing, enhanceByAI])

  // 初始化时执行格式化
  useEffect(() => {
    if (open && !formattedContent) {
      // 检测当前格式
      const format = detectContentFormat(content)
      setCurrentFormat(format)
      console.log(`检测到内容格式: ${format}`)

      // 根据当前格式确定目标格式
      // 保存检测到的格式但不自动设置目标格式，让用户选择
      console.log(`检测到内容格式: ${format}`)

      // 延迟执行格式化，确保状态已更新
      const timer = setTimeout(() => {
        handleFormat()
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [open, content]) // 移除 handleFormat 依赖

  // 当列表类型或目标格式切换时，重新格式化（仅在已格式化后）
  useEffect(() => {
    if (!open || !formattedContent) return
    console.log('格式切换，重新格式化')
    handleFormat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useOrderedList, targetFormat])

  // 组件关闭时清理资源
  useEffect(() => {
    if (!open) {
      // 清理资源
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      reset()
      setFormattedContent('')
      setIsAIProcessing(false)
      setIsCompleted(false)
    }
  }, [open, reset])

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    onOpenChange(false)
    reset()
    setFormattedContent('')
    setIsAIProcessing(false)
    setIsCompleted(false)
  }

  const handleApply = () => {
    try {
      // 优先使用 AI 增强的内容，如果没有则使用规则格式化的内容
      const finalContent = aiFormattedContent || formattedContent
      if (!finalContent || !finalContent.trim()) {
        console.warn('没有可应用的内容')
        return
      }
      console.log('应用格式化内容:', finalContent.substring(0, 100) + '...')
      onApply(finalContent)
      handleClose()
    } catch (error) {
      console.error('应用格式化内容失败:', error)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isFormatting) {
      onOpenChange(newOpen)
      reset()
      setFormattedContent('')
      setIsAIProcessing(false)
      setIsCompleted(false)
    }
  }

  if (!open) return null

  // 显示逻辑：优先显示 AI 增强的内容，否则显示规则格式化的内容
  const displayContent = aiFormattedContent || formattedContent
  const showAIStatus = isAIProcessing || isCompleted
  const showLoading = isFormatting && !displayContent && !isTyping

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
          'rounded-2xl shadow-2xl',
          'overflow-hidden'
        )}
      >
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                  AI 智能排版
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {isFormatting && !isAIProcessing
                      ? '正在格式化...'
                      : isAIProcessing
                      ? 'AI 正在智能优化...'
                      : isTyping
                      ? '正在生成...'
                      : '格式化完成'
                    }
                  </p>
                  {showAIStatus && (
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      isAIProcessing
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    )}>
                      {isAIProcessing ? (
                        <>
                          <Wand2 className="h-3 w-3" />
                          AI增强中
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          {isCompleted ? 'AI增强完成' : '规则格式化完成'}
                        </>
                      )}
                    </div>
                  )}
                </div>
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

        {/* 处理进度指示器 */}
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                isFormatting && !isAIProcessing ? 'bg-blue-500' : 'bg-blue-500'
              )}>
                1
              </div>
              <span className={cn(
                'text-sm font-medium',
                isFormatting && !isAIProcessing ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'
              )}>
                规则格式化
              </span>
              {!isFormatting && <CheckCircle className="h-4 w-4 text-green-500" />}
            </div>
            <div className={cn(
              'h-px flex-1',
              isFormatting && !isAIProcessing ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-blue-200 dark:bg-blue-800'
            )} />
            <div className={cn(
              'flex items-center gap-2',
              !resumeData && 'opacity-50'
            )}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                isAIProcessing ? 'bg-purple-500 animate-pulse' : resumeData ? 'bg-purple-500' : 'bg-neutral-400'
              )}>
                2
              </div>
              <span className={cn(
                'text-sm font-medium',
                isAIProcessing ? 'text-purple-600 dark:text-purple-400' : resumeData ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-500 dark:text-neutral-500'
              )}>
                AI 智能增强
              </span>
              {!resumeData && <span className="text-xs text-neutral-500">(无简历数据)</span>}
              {isCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
            </div>
          </div>
        </div>

        {/* 格式化选项 */}
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            {/* 目标格式选择 */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                转换为：
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetFormat"
                  checked={targetFormat === 'paragraph'}
                  onChange={() => setTargetFormat('paragraph')}
                  disabled={isFormatting}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">段落格式</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetFormat"
                  checked={targetFormat === 'list'}
                  onChange={() => setTargetFormat('list')}
                  disabled={isFormatting}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">列表格式</span>
              </label>
            </div>

            {/* 列表类型选择（当目标格式为列表时显示） */}
            {targetFormat === 'list' && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  类型：
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="listType"
                    checked={!useOrderedList}
                    onChange={() => setUseOrderedList(false)}
                    disabled={isFormatting}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">无序</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="listType"
                    checked={useOrderedList}
                    onChange={() => setUseOrderedList(true)}
                    disabled={isFormatting}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">有序</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* 内容区域 - 左右对比 */}
        <div className="grid grid-cols-2 gap-6 p-6">
          {/* 左侧：原文 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-600" />
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                原文 ({currentFormat === 'list' ? '列表' : currentFormat === 'paragraph' ? '段落' : currentFormat === 'compact' ? '紧凑' : '未知'})
              </span>
            </div>
            <div
              className={cn(
                'relative rounded-xl border',
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

          {/* 右侧：格式化后 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  格式化后 ({targetFormat === 'list' ? (useOrderedList ? '有序列表' : '无序列表') : '段落'})
                </span>
              </div>
              {isTyping && (
                <button
                  onClick={skipToEnd}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs',
                    'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50',
                    'text-blue-600 dark:text-blue-400 rounded-md transition-colors'
                  )}
                >
                  <Zap className="h-3 w-3" />
                  立即显示
                </button>
              )}
            </div>
            <div
              ref={formattedContentRef}
              className={cn(
                'relative rounded-xl border',
                'bg-blue-50/50 dark:bg-blue-900/20',
                'border-blue-200 dark:border-blue-800',
                'p-6 h-[400px] overflow-auto shadow-sm scroll-smooth'
              )}
            >
              {showLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      正在格式化...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* AI 处理时的覆盖层 */}
                  {isAIProcessing && formattedContent && !aiFormattedContent && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          AI 正在智能优化...
                        </p>
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      'prose prose-sm dark:prose-invert max-w-none',
                      'text-neutral-800 dark:text-neutral-200',
                      'transition-all duration-300',
                      '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
                      '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
                      '[&_li]:my-1'
                    )}
                    dangerouslySetInnerHTML={{ __html: displayContent || content }}
                />
                </>
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
          <button
            onClick={handleFormat}
            disabled={isFormatting}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl',
              'bg-gradient-to-r from-blue-500 to-indigo-500',
              'hover:from-indigo-500 hover:to-blue-500',
              'text-white font-medium',
              'shadow-lg shadow-blue-500/20',
              'transition-all duration-300',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {isFormatting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isAIProcessing ? 'AI增强中...' : '格式化中...'}
              </>
            ) : (
              <>
                <Layout className="h-4 w-4" />
                重新格式化
              </>
            )}
          </button>

          <button
            onClick={handleApply}
            disabled={!displayContent || isFormatting}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl',
              'bg-green-500 hover:bg-green-600',
              'text-white font-medium',
              'shadow-lg shadow-green-500/20',
              'transition-all duration-300',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            应用格式化
          </button>
        </div>
      </div>
    </div>
  )
}