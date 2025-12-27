/**
 * 对话式简历创建工作区
 * 左侧：对话面板，右侧：实时预览
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  User,
  Sparkles,
  Download,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkspaceLayout from '@/pages/WorkspaceLayout'

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// 简历数据类型
interface ResumeData {
  basic?: {
    name?: string
    email?: string
    phone?: string
  }
  education?: any[]
  experience?: any[]
  projects?: any[]
  skills?: string
}

// 对话步骤
type ConversationStep = 'greeting' | 'identity' | 'education' | 'experience' | 'projects' | 'activities' | 'skills' | 'confirm'

export default function ConversationWorkspace() {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 状态
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的简历助手。我会通过对话帮你创建一份专业的简历。让我们开始吧！\n\n首先，请告诉我你的名字。',
      timestamp: Date.now()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<ConversationStep>('identity')
  const [collectedInfo, setCollectedInfo] = useState<Record<string, any>>({})
  const [resumeData, setResumeData] = useState<ResumeData>({})

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // 调用后端 API
      const response = await fetch('http://localhost:8000/api/agent/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          step: step,
          collected_info: collectedInfo,
          resume_data: resumeData
        })
      })

      if (!response.ok) {
        throw new Error('API 请求失败')
      }

      const data = await response.json()

      // AI 回复
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])

      // 更新状态
      setStep(data.next_step)
      setCollectedInfo(data.updated_info || {})

      if (data.resume_data) {
        setResumeData(data.resume_data)
      }

      // 如果对话完成，显示完成选项
      if (data.is_complete) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `complete-${Date.now()}`,
            role: 'assistant',
            content: '\n\n---\n\n✅ 简历生成完成！你可以：\n- 点击右侧"去编辑"进入编辑器完善内容\n- 点击"下载PDF"导出简历',
            timestamp: Date.now()
          }])
        }, 500)
      }

    } catch (error) {
      console.error('对话出错:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试，或者你可以直接前往编辑器手动创建简历。',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 去编辑
  const handleGoToEdit = () => {
    // TODO: 将简历数据传递给编辑器
    navigate('/workspace')
  }

  return (
    <WorkspaceLayout>
      {/* 顶部导航 */}
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Sparkles className="w-4 h-4" />
          <span>AI 对话区</span>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoToEdit}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
              "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm",
              "border border-slate-200/80 dark:border-slate-700/80",
              "text-slate-700 dark:text-slate-200",
              "hover:bg-white dark:hover:bg-slate-800",
              "shadow-sm hover:shadow-md"
            )}
          >
            <Eye className="w-4 h-4 text-indigo-500" />
            去编辑
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
              "bg-gradient-to-r from-indigo-500 to-blue-500 text-white",
              "shadow-lg shadow-indigo-500/30 hover:shadow-xl"
            )}
          >
            <Download className="w-4 h-4" />
            下载 PDF
          </motion.button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：对话面板 */}
        <div className="w-[450px] flex flex-col bg-white border-r border-slate-100">
          {/* 对话历史 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* 头像 */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-500 to-blue-500'
                        : 'bg-slate-100'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                      )}
                    </div>

                    {/* 消息内容 */}
                    <div className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </p>
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
                className="flex justify-start"
              >
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-slate-100">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的回答..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* 右侧：预览面板 */}
        <div className="flex-1 bg-slate-50 overflow-y-auto">
          <div className="h-full flex flex-col">
            {/* 预览头部 */}
            <div className="px-6 py-4 bg-white border-b border-slate-100">
              <h2 className="font-bold text-slate-900">实时预览</h2>
              <p className="text-sm text-slate-500 mt-1">
                {resumeData.basic?.name
                  ? `${resumeData.basic.name} 的简历`
                  : '开始对话后，这里会实时显示你的简历预览'}
              </p>
            </div>

            {/* 预览内容 */}
            <div className="flex-1 p-8">
              <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8 min-h-[600px]">
                {resumeData.basic?.name ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    {/* 基本信息 */}
                    <div className="text-center pb-6 border-b border-slate-100">
                      <h3 className="text-2xl font-black text-slate-900">
                        {resumeData.basic.name}
                      </h3>
                      {resumeData.basic.email && (
                        <p className="text-sm text-slate-500 mt-2">{resumeData.basic.email}</p>
                      )}
                      {resumeData.basic.phone && (
                        <p className="text-sm text-slate-500">{resumeData.basic.phone}</p>
                      )}
                    </div>

                    {/* 教育经历 */}
                    {resumeData.education && resumeData.education.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3">教育经历</h4>
                        {resumeData.education.map((edu: any, i: number) => (
                          <div key={i} className="mb-3 pb-3 border-b border-slate-50 last:border-0">
                            <div className="flex justify-between">
                              <span className="font-medium text-slate-800">{edu.school}</span>
                              <span className="text-sm text-slate-500">{edu.startDate} - {edu.endDate}</span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{edu.major} · {edu.degree}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 工作经历 */}
                    {resumeData.experience && resumeData.experience.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3">工作经历</h4>
                        {resumeData.experience.map((exp: any, i: number) => (
                          <div key={i} className="mb-3 pb-3 border-b border-slate-50 last:border-0">
                            <div className="flex justify-between">
                              <span className="font-medium text-slate-800">{exp.company}</span>
                              <span className="text-sm text-slate-500">{exp.date}</span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{exp.position}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 项目经历 */}
                    {resumeData.projects && resumeData.projects.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3">项目经历</h4>
                        {resumeData.projects.map((proj: any, i: number) => (
                          <div key={i} className="mb-3 pb-3 border-b border-slate-50 last:border-0">
                            <div className="flex justify-between">
                              <span className="font-medium text-slate-800">{proj.name}</span>
                              <span className="text-sm text-slate-500">{proj.date}</span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{proj.role}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 技能 */}
                    {resumeData.skills && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3">专业技能</h4>
                        <div
                          className="text-sm text-slate-600 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: resumeData.skills }}
                        />
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">
                      在左侧对话框中开始对话<br />简历预览会实时显示在这里
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  )
}
