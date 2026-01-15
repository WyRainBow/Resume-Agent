/**
 * AI 对话创建简历页面
 * 1:1 复刻指定 UI 样式
 */
import { motion, AnimatePresence } from 'framer-motion'
import {
  List,
  Trash2
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { HTMLTemplateRenderer } from '../Workspace/v2/HTMLTemplateRenderer'
import { initialResumeData } from '@/data/initialResumeData'
import type { ResumeData } from '../Workspace/v2/types'
import { EducationForm, type Education } from './components/EducationForm'
import { ProgressNav, type ResumeStep } from './components/ProgressNav'

// 简历创建步骤
const RESUME_STEPS: Array<{ key: ResumeStep; label: string }> = [
  { key: 'education', label: '教育经历' },
  { key: 'target-position', label: '目标职位' },
  { key: 'internship', label: '实习经历' },
  { key: 'organization', label: '社团组织' },
  { key: 'project', label: '项目经历' },
  { key: 'skills', label: '技能推荐' },
  { key: 'certificates', label: '证书荣誉' },
  { key: 'basic-info', label: '基本信息' },
  { key: 'template', label: '选择模板' }
]

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string | React.ReactNode
  timestamp: number
  type?: 'text' | 'card' | 'form-education' // 新增表单类型
}

export default function ResumeCreator() {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 状态
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData)
  const [currentStep, setCurrentStep] = useState<ResumeStep>('education')

  const buildEducationSummary = (education?: Education) => {
    if (!education) return ''
    const school = education.school?.trim()
    let major = education.major?.trim()
    const degree = education.degree?.trim()
    if (!school || !major || !degree) return ''
    
    // 如果专业名称已经包含"专业"两个字，则不再添加
    if (major.endsWith('专业')) {
      major = major.slice(0, -2)
    }
    
    return `我在${school}就读${major}专业，学历是${degree} 🌟`
  }

  // 初始化消息
  useEffect(() => {
    // 初始用户消息
    const initialUserMsg: Message = {
      id: 'init-user',
      role: 'user',
      content: '你好 RA AI：帮我写一份求职简历',
      timestamp: Date.now()
    }

    // 初始 AI 消息（文本）
    const initialAIMsgText: Message = {
      id: 'init-ai-text',
                role: 'assistant',
      content: 'Hi！我是 RA 简历，很高兴与你相遇✨ 让我们一起打造属于你的精彩简历吧！首先，请告诉我你目前的身份，这样我就能为你提供最贴心的指导~',
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
    setSelectedOption(option)
    
    // 1. 添加用户回复
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
        content: `我的求职身份是${option}🎓`,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])

    // 2. 模拟 AI 思考和回复
    setIsLoading(true)
    setTimeout(() => {
        // AI 鼓励语
        const aiTextMsg: Message = {
            id: `ai-edu-intro-${Date.now()}`,
                role: 'assistant',
            content: '太棒了！✨ 现在让我们一起梳理你的教育背景。每一段求学经历都是你向上生长的证明，让我们把这些闪光点都记录下来吧！',
                timestamp: Date.now(),
                type: 'text'
              }
        
        // AI 表单卡片
        const aiFormMsg: Message = {
            id: `ai-edu-form-${Date.now()}`,
              role: 'assistant',
            content: 'form-placeholder',
            timestamp: Date.now() + 100,
            type: 'form-education'
        }

        setMessages(prev => [...prev, aiTextMsg, aiFormMsg])
      setIsLoading(false)
    }, 800)
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
  const handleEducationSubmit = (edu: Education) => {
    // 确保数据已更新
    setResumeData(prev => ({
      ...prev,
      education: [edu]
    }))

    // 根据实际填写的信息生成总结消息
    const summary = buildEducationSummary(edu)
    if (summary) {
      const userSummaryMsg: Message = {
        id: `user-edu-summary-${Date.now()}`,
        role: 'user',
        content: summary,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, userSummaryMsg])
    }

    // 进入下一步：目标职位
    setCurrentStep('target-position')
    // 可以在这里添加下一步的 AI 消息
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
        </div>
        
          <button
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={() => setMessages([])} 
          >
          <Trash2 className="w-4 h-4" />
          清除历史记录
          </button>
      </div>

      {/* 流程导航栏 - 固定在顶部 */}
      {selectedOption && (
        <ProgressNav currentStep={currentStep} steps={RESUME_STEPS} />
      )}

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
                        <div className="text-gray-600 text-[15px] leading-relaxed mb-4">
                        {message.content as string}
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
                              // 如果已经做出选择，禁用的选项变得不明显
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

              {/* 加载指示器 */}
              {isLoading && (
                 <div className="flex justify-start">
                   <div className="bg-gray-100 rounded-2xl px-4 py-3 flex gap-1 items-center">
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                      </div>
                    </div>
              )}

              <div ref={messagesEndRef} />
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
