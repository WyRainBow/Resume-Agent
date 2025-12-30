/**
 * CV Tools 测试页面
 * 支持自然语言对话操作简历
 * 左侧：对话界面
 * 右侧：HTML 简历实时预览
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  History, 
  Plus, 
  Sparkles,
  User,
  CheckCircle,
  XCircle,
  ChevronDown,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HTMLTemplateRenderer } from '../Workspace/v2/HTMLTemplateRenderer'
import { initialResumeData } from '../../data/initialResumeData'
import { cvReader, cvEditor, executeToolCall, type ToolCall, type ToolResult } from '../../tools/cvTools'
import { cvToolsChat, cvToolsChatStream, type ToolCallSpec } from '../../services/api'
import type { ResumeData } from '../Workspace/v2/types'

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCall?: ToolCall
  toolResult?: ToolResult
  reasoning?: string
}

// 预设的快捷操作
const QUICK_ACTIONS = [
  { label: '查看我的名字', message: '查看我的名字' },
  { label: '查看教育经历', message: '查看我的教育经历' },
  { label: '把名字改成韦宇', message: '把名字改成韦宇' },
  { label: '修改学校为北大', message: '把学校改成北京大学' },
  { label: '更新职位', message: '把职位改成高级前端工程师' },
  { label: '查看工作经历', message: '查看我的工作经历' },
]

export default function CVToolsTest() {
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 RA AI，你的简历助手。\n\n你可以用自然语言告诉我你想做什么，例如：\n\n• "把名字改成张三"\n• "查看我的教育经历"\n• "更新学校为清华大学"\n• "删除第一条工作经历"\n\n让我们开始吧！',
      timestamp: Date.now()
    }
  ])
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [isComposing, setIsComposing] = useState(false) // 跟踪输入法状态
  
  // 会话 ID（使用 useRef 避免 useCallback 依赖问题）
  const sessionIdRef = useRef<string | undefined>(undefined)
  
  // 简历数据的 ref（确保在回调中访问最新值）
  const resumeDataRef = useRef(resumeData)
  useEffect(() => {
    resumeDataRef.current = resumeData
    console.log('[React 状态更新] skillContent:', resumeData.skillContent?.slice(0, 100))
  }, [resumeData])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 处理自然语言消息
  const handleNaturalLanguage = useCallback(async (userMessage: string) => {
    // 添加用户消息
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    // 创建助手消息（流式更新）
    const assistantMsgId = `assistant-${Date.now()}`
    let thinkingContent = ''
    let toolCall: ToolCall | undefined
    let toolResult: any

    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '正在分析您的请求...',
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      // 调用流式 API
      console.log('[API 请求] session_id:', sessionIdRef.current)
      
      await cvToolsChatStream(
        userMessage,
        resumeData as unknown as Record<string, unknown>,
        sessionIdRef.current,
        {
          onThinking: (thinking: string) => {
            thinkingContent = thinking
            // 更新消息显示思考过程
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMsgId 
                ? { ...msg, reasoning: thinking }
                : msg
            ))
          },
          onToolCall: (toolCallData: { name: string; params: any }) => {
            toolCall = toolCallData as ToolCall
            console.log('[工具调用]', toolCall)
            
            // 更新消息显示工具调用（流式更新）
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMsgId 
                ? { ...msg, toolCall, content: `正在执行 ${toolCall.name}...` }
                : msg
            ))
          },
          onToolResult: (result: any) => {
            toolResult = result
            console.log('[工具结果]', result)
            console.log('[工具结果] tool_params.value:', result.tool_params?.value)
            
            // 如果是 CVEditor 且成功，执行本地工具调用更新前端数据
            if (toolCall?.name === 'CVEditor' && result.success) {
              // 使用后端返回的完整参数，而不是前端的 toolCall
              const backendToolCall = {
                name: result.tool_name,
                params: result.tool_params
              }
              console.log('[简历更新] 使用后端工具参数:', backendToolCall.params)
              
              // 使用 ref 确保访问最新的 resumeData
              const dataCopy = JSON.parse(JSON.stringify(resumeDataRef.current))
              console.log('[简历更新] 执行前数据:', backendToolCall.params.path, '当前值:', dataCopy.skillContent?.slice(0, 50))
              const localResult = executeToolCall(dataCopy, backendToolCall as ToolCall)
              console.log('[简历更新] 执行后数据:', dataCopy.skillContent?.slice(0, 100))
              if (localResult.status === 'success') {
                console.log('[简历更新] dataCopy skillContent:', dataCopy.skillContent?.slice(0, 100))
                // 直接使用更新后的数据对象
                setResumeData(dataCopy as ResumeData)
                console.log('[简历更新] 本地工具调用成功，已调用 setResumeData')
              }
            }
            
            // 更新消息显示工具结果（流式更新）
            const statusText = result.success ? '✅ 执行成功' : '❌ 执行失败'
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMsgId 
                ? { ...msg, toolResult: result, content: `${toolCall?.name} ${statusText}` }
                : msg
            ))
          },
          onContent: (content: string, metadata?: { resume_modified?: boolean; resume_data?: any }) => {
            // 构建完整回复（包含工具结果数据）
            let responseContent = content
            if (toolCall?.name === 'CVReader' && toolResult?.data) {
              responseContent += '\n\n```json\n' + JSON.stringify(toolResult.data, null, 2).slice(0, 800)
              if (JSON.stringify(toolResult.data, null, 2).length > 800) {
                responseContent += '\n... (数据已截断)'
              }
              responseContent += '\n```'
            }
            
            // 注意：不再使用后端返回的 resume_data 覆盖前端数据
            // 因为前端在 onToolResult 中已经通过本地工具调用更新了数据
            // 使用后端数据会导致覆盖问题
            // if (metadata?.resume_data) {
            //   setResumeData(metadata.resume_data)
            // }
            
            // 更新消息显示最终内容
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMsgId 
                ? { 
                    ...msg, 
                    content: responseContent,
                    reasoning: thinkingContent || undefined
                  }
                : msg
            ))
          },
          onComplete: (sessionId: string) => {
            sessionIdRef.current = sessionId
            console.log('[会话] 保存 session_id:', sessionId)
            setIsLoading(false)
          },
          onError: (error: string) => {
            console.error('[API 错误]', error)
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
      // 错误处理
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId 
          ? { ...msg, content: `❌ 请求失败: ${error instanceof Error ? error.message : '未知错误'}` }
          : msg
      ))
      setIsLoading(false)
    }
  }, [resumeData])

  // 处理发送
  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    handleNaturalLanguage(input.trim())
    setInput('')
  }, [input, isLoading, handleNaturalLanguage])

  // 处理快捷按钮
  const handleQuickAction = useCallback((action: typeof QUICK_ACTIONS[number]) => {
    handleNaturalLanguage(action.message)
    setShowQuickActions(false)
  }, [handleNaturalLanguage])

  // 新建会话
  const handleNewSession = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '新会话已开始！你可以用自然语言告诉我你想对简历做什么修改。',
      timestamp: Date.now()
    }])
    setResumeData({
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
    } as ResumeData)
  }, [])

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 如果正在输入中文（输入法组合输入中），不处理 Enter 键
    // 应该让 Enter 键确认输入而不是发送
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      // 只有在非输入法状态下才发送
      if (input.trim()) {
        handleSend()
      }
    }
  }
  
  // 处理输入法开始（中文输入开始）
  const handleCompositionStart = () => {
    setIsComposing(true)
  }
  
  // 处理输入法结束（中文输入完成）
  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部导航 */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          {/* RA Logo */}
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 bg-violet-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-black italic text-lg pr-0.5 transform -skew-x-6">RA</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">RA AI</span>
            <span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-xs font-medium rounded-full">自然语言</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <History className="w-4 h-4" />
            历史记录
          </button>
          <button 
            onClick={handleNewSession}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建会话
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：对话区 */}
        <div className="w-1/2 flex flex-col border-r border-gray-200">
          {/* 对话历史 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* 头像 */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      message.role === 'user' 
                        ? "bg-violet-600" 
                        : "bg-gradient-to-br from-violet-500 to-blue-500"
                    )}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-white" />
                      )}
                    </div>

                    {/* 消息内容 */}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3",
                      message.role === 'user'
                        ? "bg-violet-600 text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-800 rounded-tl-sm"
                    )}>
                      {/* 推理过程（默认显示，流式更新） */}
                      {message.reasoning && (
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1.5">
                            <Sparkles className="w-3 h-3" />
                            <span>思考过程</span>
                          </div>
                          <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-md p-2 border border-gray-100">
                            {message.reasoning}
                          </div>
                        </div>
                      )}
                      
                      {/* 工具调用结果标记 */}
                      {message.toolResult && (
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs mb-2 pb-2 border-b",
                          message.toolResult.success 
                            ? "text-green-600 border-green-200" 
                            : "text-red-600 border-red-200"
                        )}>
                          {message.toolResult.success ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {message.toolCall?.name} 
                            {message.toolResult.path && ` → ${message.toolResult.path}`}
                          </span>
                        </div>
                      )}
                      
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* 加载动画 */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                    <span className="text-sm text-gray-600">正在分析您的请求...</span>
                  </div>
                </motion.div>
              )}

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
                className="border-t border-gray-100 bg-gray-50 overflow-hidden"
              >
                <div className="p-4 grid grid-cols-3 gap-2">
                  {QUICK_ACTIONS.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors text-left"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 输入区域 */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="max-w-2xl mx-auto">
              {/* 快捷操作切换 */}
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3 transition-colors"
              >
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showQuickActions && "rotate-180"
                )} />
                {showQuickActions ? '收起快捷操作' : '展开快捷操作'}
              </button>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder='用自然语言告诉我，例如：把名字改成张三'
                  className={cn(
                    "flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 transition-all",
                    isLoading && "opacity-60" // 加载时降低透明度提示，但不禁用
                  )}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "px-4 py-3 rounded-xl transition-all",
                    "bg-violet-600 hover:bg-violet-700 text-white",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：简历预览 */}
        <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
          {/* 预览头部 */}
          <div className="h-12 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{resumeData.basic?.name || '简历预览'}</span>
              <span className="text-sm text-gray-500">实时更新</span>
            </div>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden max-w-3xl mx-auto">
              <HTMLTemplateRenderer resumeData={resumeData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
