/**
 * AI 润色对话式组件
 * 替代原 AIPolishDialog，支持多轮对话、快捷标签、对比浮层
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Sparkles, Send, X, Eye, Check, Zap } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { DEFAULT_AI_PROVIDER } from '@/lib/aiProvider'
import { rewriteResumeStream } from '../../../../services/api'
import { useTypewriter } from '../../../../hooks/useTypewriter'
import type { ResumeData } from '../../types'

interface PolishChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  onApply: (content: string) => void
  resumeData: ResumeData
  path: string
}

interface ChatMessage {
  id: string
  type: 'original' | 'user' | 'ai'
  content: string
  isStreaming?: boolean
}

// 快捷标签配置
const QUICK_TAGS_BY_PATH: Record<string, string[]> = {
  project: ['再精简一些', '加数据量化', '用动词开头', '突出技术难点', '翻译成英文'],
  experience: ['再精简一些', '加数据量化', '用动词开头', '突出业务影响', '翻译成英文'],
  skill: ['分类整理', '补充流行技术', '更专业', '翻译成英文'],
  default: ['再精简一些', '更专业', '更具体', '翻译成英文'],
}

function getQuickTags(path: string): string[] {
  const p = path.toLowerCase()
  if (p.includes('project')) return QUICK_TAGS_BY_PATH.project
  if (p.includes('experience') || p.includes('internship')) return QUICK_TAGS_BY_PATH.experience
  if (p.includes('skill')) return QUICK_TAGS_BY_PATH.skill
  return QUICK_TAGS_BY_PATH.default
}

// Diff 对比浮层
function DiffOverlay({ original, polished, onClose }: { original: string; polished: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">内容对比</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-neutral-200 dark:divide-neutral-800">
          <div className="p-5 overflow-auto max-h-[65vh]">
            <p className="text-xs font-medium text-neutral-400 mb-2">原始内容</p>
            <div className="prose dark:prose-invert prose-sm max-w-none text-neutral-600 dark:text-neutral-400" dangerouslySetInnerHTML={{ __html: original }} />
          </div>
          <div className="p-5 overflow-auto max-h-[65vh] bg-emerald-50/30 dark:bg-emerald-900/10">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">润色后</p>
            <div className="prose dark:prose-invert prose-sm max-w-none text-neutral-800 dark:text-neutral-200" dangerouslySetInnerHTML={{ __html: polished }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PolishChatDialog({
  open,
  onOpenChange,
  content,
  onApply,
  resumeData,
  path,
}: PolishChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showDiff, setShowDiff] = useState<{ original: string; polished: string } | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendPolishRequestRef = useRef<(instruction: string) => void>(() => {})

  // 打字机 hook — 只用于最新一条 AI 消息
  const { text: typingText, isTyping, appendContent, skipToEnd, reset } = useTypewriter({
    initialDelay: 200,
    baseDelay: 20,
    punctuationDelay: 120,
    maxBufferSize: 300,
  })

  const quickTags = getQuickTags(path)

  // 自动滚动到底部
  useEffect(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [messages, typingText])

  // 发送润色请求
  const sendPolishRequest = useCallback(async (instruction: string) => {
    if (isStreaming) return

    // 构建历史（用于多轮上下文）
    const historyMessages: { role: string; content: string }[] = []
    for (const msg of messages) {
      if (msg.type === 'user') {
        historyMessages.push({ role: 'user', content: msg.content })
      } else if (msg.type === 'ai' && !msg.isStreaming) {
        historyMessages.push({ role: 'assistant', content: msg.content })
      }
    }

    // 只在用户有实际输入时添加用户消息气泡
    if (instruction) {
      const userMsg: ChatMessage = { id: `user-${Date.now()}`, type: 'user', content: instruction }
      setMessages(prev => [...prev, userMsg])
    }

    // 添加 AI 占位消息
    const aiMsgId = `ai-${Date.now()}`
    setMessages(prev => [...prev, { id: aiMsgId, type: 'ai', content: '', isStreaming: true }])
    setIsStreaming(true)
    reset()

    // 初始化新的 AbortController
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    let fullContent = ''

    try {
      await rewriteResumeStream(
        DEFAULT_AI_PROVIDER,
        resumeData as any,
        path,
        instruction,
        (chunk: string) => {
          fullContent += chunk
          appendContent(chunk)
        },
        () => {
          // 完成
          setIsStreaming(false)
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, content: fullContent, isStreaming: false } : m)
          )
          inputRef.current?.focus()
        },
        (error: string) => {
          console.error('润色失败:', error)
          setIsStreaming(false)
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, content: `润色失败: ${error}`, isStreaming: false } : m)
          )
        },
        abortRef.current.signal,
        historyMessages
      )
    } catch (err) {
      console.error('润色请求错误:', err)
      setIsStreaming(false)
    }
  }, [isStreaming, messages, resumeData, path, appendContent, reset])

  // 始终保持 ref 指向最新的 sendPolishRequest
  useEffect(() => {
    sendPolishRequestRef.current = sendPolishRequest
  }, [sendPolishRequest])

  // 打开时自动发送第一轮润色
  useEffect(() => {
    if (open) {
      setMessages([{ id: 'original', type: 'original', content }])
      // 延迟发送，确保状态已更新；通过 ref 访问最新版本避免 stale closure
      setTimeout(() => sendPolishRequestRef.current(''), 100)
    } else {
      abortRef.current?.abort()
      setMessages([])
      reset()
      setInputValue('')
      setShowDiff(null)
      setIsStreaming(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || isStreaming) return
    setInputValue('')
    sendPolishRequest(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApply = (aiContent: string) => {
    onApply(aiContent)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !isStreaming && onOpenChange(false)}
    >
      <div className="relative w-full max-w-3xl mx-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">AI 润色助手</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isStreaming ? '正在生成...' : '输入指令或使用快捷标签优化内容'}
              </p>
            </div>
          </div>
          <button
            onClick={() => !isStreaming && onOpenChange(false)}
            disabled={isStreaming}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* Chat messages area */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4 min-h-0">
          {messages.map(msg => {
            if (msg.type === 'original') {
              return (
                <div key={msg.id} className="space-y-1.5">
                  <span className="text-xs font-medium text-neutral-400">📄 原始内容</span>
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 p-4">
                    <div className="prose dark:prose-invert prose-sm max-w-none text-neutral-600 dark:text-neutral-400" dangerouslySetInnerHTML={{ __html: msg.content }} />
                  </div>
                </div>
              )
            }

            if (msg.type === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[75%] px-4 py-2.5 bg-blue-500 text-white rounded-2xl rounded-tr-md text-sm">
                    {msg.content || '润色'}
                  </div>
                </div>
              )
            }

            // AI message
            const displayContent = msg.isStreaming ? typingText : msg.content
            const isLatestAi = msg.isStreaming

            return (
              <div key={msg.id} className="space-y-1.5">
                <span className="text-xs font-medium text-purple-500">✨ 润色结果</span>
                <div className="rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200/60 dark:border-purple-800/40 p-4">
                  {msg.isStreaming && !displayContent ? (
                    <div className="flex items-center gap-2 text-purple-500 text-sm py-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI 正在思考...
                    </div>
                  ) : (
                    <>
                      <div className="prose dark:prose-invert prose-sm max-w-none text-neutral-800 dark:text-neutral-200">
                        <div dangerouslySetInnerHTML={{ __html: displayContent }} />
                        {isLatestAi && isTyping && (
                          <span className="inline-block w-0.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-middle" />
                        )}
                      </div>
                      {isLatestAi && isTyping && (
                        <button
                          onClick={skipToEnd}
                          className="mt-2 flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 transition-colors"
                        >
                          <Zap className="w-3 h-3" /> 立即显示
                        </button>
                      )}
                    </>
                  )}

                  {/* Action buttons - show when streaming is done */}
                  {!msg.isStreaming && msg.content && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-200/40 dark:border-purple-800/30">
                      <button
                        onClick={() => setShowDiff({ original: content, polished: msg.content })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> 查看对比
                      </button>
                      <button
                        onClick={() => handleApply(msg.content)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> 应用此版本
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Quick tags + Input */}
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 space-y-2">
          {/* Quick tags */}
          {!isStreaming && (
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => sendPolishRequest(tag)}
                  className="px-2.5 py-1 text-xs rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 dark:hover:border-purple-800 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? '等待回复中...' : '输入修改指令，如"再精简一些"...'}
              disabled={isStreaming}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !inputValue.trim()}
              className="p-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Diff overlay */}
      {showDiff && (
        <DiffOverlay
          original={showDiff.original}
          polished={showDiff.polished}
          onClose={() => setShowDiff(null)}
        />
      )}
    </div>
  )
}
