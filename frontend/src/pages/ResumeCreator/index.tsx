/**
 * ResumeCreator - 新手引导创建简历页面
 *
 * 目的：为初次使用用户提供简洁的简历创建引导流程
 * 特点：
 * - 身份选择卡片
 * - 渐进式信息收集
 * - 简洁的对话界面
 * - 右侧实时预览
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Bot,
  GraduationCap,
  Briefcase,
  Award,
  X,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  Wand2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HTMLTemplateRenderer } from '../Workspace/v2/HTMLTemplateRenderer'
import { initialResumeData } from '@/data/initialResumeData'
import type { ResumeData } from '../Workspace/v2/types'
import { cvToolsChatStream } from '@/services/api'

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string | React.ReactNode
  timestamp: number
  type?: 'text' | 'card' | 'identity-selection'
}

// 身份选项
const IDENTITY_OPTIONS = [
  {
    id: 'student',
    icon: <GraduationCap className="w-5 h-5" />,
    title: '在校学生',
    description: '本科/研究生在读，主要突出教育背景和实习经历'
  },
  {
    id: 'professional',
    icon: <Briefcase className="w-5 h-5" />,
    title: '职场人士',
    description: '已工作，突出工作经验和专业技能'
  },
  {
    id: 'graduate',
    icon: <Award className="w-5 h-5" />,
    title: '应届毕业生',
    description: '刚毕业，平衡展示教育背景和实习经历'
  }
]

export default function ResumeCreator() {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 状态
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData)
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // 会话 ID
  const sessionId = `creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // 初始化欢迎消息
  useEffect(() => {
    const welcomeMsg: Message = {
      id: 'welcome',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      type: 'identity-selection'
    }
    setMessages([welcomeMsg])
  }, [])

  // 处理身份选择
  const handleIdentitySelect = async (identity: string) => {
    setSelectedIdentity(identity)

    const option = IDENTITY_OPTIONS.find(o => o.id === identity)
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `我是${option?.title}`,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMsg])
    setShowPreview(true)

    // 发送到后端
    setIsLoading(true)
    setIsStreaming(true)

    try {
      await cvToolsChatStream(
        `我是${option?.title}，帮我创建一份简历`,
        resumeData,
        sessionId,
        {
          onThinking: () => {},
          onToolStart: () => {},
          onToolEnd: () => {},
          onContentChunk: (chunk: string) => {
            setStreamingContent(prev => prev + chunk)
          },
          onContent: (content: string, metadata) => {
            setStreamingContent(content)
            if (metadata.resume_modified && metadata.resume_data) {
              setResumeData(metadata.resume_data)
            }
          },
          onComplete: () => {
            // 保存消息
            setMessages(prev => {
              const newMessages = [...prev]
              // 移除临时的流式消息（如果有）
              const filtered = newMessages.filter(m => m.id !== 'streaming')

              // 添加最终回复
              const aiMsg: Message = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: streamingContent,
                timestamp: Date.now(),
                type: 'text'
              }
              return [...filtered, aiMsg]
            })
          },
          onError: (error: string) => {
            setMessages(prev => [...prev, {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: `抱歉，出错了：${error}`,
              timestamp: Date.now()
            }])
          }
        }
      )
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '网络请求失败，请重试',
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // 添加用户消息
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])

    // 发送到后端
    setIsLoading(true)
    setIsStreaming(true)
    setStreamingContent('')

    try {
      await cvToolsChatStream(
        userMessage,
        resumeData,
        sessionId,
        {
          onThinking: () => {},
          onToolStart: () => {},
          onToolEnd: () => {},
          onContentChunk: (chunk: string) => {
            setStreamingContent(prev => prev + chunk)
          },
          onContent: (content: string, metadata) => {
            setStreamingContent(content)
            if (metadata.resume_modified && metadata.resume_data) {
              setResumeData(metadata.resume_data)
            }
          },
          onComplete: () => {
            setMessages(prev => {
              const newMessages = [...prev]
              const filtered = newMessages.filter(m => m.id !== 'streaming')

              const aiMsg: Message = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: streamingContent,
                timestamp: Date.now(),
                type: 'text'
              }
              return [...filtered, aiMsg]
            })
          },
          onError: (error: string) => {
            setMessages(prev => [...prev, {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: `出错了：${error}`,
              timestamp: Date.now()
            }])
          }
        }
      )
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '请求失败，请重试',
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  // 跳转到完整编辑器
  const goToWorkspace = () => {
    navigate('/workspace/html')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* 顶部导航 */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-primary-foreground font-bold text-sm">RA</span>
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-sm">创建新简历</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <span>跳过引导</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧对话区 */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          showPreview ? "max-w-[50%]" : "max-w-2xl mx-auto w-full"
        )}>
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-xl mx-auto w-full space-y-4 pb-4">
              <AnimatePresence mode="popLayout">
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
                        {message.content as string}
                      </div>
                    ) : (
                      <div className="flex-1 max-w-[90%]">
                        {message.type === 'identity-selection' ? (
                          /* 身份选择卡片 */
                          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                                <Wand2 className="w-5 h-5 text-primary-foreground" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-foreground">创建你的简历</h3>
                                <p className="text-xs text-muted-foreground">选择你的身份，我会帮你快速创建</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {IDENTITY_OPTIONS.map((option) => (
                                <button
                                  key={option.id}
                                  onClick={() => !selectedIdentity && handleIdentitySelect(option.id)}
                                  disabled={!!selectedIdentity}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all",
                                    selectedIdentity === option.id
                                      ? "bg-primary/10 border-primary"
                                      : "bg-background border-border hover:border-primary/50",
                                    selectedIdentity && selectedIdentity !== option.id && "opacity-50"
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                    selectedIdentity === option.id
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {option.icon}
                                  </div>
                                  <div className="flex-1">
                                    <div className={cn(
                                      "text-sm font-medium",
                                      selectedIdentity === option.id ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                      {option.title}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {option.description}
                                    </div>
                                  </div>
                                  {selectedIdentity === option.id && (
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* 普通文本消息 */
                          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {message.content as string}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* 流式消息 */}
                {isStreaming && streamingContent && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 max-w-[90%]">
                      <div className="text-sm text-foreground leading-relaxed">
                        {streamingContent}
                        <span className="inline-block w-1 h-4 bg-primary/60 ml-0.5 animate-pulse align-middle" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 加载中 */}
                {isLoading && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex gap-1 items-center h-8 px-4 bg-muted/50 rounded-full">
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

          {/* 输入框 */}
          {selectedIdentity && (
            <div className="border-t border-border bg-card p-4">
              <div className="max-w-xl mx-auto">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="告诉我你想添加什么内容..."
                      disabled={isLoading}
                      rows={1}
                      className={cn(
                        "w-full resize-none text-sm py-3 px-4 pr-10",
                        "rounded-xl border border-border bg-background",
                        "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary",
                        "placeholder:text-muted-foreground/50",
                        "disabled:opacity-50"
                      )}
                    />
                    {input && (
                      <button
                        onClick={() => setInput('')}
                        className="absolute right-3 bottom-3 h-5 w-5 rounded hover:bg-muted flex items-center justify-center"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      input.trim() && !isLoading
                        ? "bg-primary text-primary-foreground shadow-sm"
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
          )}
        </div>

        {/* 右侧预览 */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[50%] bg-muted/30 border-l border-border flex flex-col"
            >
              {/* 预览头部 */}
              <div className="h-12 bg-card border-b border-border px-4 flex items-center justify-between shrink-0">
                <span className="text-xs font-medium text-foreground">简历预览</span>
                <button
                  onClick={() => setShowPreview(false)}
                  className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* 预览内容 */}
              <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
                <div className="bg-card shadow-sm w-full max-w-[500px] rounded-lg overflow-hidden border border-border">
                  <HTMLTemplateRenderer resumeData={resumeData} />
                </div>
              </div>

              {/* 底部操作 */}
              <div className="p-4 bg-card border-t border-border shrink-0">
                <button
                  onClick={goToWorkspace}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>继续完善简历</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
