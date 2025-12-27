/**
 * AI 对话创建简历页面
 * 复刻图2的样式：左侧对话框，右侧选项引导
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  User,
  Sparkles,
  ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function CreateNew() {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 状态
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 RA AI，很高兴与你相识🎉 让我们一起打造属于你的精彩简历吧！首先，请告诉我你目前的身份，这样我就能为你提供最贴心的指导。',
      timestamp: Date.now()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showOptions, setShowOptions] = useState(true)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 处理选项点击
  const handleOptionClick = (option: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: option,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setShowOptions(false)
    setIsLoading(true)

    // 模拟 AI 回复
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `好的！我已经了解到你是${option === '学生' ? '学生' : '职场人士'}。接下来，请告诉我你的名字吧~`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 800)
  }

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

    // 模拟 AI 回复
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '感谢提供的信息！现在让我为你创建一份个性化的简历...',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1200)
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex flex-col">
      {/* 返回按钮 */}
      <div className="fixed top-6 left-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 shadow-sm hover:shadow-md transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </motion.button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        {/* 左侧：对话面板 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-[550px] flex flex-col bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 m-6 overflow-hidden"
        >
          {/* 对话头部 */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">RA AI 智能助手</h2>
                <p className="text-sm text-white/80 text-xs">准备好创建你的完美简历了吗？</p>
              </div>
            </div>
          </div>

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
        </motion.div>

        {/* 右侧：选项引导 */}
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex-1 flex items-center justify-center pr-12"
          >
            <div className="max-w-sm w-full space-y-4">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">请选择你的身份</h3>
                <p className="text-slate-600 font-medium">这样我能为你提供更符合的建议</p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: '学生',
                    description: '还在学校，准备找实习或第一份工作'
                  },
                  {
                    label: '职场人士',
                    description: '已有工作经验，准备跳槽或升职'
                  }
                ].map((option) => (
                  <motion.button
                    key={option.label}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionClick(option.label)}
                    disabled={isLoading}
                    className="w-full p-4 bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <h4 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                      {option.label}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      {option.description}
                    </p>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
