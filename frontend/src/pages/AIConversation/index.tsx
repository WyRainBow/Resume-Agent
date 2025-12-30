/**
 * AI 对话创建简历页面
 * 集成 ReAct Agent，支持真实的流式对话
 *
 * 新增特性：
 * - 思考过程展示
 * - 工具执行进度（带状态图标）
 * - 更清晰的视觉层次
 * - 美化的 Markdown 内容渲染
 */
import { motion, AnimatePresence } from 'framer-motion'
import {
  List,
  Trash2,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Building,
  Calendar
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { HTMLTemplateRenderer } from '../Workspace/v2/HTMLTemplateRenderer'
import { initialResumeData } from '@/data/initialResumeData'
import type { ResumeData } from '../Workspace/v2/types'
import { EducationForm, type Education } from './components/EducationForm'
import { cvToolsChatStream } from '@/services/api'

// ========== 消息内容渲染组件 ==========

interface MessageContentProps {
  content: string
}

function MessageContent({ content }: MessageContentProps) {
  // 解析工作经历格式的数据
  const parseWorkExperience = (text: string) => {
    // 匹配工作经历格式：**公司名** - 职位 (时间)
    const workMatch = text.match(/\*\*([^*]+)\*\*\s*-\s*([^(]+)\s*\(([^)]+)\)/)
    if (workMatch) {
      return {
        company: workMatch[1],
        position: workMatch[2].trim(),
        time: workMatch[3]
      }
    }
    return null
  }

  // 检测是否是工作经历数据
  const isWorkExperienceData = (text: string) => {
    return text.includes('**工作经历：**') || text.includes('根据简历数据，您的工作经历如下')
  }

  // 解析内容为富文本格式
  const parseContent = (text: string): React.ReactNode => {
    // 特殊处理工作经历数据
    if (isWorkExperienceData(text)) {
      return parseWorkExperienceContent(text)
    }

    const lines = text.split('\n')
    const result: React.ReactNode[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      // 空行
      if (!trimmed) {
        result.push(<br key={`br-${i}`} />)
        i++
        continue
      }

      // 标题格式 (## xxx 或 **xxx: 或 **xxx**)
      if (trimmed.startsWith('##') || trimmed.startsWith('**')) {
        // 清理所有 Markdown 符号获取标题文本
        let titleText = trimmed
          .replace(/^##\s*/, '')
          .replace(/^\*\*\s*/, '')
          .replace(/\*\*:?\s*$/, '')
          .replace(/\*/g, '')
          .replace(/：$/, '')
        result.push(
          <h4 key={`h4-${i}`} className="font-semibold text-gray-900 mt-4 mb-2">
            {titleText}
          </h4>
        )
        i++
        continue
      }

      // 列表项格式 (1. xxx 或 - xxx 或 ·xxx)
      if (/^[\d\-\•\·]+\s/.test(trimmed)) {
        let listItemText = trimmed.replace(/^[\d\-\•\·]+\s/, '')
        // 处理 **字段名：** 格式
        listItemText = listItemText.replace(/^\*\*\s*(.*?)\s*\*\*\s*：?\s*/, '$1：')
        // 清理残留的 * 符号
        listItemText = listItemText.replace(/\*/g, '')
        result.push(
          <li key={`li-${i}`} className="ml-4 text-gray-600 leading-relaxed">
            {parseInline(listItemText)}
          </li>
        )
        i++
        continue
      }

      // 普通段落 - 清理所有 Markdown 符号
      const cleanedLine = line.replace(/\*/g, '')
      result.push(
        <p key={`p-${i}`} className="text-gray-600 leading-relaxed">
          {parseInline(cleanedLine)}
        </p>
      )
      i++
    }

    return result.length > 0 ? result : <p className="text-gray-600">{content.replace(/\*/g, '')}</p>
  }

  // 解析工作经历内容为卡片
  const parseWorkExperienceContent = (text: string): React.ReactNode => {
    const lines = text.split('\n')
    const cards: React.ReactNode[] = []
    let currentCard: {
      company?: string
      position?: string
      time?: string
      items: string[]
    } | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      // 检测工作经历标题行
      const workMatch = trimmed.match(/\*\*([^*]+)\*\*\s*-\s*([^(]+)\s*\(([^)]+)\)/)
      if (workMatch) {
        // 保存之前的卡片
        if (currentCard && currentCard.items.length > 0) {
          cards.push(renderWorkCard(currentCard))
        }
        // 开始新卡片
        currentCard = {
          company: workMatch[1],
          position: workMatch[2].trim(),
          time: workMatch[3],
          items: []
        }
        continue
      }

      // 检测项目描述等子项（支持多种格式）
      if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('·') || /^\d+\./ .test(trimmed)) {
        const itemText = trimmed.replace(/^[-•·\d.]\s*/, '').replace(/^\*\*\s*(.*?)\s*\*\*:?\s*/, '$1: ')
        if (currentCard) {
          currentCard.items.push(itemText)
        }
        continue
      }

      // 普通文本（属于上一个工作经历）
      if (trimmed && currentCard && trimmed.includes('：')) {
        // 描述性文本，如 "项目描述：xxx"
        currentCard.items.push(trimmed)
      }
    }

    // 添加最后一个卡片
    if (currentCard && currentCard.items.length > 0) {
      cards.push(renderWorkCard(currentCard))
    }

    return cards.length > 0 ? <div className="space-y-4">{cards}</div> : <p className="text-gray-600">{text}</p>
  }

  // 检测是否是成功/完成消息
  const isSuccessMessage = (text: string) => {
    return text.includes('已成功') || text.includes('已完成') || text.includes('修改完成')
  }

  // 渲染工作经历卡片
  const renderWorkCard = (card: { company?: string; position?: string; time?: string; items: string[] }) => {
    // 分组和处理项目
    const groups: { title?: string; items: string[] }[] = []
    let currentGroup: { title?: string; items: string[] } = { items: [] }

    for (const item of card.items) {
      // 检测是否是分组标题（包含：且较短）
      if (item.includes('：') && item.length < 30 && !item.includes('，')) {
        if (currentGroup.items.length > 0) {
          groups.push(currentGroup)
        }
        const titleParts = item.split('：')
        currentGroup = {
          title: titleParts[0].replace(/\*\*/g, '').trim(),
          items: titleParts.length > 1 ? [titleParts[1].trim()] : []
        }
      } else {
        currentGroup.items.push(item)
      }
    }
    if (currentGroup.items.length > 0) {
      groups.push(currentGroup)
    }

    return (
      <div key={`${card.company}-${card.time}`} className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        {/* 卡片头部 */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{card.company}</div>
            <div className="text-sm text-gray-500">{card.position}</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            <Calendar className="w-3 h-3" />
            {card.time}
          </div>
        </div>
        {/* 卡片内容 */}
        <div className="p-4 space-y-3">
          {groups.map((group, gIdx) => (
            <div key={gIdx}>
              {group.title && (
                <div className="text-sm font-medium text-gray-700 mb-2">{group.title}</div>
              )}
              <div className="space-y-1.5">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                    <div className="w-1 h-1 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <span className="leading-relaxed">{parseInline(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 解析行内格式 (加粗等)
  const parseInline = (text: string): React.ReactNode => {
    // 先清理所有 * 符号
    const cleaned = text.replace(/\*/g, '')
    return cleaned
  }

  return (
    <div className="space-y-1">
      {parseContent(content)}
    </div>
  )
}

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string | React.ReactNode
  timestamp: number
  type?: 'text' | 'card' | 'form-education' // 新增表单类型
}

// 思考步骤组件
interface ThinkingStep {
  step: number
  text: string
}

// 工具执行状态
interface ToolExecution {
  toolName: string
  action: string
  path: string
  status: 'running' | 'success' | 'error'
  startTime: number
  duration?: number
}

// ReAct 消息类型（用于流式显示）
interface StreamMessage {
  type: string
  content: string | any
  metadata?: any
}

export default function AIConversation() {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 状态
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData)
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // 流式消息状态
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // 新增：思考过程和工具执行状态
  const [thinkingContent, setThinkingContent] = useState('')
  const [showThinking, setShowThinking] = useState(true)
  const [currentToolExecution, setCurrentToolExecution] = useState<ToolExecution | null>(null)
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([])

  // 初始化消息
  useEffect(() => {
    // 初始用户消息
    const initialUserMsg: Message = {
      id: 'init-user',
      role: 'user',
      content: '你好 RA AI，帮我写一份求职简历',
      timestamp: Date.now()
    }

    // 初始 AI 消息（文本）
    const initialAIMsgText: Message = {
      id: 'init-ai-text',
      role: 'assistant',
      content: 'Hi！我是 RA 简历助手，很高兴与你相遇✨ 让我们一起打造属于你的精彩简历吧！首先，请告诉我你目前的身份，这样我就能为你提供最贴心的指导~',
      timestamp: Date.now() + 100,
      type: 'text'
    }

    // 初始 AI 消息（卡片）
    const initialAIMsgCard: Message = {
      id: 'init-ai-card',
      role: 'assistant',
      content: 'card-content', // 占位符，实际渲染在下方处理
      timestamp: Date.now() + 200,
      type: 'card'
    }

    setMessages([initialUserMsg, initialAIMsgText, initialAIMsgCard])
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, thinkingContent, currentToolExecution])

  // 处理流式响应
  const handleStreamResponse = async (userMessage: string) => {
    setIsStreaming(true)
    setStreamingContent('')
    setThinkingContent('')
    setCurrentToolExecution(null)
    setToolExecutions([])

    let fullContent = ''
    let currentToolStartTime = 0

    // 解析思考内容的辅助函数
    const parseThinkingContent = (content: string): ThinkingStep[] => {
      const steps: ThinkingStep[] = []
      const lines = content.split('\n')
      let stepNum = 1

      for (const line of lines) {
        const trimmed = line.trim()
        // 匹配 "1. xxx" 或 "1、xxx" 格式
        const stepMatch = trimmed.match(/^(\d+)[.、]\s*(.+)/)
        if (stepMatch) {
          steps.push({ step: parseInt(stepMatch[1]), text: stepMatch[2] })
        }
        // 匹配 "- xxx" 格式
        else if (trimmed.startsWith('-')) {
          steps.push({ step: stepNum++, text: trimmed.slice(1).trim() })
        }
        // 匹配 "理解用户意图:" 等
        else if (trimmed.includes('理解用户意图') || trimmed.includes('提取关键信息') || trimmed.includes('确定执行方案')) {
          steps.push({ step: stepNum++, text: trimmed })
        }
      }
      return steps
    }

    try {
      await cvToolsChatStream(
        userMessage,
        resumeData,
        sessionId,
        {
          onThinking: (thinking) => {
            // 显示思考过程 - 只提取"🤔 分析中..."部分
            const match = thinking.match(/🤔 分析中\.\.\.[\s\S]+?(?=📥|🔧|\n\n|$)/)
            if (match) {
              setThinkingContent(match[0].trim())
            } else {
              // 如果没有匹配到，尝试提取有用信息
              const lines = thinking.split('\n').filter(l => l.includes('理解用户意图') || l.includes('提取关键信息') || l.includes('确定执行方案'))
              if (lines.length > 0) {
                setThinkingContent('🤔 分析中...\n' + lines.join('\n'))
              }
            }
            console.log('[Thinking]', thinking)
          },
          onToolCall: (toolCall) => {
            console.log('[Tool Call]', toolCall)
          },
          onToolStart: (info) => {
            console.log('[Tool Start]', info)
            currentToolStartTime = Date.now()
            const newTool: ToolExecution = {
              toolName: info.tool_name,
              action: info.action || 'execute',
              path: info.path || '',
              status: 'running',
              startTime: currentToolStartTime
            }
            setCurrentToolExecution(newTool)
            setToolExecutions(prev => [...prev, newTool])
          },
          onToolEnd: (info) => {
            console.log('[Tool End]', info)
            const duration = Date.now() - currentToolStartTime
            const updatedTool: ToolExecution = {
              toolName: info.tool_name,
              action: info.action || 'execute',
              path: info.path || '',
              status: info.success !== false ? 'success' : 'error',
              startTime: currentToolStartTime,
              duration
            }
            setCurrentToolExecution(updatedTool)
            setToolExecutions(prev =>
              prev.map(t => t.toolName === info.tool_name && t.status === 'running' ? updatedTool : t)
            )
          },
          onToolResult: (result) => {
            console.log('[Tool Result]', result)
          },
          onContentChunk: (chunk) => {
            // 实时流式内容
            fullContent += chunk
            setStreamingContent(fullContent)
          },
          onContent: (content, metadata) => {
            // 最终完整内容
            fullContent = content
            setStreamingContent(content)

            // 如果简历被修改，更新简历数据
            if (metadata.resume_modified && metadata.resume_data) {
              setResumeData(metadata.resume_data)
            }
          },
          onComplete: (newSessionId) => {
            console.log('[Complete]', sessionId)
            // 完成后重置当前工具执行状态
            setCurrentToolExecution(null)
          },
          onError: (error) => {
            console.error('[Error]', error)
            setStreamingContent(`❌ 出错了: ${error}`)
          }
        }
      )
    } catch (error) {
      console.error('Stream error:', error)
      setStreamingContent(`❌ 请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsStreaming(false)
      // 延迟清除思考内容，让用户看到完整过程
      setTimeout(() => {
        setThinkingContent('')
        setCurrentToolExecution(null)
      }, 2000)
    }
  }

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

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

    // 清空之前的流式内容
    setStreamingContent('')

    // 调用流式 API
    await handleStreamResponse(userMessage)

    // 将流式内容保存为消息
    if (streamingContent || fullContent) {
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: streamingContent || fullContent,
        timestamp: Date.now(),
        type: 'text'
      }
      setMessages(prev => [...prev, aiMsg])
      setStreamingContent('')
    }
  }

  // 处理选项点击
  const handleOptionClick = async (option: string) => {
    setSelectedOption(option)

    // 1. 添加用户回复
    const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: `我的求职身份是${option}🎓`,
        timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])

    // 2. 使用 ReAct Agent 回复
    setIsLoading(true)
    setStreamingContent('')

    try {
      await cvToolsChatStream(
        `我的求职身份是${option}，请帮我开始创建简历`,
        resumeData,
        sessionId,
        {
          onContentChunk: (chunk) => {
            setStreamingContent(prev => prev + chunk)
          },
          onContent: (content) => {
            setStreamingContent(content)
            if (content) {
              const aiMsg: Message = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: content,
                timestamp: Date.now(),
                type: 'text'
              }
              setMessages(prev => [...prev, aiMsg])
              setStreamingContent('')
            }
          },
          onError: (error) => {
            setStreamingContent(`❌ ${error}`)
          }
        }
      )
    } catch (error) {
      console.error('Stream error:', error)
      setStreamingContent('❌ 连接失败，请稍后重试')
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }

  // 处理教育经历更新
  const handleEducationChange = (edu: Education) => {
    // 实时更新简历数据
    setResumeData(prev => ({
      ...prev,
      education: [edu] // 暂时只支持一条，或替换第一条
    }))
  }

  // 处理教育经历提交
  const handleEducationSubmit = () => {
    // 可以在这里添加后续流程，比如进入工作经历
    console.log('Education Submitted')
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* 顶部导航栏 */}
      <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* 新版 RA Logo */}
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 bg-violet-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-black italic text-lg pr-0.5 transform -skew-x-6">RA</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">RA 智能简历</span>
          <span className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-full">ReAct Agent</span>
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={() => {
            setMessages([])
            setStreamingContent('')
          }}
        >
          <Trash2 className="w-4 h-4" />
          清除历史
        </button>
      </div>

      {/* 主内容区 - 左右分屏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧对话区 */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-500 ease-in-out",
          selectedOption ? "max-w-[50%]" : "max-w-4xl mx-auto w-full"
        )}>
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            <div className="space-y-8 max-w-3xl mx-auto w-full">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'user' ? (
                    // 用户消息样式
                    <div className="bg-violet-600 text-white px-6 py-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow-md shadow-violet-200 text-[15px] leading-relaxed">
                      {message.content as string}
                    </div>
                  ) : (
                    // AI 消息样式
                    <div className="max-w-[90%] w-full">
                      {message.type === 'text' && (
                        <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-gray-100">
                          <div className="text-[15px] leading-relaxed">
                            <MessageContent content={message.content as string} />
                          </div>
                        </div>
                      )}

                      {message.type === 'card' && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                          {/* 卡片头部 */}
                          <div className="flex items-start gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                              <List className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 mb-1">让我们一起开始吧</h3>
                              <p className="text-gray-500 text-sm">RA 简历想更好地了解你，为你量身定制最合适的简历方案</p>
                            </div>
                          </div>

                          {/* 选项列表 */}
                          <div className="space-y-3 pl-14">
                            {['学生', '职场人士'].map((option) => {
                              const isSelected = selectedOption === option
                              const isDimmed = selectedOption && !isSelected

                              return (
                                <motion.button
                                  key={option}
                                  layout
                                  disabled={!!selectedOption}
                                  whileHover={!selectedOption ? { scale: 1.01 } : {}}
                                  whileTap={!selectedOption ? { scale: 0.99 } : {}}
                                  onClick={() => handleOptionClick(option)}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden",
                                    isSelected
                                      ? "bg-blue-50/80 border-blue-500 shadow-lg shadow-blue-500/10 z-10"
                                      : "bg-white border-gray-100",
                                    !selectedOption && "hover:border-blue-500/50 hover:shadow-sm",
                                    isDimmed && "opacity-50 grayscale"
                                  )}
                                >
                                  <div className={cn(
                                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                                    isSelected
                                      ? "bg-blue-600 scale-110"
                                      : "bg-blue-200 group-hover:bg-blue-400"
                                  )} />
                                  <span className={cn(
                                    "font-medium text-lg transition-colors duration-300",
                                    isSelected
                                      ? "text-blue-900 font-bold"
                                      : "text-gray-700 group-hover:text-blue-600"
                                  )}>
                                    {option}
                                  </span>

                                  {isSelected && (
                                    <motion.div
                                      layoutId="highlight"
                                      className="absolute inset-0 bg-blue-100/50 -z-10"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                    />
                                  )}
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {message.type === 'form-education' && (
                        <EducationForm
                          onChange={handleEducationChange}
                          onSubmit={handleEducationSubmit}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* 流式消息显示 - 增强版 */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[90%] w-full space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>

                      <div className="flex-1 space-y-3">
                        {/* 思考过程 - 可折叠 */}
                        {thinkingContent && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl border border-violet-100 overflow-hidden"
                          >
                            <button
                              onClick={() => setShowThinking(!showThinking)}
                              className="w-full px-4 py-2 flex items-center justify-between text-sm text-violet-700 hover:bg-violet-100/50 transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                正在分析...
                              </span>
                              {showThinking ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <AnimatePresence>
                              {showThinking && (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: 'auto' }}
                                  exit={{ height: 0 }}
                                  className="px-4 pb-3 overflow-hidden"
                                >
                                  <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-white/50 rounded-lg p-3">
                                    {thinkingContent}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )}

                        {/* 工具执行状态 */}
                        {currentToolExecution && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-xl border border-blue-100 shadow-sm"
                          >
                            <div className="px-4 py-3 flex items-center gap-3">
                              {currentToolExecution.status === 'running' ? (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{currentToolExecution.toolName}</span>
                                  <span className="text-xs text-gray-400">·</span>
                                  <span className="text-sm text-gray-500">{currentToolExecution.action}</span>
                                  {currentToolExecution.path && (
                                    <>
                                      <span className="text-xs text-gray-400">·</span>
                                      <span className="text-sm text-gray-500 font-mono">{currentToolExecution.path}</span>
                                    </>
                                  )}
                                </div>
                                {currentToolExecution.duration && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    耗时 {currentToolExecution.duration}ms
                                  </div>
                                )}
                              </div>
                              {currentToolExecution.status === 'running' && (
                                <div className="flex gap-1">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-75" />
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150" />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}

                        {/* 主内容区域 */}
                        {streamingContent && (
                          <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-gray-100 max-w-full">
                            <div className="text-[15px] leading-relaxed">
                              <MessageContent content={streamingContent} />
                              <span className="inline-block w-2 h-4 bg-violet-500 ml-1 animate-pulse" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 加载指示器 */}
              {isLoading && !isStreaming && (
                 <div className="flex justify-start">
                   <div className="flex items-start gap-3">
                     <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                       <Sparkles className="w-4 h-4 text-white" />
                     </div>
                     <div className="bg-gray-100 rounded-2xl px-4 py-3 flex gap-1 items-center">
                       <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                       <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                       <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                     </div>
                   </div>
                 </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入框区域 */}
          <div className="border-t border-gray-100 bg-white p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="输入消息，如：把名字改成张三..."
                  disabled={isStreaming}
                  className={cn(
                    "flex-1 px-5 py-3 rounded-xl border transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500",
                    "disabled:bg-gray-100 disabled:cursor-not-allowed",
                    isStreaming ? "bg-gray-50" : "bg-white"
                  )}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className={cn(
                    "px-5 py-3 rounded-xl transition-all duration-200",
                    "flex items-center gap-2 font-medium",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    input.trim() && !isStreaming
                      ? "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">发送</span>
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-400 flex items-center gap-4">
                <span>💡 可以试试：把名字改成张三</span>
                <span>添加工作经历：腾讯后端工程师，2023-2025</span>
                <span>查看我的简历</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧预览区 - 使用 fixed 定位固定在视口右侧中间 */}
        <AnimatePresence>
          {selectedOption && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-16 right-0 bottom-0 w-1/2 bg-slate-50 border-l border-gray-200 shadow-2xl z-30 flex flex-col"
            >
              {/* 顶部提示条 */}
              <div className="h-10 bg-white border-b border-gray-200 px-4 flex items-center justify-center text-sm text-gray-500 shrink-0">
                简历预览 · 实时更新
              </div>

              {/* 预览内容区 - 固定在中间 */}
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white shadow-xl w-[700px] max-h-[calc(100vh-120px)] rounded-lg overflow-y-auto">
                   <HTMLTemplateRenderer resumeData={resumeData} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

