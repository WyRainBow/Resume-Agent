/**
 * Conversation - 简历修改对话页面
 *
 * 功能：使用自然语言修改已有简历
 * 特点：
 * - 增强的 Markdown 渲染（emoji 列表、颜色编码）
 * - 工具执行步骤进度显示
 * - 右侧实时预览
 * - 打字机效果
 */

import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  User,
  XCircle
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { initialResumeData } from '../../data/initialResumeData'
import { cvToolsChatStream } from '../../services/api'
import { executeToolCall, type ToolCall, type ToolResult } from '../../tools/cvTools'
import { HTMLTemplateRenderer } from '../Workspace/v2/HTMLTemplateRenderer'
import type { ResumeData } from '../Workspace/v2/types'

// ========== 打字机效果 Hook ==========

interface TypewriterOptions {
  speed?: number
  enabled?: boolean
}

function useTypewriter(text: string, options: TypewriterOptions = {}) {
  const { speed = 3, enabled = true } = options
  const [displayedText, setDisplayedText] = useState('')
  const currentIndexRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text)
      return
    }

    currentIndexRef.current = 0
    setDisplayedText('')

    const animate = (timestamp: number) => {
      const timeSinceLastUpdate = timestamp - lastUpdateRef.current

      if (timeSinceLastUpdate >= 50) {
        const chunkSize = speed
        const endIndex = Math.min(currentIndexRef.current + chunkSize, text.length)
        const newDisplayedText = text.slice(0, endIndex)

        setDisplayedText(newDisplayedText)
        currentIndexRef.current = endIndex
        lastUpdateRef.current = timestamp

        if (endIndex >= text.length) {
          return
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [text, speed, enabled])

  return displayedText
}

// ========== 消息内容渲染组件（增强版）==========

interface MessageContentProps {
  content: string
  enableTypewriter?: boolean
}

function MessageContent({ content, enableTypewriter = false }: MessageContentProps) {
  const displayedText = useTypewriter(content, { speed: 3, enabled: enableTypewriter })
  const textToShow = enableTypewriter ? displayedText : content

  // 解析内容为富文本格式
  const parseContent = (text: string): React.ReactNode => {
    const lines = text.split('\n')
    const result: React.ReactNode[] = []
    let inList = false
    let listItems: React.ReactNode[] = []
    let listKey = 0

    const flushList = () => {
      if (listItems.length > 0) {
        result.push(<ul key={`list-${listKey++}`} className="space-y-1 my-2">{listItems}</ul>)
        listItems = []
      }
      inList = false
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (!trimmed) {
        flushList()
        result.push(<div key={`br-${i}`} className="h-2" />)
        continue
      }

      // 检测列表项
      const isEmojiListItem = /^[\p{Emoji}\p{Emoji_Component}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}✅❌⚠️📝✨🎯📊🤔💬🔧📍📌]+/u.test(trimmed.charAt(0))
      const isNumberedListItem = /^[\d]+\.\s*/.test(trimmed)
      const isDashListItem = /^[-•·]\s*/.test(trimmed)

      if (isEmojiListItem || isNumberedListItem || isDashListItem) {
        flushList()
        inList = true

        let icon = ''
        let text = trimmed
        let iconColor = ''

        if (isEmojiListItem) {
          const emojiMatch = trimmed.match(/^([\p{Emoji}\p{Emoji_Component}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}✅❌⚠️📝✨🎯📊🤔💬🔧📍📌]+)/u)
          if (emojiMatch) {
            icon = emojiMatch[1]
            text = trimmed.slice(1).trim()

            if (['❌', '⚠️'].includes(icon)) {
              iconColor = 'text-red-500'
            } else if (['✅', '🎯'].includes(icon)) {
              iconColor = 'text-emerald-500'
            } else if (['📝', '📊', '📌'].includes(icon)) {
              iconColor = 'text-blue-500'
            } else if (['✨', '💬'].includes(icon)) {
              iconColor = 'text-violet-500'
            } else if (['🤔', '🔧'].includes(icon)) {
              iconColor = 'text-amber-500'
            }
          }
        } else if (isNumberedListItem) {
          const numMatch = trimmed.match(/^(\d+)\.\s*/)
          if (numMatch) {
            icon = numMatch[1]
            text = trimmed.slice(numMatch[0].length)
          }
        } else if (isDashListItem) {
          text = trimmed.slice(1).trim()
        }

        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*/g, '')

        listItems.push(
          <li key={`li-${i}`} className="text-sm leading-relaxed flex items-start gap-2">
            {icon && (
              <span className={cn('shrink-0 mt-0.5', iconColor)}>
                {icon}
              </span>
            )}
            <span className="text-gray-700 flex-1 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: text }} />
          </li>
        )
      } else {
        flushList()

        // 标题
        if (trimmed.startsWith('##') || (trimmed.startsWith('**') && trimmed.includes('**'))) {
          let titleText = trimmed
            .replace(/^##\s*/, '')
            .replace(/^\*\*\s*/, '')
            .replace(/\*\*:?\s*$/, '')
            .replace(/\*\*/g, '')
            .replace(/：$/, '')

          result.push(
            <h4 key={`h4-${i}`} className="font-semibold text-gray-900 mt-4 mb-2 text-sm">
              {titleText}
            </h4>
          )
        }
        // 步骤标题
        else if (/^(第[一二三四五六七八九十\d]+步|Step\s*\d+)/.test(trimmed)) {
          result.push(
            <div key={`step-${i}`} className="flex items-center gap-2 mt-4 mb-2">
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded">
                {trimmed}
              </span>
            </div>
          )
        }
        // 成功标记
        else if (trimmed.startsWith('✅')) {
          const successText = trimmed.slice(1).trim()
          result.push(
            <div key={`success-${i}`} className="flex items-start gap-2 py-1">
              <span className="text-emerald-500 shrink-0 mt-0.5">✅</span>
              <span className="text-sm text-gray-700">{successText}</span>
            </div>
          )
        }
        // 错误标记
        else if (trimmed.startsWith('❌')) {
          const errorText = trimmed.slice(1).trim()
          result.push(
            <div key={`error-${i}`} className="flex items-start gap-2 py-1">
              <span className="text-red-500 shrink-0 mt-0.5">❌</span>
              <span className="text-sm text-gray-700">{errorText}</span>
            </div>
          )
        }
        // 普通段落
        else {
          let processedLine = line
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/~~(.+?)~~/g, '<del>$1</del>')

          result.push(
            <p key={`p-${i}`} className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />
          )
        }
      }
    }

    flushList()
    return result.length > 0 ? result : <p className="text-sm text-gray-700">{content.replace(/\*/g, '')}</p>
  }

  return (
    <div className="space-y-1">
      {parseContent(textToShow)}
    </div>
  )
}

// ========== 消息类型 ==========

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCall?: ToolCall
  toolResult?: ToolResult
  reasoning?: string
  toolStatus?: 'executing' | 'success' | 'error'
  toolDuration?: number
  isStreaming?: boolean
  clarify?: {
    prompt: string
    module: string
    collected_data: any
    missing_fields: string[]
    missing_fields_names: string[]
  }
}

// 快捷操作
const QUICK_ACTIONS = [
  { label: '查看我的名字', message: '查看我的名字' },
  { label: '查看教育经历', message: '查看我的教育经历' },
  { label: '把名字改成张三', message: '把名字改成张三' },
  { label: '修改学校为北大', message: '把学校改成北京大学' },
  { label: '更新职位', message: '把职位改成高级前端工程师' },
  { label: '查看工作经历', message: '查看我的工作经历' },
]

export default function Conversation() {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 简历数据状态
  const [resumeData, setResumeData] = useState<ResumeData>(() => ({
    ...initialResumeData,
    id: 'test-resume',
    title: '测试简历',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    templateId: null,
    skillContent: initialResumeData.skills || '',
    activeSection: 'basic',
    draggingProjectId: null,
    globalSettings: {}
  } as ResumeData))

  // 对话状态
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是 RA AI，你的简历助手。\n\n你可以用自然语言告诉我你想做什么，例如：\n\n• "把名字改成张三"\n• "查看我的教育经历"\n• "更新学校为清华大学"\n• "删除第一条工作经历"\n\n让我们开始吧！',
    timestamp: Date.now()
  }])

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  // 步骤进度状态
  const [executionSteps, setExecutionSteps] = useState<Array<{ step: number; title: string; status: 'pending' | 'running' | 'done' }>>([])
  const [lastSuccessAction, setLastSuccessAction] = useState<string | null>(null)

  const sessionIdRef = useRef<string | undefined>(undefined)
  const resumeDataRef = useRef(resumeData)

  useEffect(() => {
    resumeDataRef.current = resumeData
  }, [resumeData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 处理自然语言消息
  const handleNaturalLanguage = useCallback(async (userMessage: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    const assistantMsgId = `assistant-${Date.now()}`
    let thinkingContent = ''
    let toolCall: ToolCall | undefined
    let toolResult: any
    let stepCount = 0
    let lastToolName = ''

    setExecutionSteps([])
    setLastSuccessAction(null)

    try {
      await cvToolsChatStream(
        userMessage,
        resumeData as unknown as Record<string, unknown>,
        sessionIdRef.current,
        {
          onThinking: (thinking: string) => {
            thinkingContent = thinking
            setMessages(prev => {
              const existingMsg = prev.find(msg => msg.id === assistantMsgId)
              if (existingMsg) {
                return prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, reasoning: thinking }
                    : msg
                )
              } else {
                return [...prev, {
                  id: assistantMsgId,
                  role: 'assistant' as const,
                  content: '',
                  timestamp: Date.now(),
                  reasoning: thinking
                }]
              }
            })
          },
          onToolStart: (info: { tool_name: string; action: string; path: string }) => {
            stepCount++
            const toolNameMap: Record<string, string> = {
              'cv_reader': '读取简历',
              'cv_editor': '修改简历',
              'cv_batch_editor': '批量修改'
            }
            const stepTitle = toolNameMap[info.tool_name || ''] || info.tool_name || '工具执行'
            lastToolName = stepTitle

            setExecutionSteps(prev => [
              ...prev,
              { step: stepCount, title: stepTitle, status: 'running' }
            ])
            setExecutionSteps(prev =>
              prev.map((s, i) => i === prev.length - 1 ? s : { ...s, status: 'done' })
            )
          },
          onToolEnd: (info: { tool_name: string; success: boolean; duration_ms: number }) => {
            setExecutionSteps(prev =>
              prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'done' } : s)
            )
            if (info.success && lastToolName) {
              setLastSuccessAction(lastToolName)
            }
          },
          onToolCall: (toolCallData: { name: string; params: any }) => {
            toolCall = toolCallData as ToolCall
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, toolCall, content: `正在执行 ${toolCall.name}...` }
                : msg
            ))
          },
          onToolResult: (result: any) => {
            toolResult = result

            const toolName = result.tool_name
            const dataCopy = JSON.parse(JSON.stringify(resumeDataRef.current))

            // CVEditor 本地更新
            if (toolName === 'CVEditor' && result.success) {
              const backendToolCall = {
                name: toolName,
                params: result.tool_params
              }
              const localResult = executeToolCall(dataCopy, backendToolCall as ToolCall)

              if (localResult.status === 'success') {
                setResumeData(dataCopy as ResumeData)
                resumeDataRef.current = dataCopy as ResumeData
              }
            }

            // CVBatchEditor 本地更新
            if (toolName === 'CVBatchEditor' && result.success) {
              const operations = result.tool_params?.operations || []
              let allSuccess = true

              for (const op of operations) {
                const backendToolCall = {
                  name: 'CVEditor',
                  params: op
                }
                const localResult = executeToolCall(dataCopy, backendToolCall as ToolCall)
                if (localResult.status !== 'success') {
                  allSuccess = false
                }
              }

              if (allSuccess || operations.length > 0) {
                setResumeData(dataCopy as ResumeData)
                resumeDataRef.current = dataCopy as ResumeData
              }
            }

            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, toolResult: result, content: `${toolName} ${result.success ? '✅ 执行成功' : '❌ 执行失败'}` }
                : msg
            ))
          },
          onContentChunk: (content: string) => {
            setMessages(prev => {
              const existingMsg = prev.find(msg => msg.id === assistantMsgId)
              if (existingMsg) {
                return prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: content, isStreaming: true }
                    : msg
                )
              } else {
                return [...prev, {
                  id: assistantMsgId,
                  role: 'assistant' as const,
                  content: content,
                  timestamp: Date.now(),
                  isStreaming: true
                }]
              }
            })
          },
          onContent: (content: string, metadata?: { resume_modified?: boolean; resume_data?: any }) => {
            let responseContent = content
            if (toolCall?.name === 'CVReader' && toolResult?.data) {
              responseContent += '\n\n```json\n' + JSON.stringify(toolResult.data, null, 2).slice(0, 800)
              if (JSON.stringify(toolResult.data, null, 2).length > 800) {
                responseContent += '\n... (数据已截断)'
              }
              responseContent += '\n```'
            }

            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: responseContent,
                    reasoning: thinkingContent || undefined,
                    isStreaming: true
                  }
                : msg
            ))
          },
          onClarify: (clarify: {
            prompt: string
            module: string
            collected_data: any
            missing_fields: string[]
            missing_fields_names: string[]
          }) => {
            setMessages(prev => [...prev, {
              id: `clarify-${Date.now()}`,
              role: 'assistant',
              content: clarify.prompt,
              clarify,
              timestamp: Date.now()
            }])
          },
          onComplete: (sessionId: string) => {
            sessionIdRef.current = sessionId
            setIsLoading(false)
            setTimeout(() => {
              setExecutionSteps([])
              setLastSuccessAction(null)
            }, 3000)
          },
          onError: (error: string) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, content: `❌ 请求失败: ${error}` }
                : msg
            ))
            setIsLoading(false)
          }
        }
      )
    } catch (error) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: `❌ 请求失败: ${error instanceof Error ? error.message : '未知错误'}` }
          : msg
      ))
      setIsLoading(false)
    }
  }, [resumeData])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    handleNaturalLanguage(input.trim())
    setInput('')
  }, [input, isLoading, handleNaturalLanguage])

  const handleQuickAction = useCallback((action: typeof QUICK_ACTIONS[number]) => {
    handleNaturalLanguage(action.message)
    setShowQuickActions(false)
  }, [handleNaturalLanguage])

  const handleNewSession = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '新会话已开始！你可以用自然语言告诉我你想对简历做什么修改。',
      timestamp: Date.now()
    }])
    setExecutionSteps([])
    setLastSuccessAction(null)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      if (input.trim()) {
        handleSend()
      }
    }
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* 顶部导航 */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">RA</span>
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-sm">简历修改助手</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>新会话</span>
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧对话区 */}
        <div className="w-1/2 flex flex-col border-r border-border">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-xl mx-auto w-full space-y-4 pb-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* 头像 */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      message.role === 'user' ? "bg-primary/10" : "bg-muted"
                    )}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-primary" />
                      ) : (
                        <Bot className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* 内容 */}
                    {message.role === 'user' ? (
                      <div className="bg-primary/10 text-foreground px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
                        {message.content}
                      </div>
                    ) : (
                      <div className="flex-1 max-w-[90%]">
                        <div className="bg-card rounded-lg px-4 py-3 border border-border shadow-sm">
                          {/* 推理过程 */}
                          {message.reasoning && (
                            <div className="mb-3 pb-3 border-b border-border">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1.5">
                                <Sparkles className="w-3 h-3" />
                                <span>思考过程</span>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/50 rounded-md p-2">
                                {message.reasoning}
                              </div>
                            </div>
                          )}

                          {/* 工具执行状态 */}
                          {(message.toolStatus || message.toolResult) && (
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs mb-2 pb-2 border-b",
                              message.toolStatus === 'executing'
                                ? "text-primary border-primary/20"
                                : message.toolResult?.success
                                ? "text-emerald-600 border-emerald-200"
                                : "text-red-600 border-red-200"
                            )}>
                              {message.toolStatus === 'executing' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : message.toolResult?.success ? (
                                <CheckCircle className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {message.toolCall?.name}
                                {message.toolResult?.path && ` → ${message.toolResult.path}`}
                              </span>
                              {message.toolDuration !== undefined && (
                                <span className="text-muted-foreground">({message.toolDuration}ms)</span>
                              )}
                            </div>
                          )}

                          {/* 澄清请求 */}
                          {message.clarify && (
                            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <div className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                                <HelpCircle className="w-4 h-4" />
                                <span>需要更多信息</span>
                              </div>
                              <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">{message.clarify.prompt}</p>
                              {message.clarify.missing_fields_names && (
                                <div className="flex flex-wrap gap-2">
                                  {message.clarify.missing_fields_names.map((fieldName, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setInput(`补充${fieldName}：`)}
                                      className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                                    >
                                      + {fieldName}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <MessageContent
                            content={message.content}
                            enableTypewriter={message.isStreaming}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* 流式消息（带步骤进度） */}
                {isLoading && executionSteps.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-2 max-w-[90%]">
                      {/* 步骤进度 */}
                      {executionSteps.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {executionSteps.map((step, idx) => (
                            <React.Fragment key={step.step}>
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-1.5"
                              >
                                <span className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
                                  step.status === 'running'
                                    ? "bg-primary text-primary-foreground"
                                    : step.status === 'done'
                                    ? "bg-emerald-500 text-white"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {step.status === 'done' ? (
                                    <Check className="w-3 h-3" />
                                  ) : step.status === 'running' ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    step.step
                                  )}
                                </span>
                                <span className={cn(
                                  "text-xs",
                                  step.status === 'running'
                                    ? "text-foreground font-medium"
                                    : step.status === 'done'
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground"
                                )}>
                                  {step.title}
                                </span>
                              </motion.div>
                              {idx < executionSteps.length - 1 && (
                                <div className={cn(
                                  "w-4 h-px",
                                  executionSteps[idx].status === 'done'
                                    ? "bg-emerald-300 dark:bg-emerald-700"
                                    : "bg-border"
                                )} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {/* 成功提示 */}
                      {!isLoading && lastSuccessAction && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2"
                        >
                          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="font-medium">{lastSuccessAction}完成</span>
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 加载动画 */}
                {isLoading && executionSteps.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex gap-1 items-center h-8 px-3 bg-muted/50 rounded-lg">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce delay-75" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce delay-150" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 快捷操作 */}
          <AnimatePresence>
            {showQuickActions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border bg-muted/30 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">快捷操作</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_ACTIONS.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(action)}
                        className="px-3 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors text-left"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 输入区域 */}
          <div className="p-4 border-t border-border bg-card">
            <div className="max-w-xl mx-auto">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
              >
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showQuickActions && "rotate-180"
                )} />
                {showQuickActions ? '收起快捷操作' : '展开快捷操作'}
              </button>

              <div className="flex gap-3 items-end">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`
                  }}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder='用自然语言告诉我，例如：把名字改成张三'
                  rows={1}
                  className={cn(
                    "flex-1 px-4 py-2.5 bg-muted/50 rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary/50 transition-all",
                    "resize-none overflow-y-auto",
                    "min-h-[44px] max-h-[80px]",
                    isLoading && "opacity-60"
                  )}
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "px-4 py-2.5 rounded-xl transition-all shrink-0 h-10 w-10",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="text-xs text-muted-foreground/50 text-center mt-2">
                Enter 发送 · Shift + Enter 换行
              </div>
            </div>
          </div>
        </div>

        {/* 右侧预览 */}
        <div className="w-1/2 bg-muted/30 flex flex-col overflow-hidden">
          {/* 预览头部 */}
          <div className="h-12 bg-card border-b border-border px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">简历预览</span>
              <span className="text-xs text-emerald-600">实时更新</span>
            </div>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-card shadow-sm w-full max-w-[700px] rounded-lg border border-border mx-auto min-h-0">
              <div className="w-full overflow-y-auto">
                <HTMLTemplateRenderer resumeData={resumeData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
