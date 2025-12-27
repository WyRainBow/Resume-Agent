/**
 * 对话模式面板组件
 * 提供对话式简历生成功能
 */
import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, User, Bot, RotateCcw, X, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../../../lib/utils'
import type { ResumeData } from '../types'

// 处理 API_BASE，确保有协议前缀
const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const API_BASE = rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`

// 对话消息类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// 对话步骤
export type ConversationStep =
  | 'greeting'      // 欢迎
  | 'identity'      // 身份确认（学生/职场）
  | 'education'     // 教育背景
  | 'experience'    // 实习经历
  | 'projects'      // 项目经历
  | 'activities'    // 社团活动
  | 'skills'        // 技能证书
  | 'confirm'       // 确认完成

// 对话状态
export interface ConversationState {
  step: ConversationStep
  collectedInfo: {
    identity?: 'student' | 'professional'
    name?: string
    email?: string
    phone?: string
    location?: string
    objective?: string
    education?: Array<{
      school: string
      major: string
      degree: string
      startDate: string
      endDate: string
      description: string
    }>
    experience?: Array<{
      company: string
      position: string
      date: string
      details: string
    }>
    projects?: Array<{
      name: string
      role: string
      date: string
      description: string
    }>
    skills?: string
    awards?: Array<{
      title: string
      issuer: string
      date: string
      description: string
    }>
  }
  isComplete: boolean
}

interface ConversationPanelProps {
  resumeData: ResumeData
  onConversationComplete: (data: ResumeData) => void
  onClose?: () => void
}

// 初始对话状态
const initialConversationState: ConversationState = {
  step: 'greeting',
  collectedInfo: {},
  isComplete: false
}

// 预设消息
const GREETING_MESSAGE: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content: '你好！我是你的 AI 简历助手。让我来帮你快速创建一份专业的简历吧！✨',
  timestamp: Date.now()
}

export default function ConversationPanel({
  resumeData,
  onConversationComplete,
  onClose
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversationState, setConversationState] = useState<ConversationState>(initialConversationState)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 获取当前步骤的引导消息
  const getCurrentStepPrompt = (): string => {
    const { step, collectedInfo } = conversationState

    switch (step) {
      case 'greeting':
        return '请先告诉我，你现在是学生还是已经工作了呢？'
      case 'identity':
        return `好的，${collectedInfo.identity === 'student' ? '同学' : '职场人士'}！接下来让我了解一下你的基本情况。你的名字是什么？`
      case 'education':
        return '请分享你的教育背景（学校、专业、学历），如果没有可以跳过。'
      case 'experience':
        return '请分享你的实习/工作经历（公司、职位、时间），如果没有可以跳过。'
      case 'projects':
        return '请分享你的项目经历，如果没有可以跳过。'
      case 'activities':
        return '请分享你的社团/活动经历，如果没有可以跳过。'
      case 'skills':
        return '最后，请告诉我你的专业技能和证书。'
      case 'confirm':
        return '太棒了！我已经帮你生成了一份简历，请查看右侧预览。如果需要修改，可以切换到编辑模式手动调整。'
      default:
        return '请继续...'
    }
  }

  // 获取当前步骤的快捷选项
  const getCurrentStepOptions = (): string[] | null => {
    const { step } = conversationState

    switch (step) {
      case 'greeting':
        return ['我是学生', '我已经工作']
      case 'education':
      case 'experience':
      case 'projects':
      case 'activities':
        return ['跳过此步骤']
      default:
        return null
    }
  }

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // 处理用户输入并生成回复
    await processUserInput(userMessage.content)
  }

  // 选择快捷选项
  const handleSelectOption = async (option: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: option,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    await processUserInput(option)
  }

  // 处理用户输入并调用 AI
  const processUserInput = async (userInput: string) => {
    try {
      const { step, collectedInfo } = conversationState

      // 根据当前步骤处理用户输入
      let newInfo = { ...collectedInfo }
      let nextStep: ConversationStep = step
      let aiResponse = ''

      // 身份确认
      if (step === 'greeting') {
        if (userInput.includes('学生')) {
          newInfo.identity = 'student'
          nextStep = 'identity'
          aiResponse = '好的，同学！请告诉我你的名字？'
        } else if (userInput.includes('工作')) {
          newInfo.identity = 'professional'
          nextStep = 'identity'
          aiResponse = '好的，职场人士！请告诉我你的名字？'
        } else {
          aiResponse = '请选择"我是学生"或"我已经工作"，这样我可以更好地为你服务。'
        }
      }
      // 收集名字
      else if (step === 'identity') {
        newInfo.name = userInput
        nextStep = 'education'
        aiResponse = `很高兴认识你，${userInput}！现在让我们开始构建你的简历。\n\n请分享你的教育背景：学校名称、专业、学历，以及就读时间。`
      }
      // 其他步骤调用 AI API
      else {
        // 调用后端对话 API
        const response = await fetch(`${API_BASE}/api/agent/conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userInput,
            step: step,
            collected_info: collectedInfo,
            resume_data: resumeData
          })
        })

        if (!response.ok) {
          throw new Error('API 请求失败')
        }

        const result = await response.json()
        newInfo = { ...newInfo, ...result.updated_info }
        nextStep = result.next_step || step
        aiResponse = result.reply || '收到，请继续...'

        // 如果对话完成
        if (result.is_complete) {
          onConversationComplete(result.resume_data)
          nextStep = 'confirm'
        }
      }

      // 更新状态
      setConversationState({
        step: nextStep,
        collectedInfo: newInfo,
        isComplete: nextStep === 'confirm'
      })

      // 添加 AI 回复
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      console.error('处理用户输入失败:', error)

      // 错误消息
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: '抱歉，我遇到了一些问题。请稍后再试。',
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  // 重置对话
  const handleReset = () => {
    setMessages([GREETING_MESSAGE])
    setConversationState(initialConversationState)
    setInputValue('')
  }

  const options = getCurrentStepOptions()
  const canSend = inputValue.trim() && !isTyping

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900/50 rounded-lg border border-gray-100 dark:border-neutral-800 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI 对话生成
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {conversationState.isComplete ? '对话已完成' : '回答问题，快速生成简历'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!conversationState.isComplete && (
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="重新开始"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role !== 'user' && (
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  message.role === 'system'
                    ? 'bg-orange-100 dark:bg-orange-900/30'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                )}>
                  {message.role === 'system' ? (
                    <X className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
              )}

              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5',
                message.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md'
                  : message.role === 'system'
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-bl-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
              )}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </motion.div>
          ))}

          {/* 输入中提示 */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          {/* 完成状态 */}
          {conversationState.isComplete && !isTyping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>简历生成完成！请查看右侧预览</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* 快捷选项 */}
      {options && !conversationState.isComplete && !isTyping && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-neutral-800">
          <div className="flex gap-2 flex-wrap">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleSelectOption(option)}
                className="px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 输入框 */}
      {!conversationState.isComplete && (
        <div className="p-4 border-t border-gray-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={isTyping ? 'AI 正在思考...' : getCurrentStepPrompt()}
              disabled={isTyping}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-sm',
                'bg-white dark:bg-slate-800',
                'border border-gray-200 dark:border-neutral-700',
                'text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all'
              )}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium transition-all',
                canSend
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              )}
            >
              {canSend ? (
                <>
                  <span>发送</span>
                  <Send className="w-4 h-4" />
                </>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* 提示信息 */}
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>按 Enter 发送，Shift + Enter 换行</span>
          </div>
        </div>
      )}
    </div>
  )
}
