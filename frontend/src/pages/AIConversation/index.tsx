/**
 * AI 对话创建简历页面
 * 1:1 复刻指定 UI 样式
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Trash2,
  List,
  User,
  ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string | React.ReactNode
  timestamp: number
  type?: 'text' | 'card' // 消息类型
}

export default function AIConversation() {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 状态
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // 初始化消息
  useEffect(() => {
    // 初始用户消息
    const initialUserMsg: Message = {
      id: 'init-user',
      role: 'user',
      content: '你好 UP AI，帮我写一份求职简历',
      timestamp: Date.now()
    }
    
    // 初始 AI 消息（文本）
    const initialAIMsgText: Message = {
      id: 'init-ai-text',
      role: 'assistant',
      content: 'Hi！我是 UP 简历，很高兴与你相遇✨ 让我们一起打造属于你的精彩简历吧！首先，请告诉我你目前的身份，这样我就能为你提供最贴心的指导~',
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
  }, [messages])

  // 处理选项点击
  const handleOptionClick = (option: string) => {
    // 这里处理点击逻辑，例如添加用户回复
    console.log('Selected:', option)
    // 示例：跳转到下一步或添加用户回复
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* 顶部导航栏 */}
      <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2563EB] rounded-full flex items-center justify-center text-white font-bold text-xs">
            UP
          </div>
          <span className="font-bold text-gray-900 text-lg">AI 创建简历</span>
        </div>
        
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={() => setMessages([])} // 简单清除演示
        >
          <Trash2 className="w-4 h-4" />
          清除历史记录
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-6 overflow-y-auto">
        <div className="space-y-8">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'user' ? (
                // 用户消息样式
                <div className="bg-[#2563EB] text-white px-6 py-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm text-[15px] leading-relaxed">
                  {message.content as string}
                </div>
              ) : (
                // AI 消息样式
                <div className="max-w-[85%] w-full">
                  {message.type === 'text' && (
                    <div className="text-gray-600 text-[15px] leading-relaxed mb-4">
                      {message.content as string}
                    </div>
                  )}

                  {message.type === 'card' && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      {/* 卡片头部 */}
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                          <List className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">让我们一起开始吧</h3>
                          <p className="text-gray-500 text-sm">UP 简历想更好地了解你，为你量身定制最合适的简历方案</p>
                        </div>
                      </div>

                      {/* 选项列表 */}
                      <div className="space-y-3 pl-14">
                        {['学生', '职场人士'].map((option) => (
                          <motion.button
                            key={option}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleOptionClick(option)}
                            className="w-full flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-[#2563EB] hover:shadow-sm transition-all group text-left"
                          >
                            <div className="w-2 h-2 rounded-full bg-[#bfdbfe] group-hover:bg-[#2563EB] transition-colors" />
                            <span className="text-gray-700 font-medium group-hover:text-[#2563EB] transition-colors">
                              {option}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}

