/**
 * AI 导入弹窗组件（从 v1 移植）
 * 支持全局导入和分模块导入
 */
import React, { useState, useEffect, useRef } from 'react'
import { X, Wand2, RotateCcw, Save } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export type SectionType = 
  | 'contact' 
  | 'education' 
  | 'experience' 
  | 'projects' 
  | 'skills' 
  | 'awards' 
  | 'summary' 
  | 'opensource'
  | 'all'  // 全局导入

export interface AIImportModalProps {
  isOpen: boolean
  sectionType: SectionType | string
  sectionTitle: string
  onClose: () => void
  onSave: (data: any) => void
}

// AI 导入提示词占位符
const aiImportPlaceholders: Record<string, string> = {
  contact: '张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n地区: 北京\n求职意向: 后端开发工程师',
  education: '华南理工大学\n本科 · 计算机科学与技术\n2020.09 - 2024.06\nGPA: 3.8/4.0',
  experience: '字节跳动 · 后端开发实习生\n2023.06 - 2023.09\n- 负责推荐系统后端开发\n- 优化接口性能，QPS 提升 50%',
  projects: '智能简历系统\n技术负责人 · 2023.01 - 2023.06\n- 使用 React + FastAPI 开发\n- 集成 AI 自动生成功能\nGitHub: https://github.com/xxx/resume',
  skills: '编程语言: Java, Python, Go\n数据库: MySQL, Redis, MongoDB\n框架: Spring Boot, FastAPI',
  awards: '国家奖学金 · 2023\nACM 省级一等奖 · 2022\n优秀毕业生 · 2024',
  summary: '3年后端开发经验，熟悉 Java/Go 技术栈，擅长高并发系统设计与优化，有丰富的微服务架构经验。',
  opensource: 'Kubernetes\n核心贡献者\n- 提交性能优化 PR，被成功合并\n- 修复关键 Bug\n仓库: https://github.com/kubernetes/kubernetes',
  all: '张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n\n教育经历:\n华南理工大学 · 本科 · 计算机科学与技术\n2020.09 - 2024.06\n\n工作经历:\n字节跳动 · 后端开发实习生\n2023.06 - 2023.09\n- 负责推荐系统后端开发\n\n项目经历:\n智能简历系统 · 技术负责人\n2023.01 - 2023.06\n- 使用 React + FastAPI 开发',
}

export function AIImportModal({
  isOpen,
  sectionType,
  sectionTitle,
  onClose,
  onSave
}: AIImportModalProps) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [finalTime, setFinalTime] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // 计时器逻辑
  useEffect(() => {
    if (parsing) {
      setElapsedTime(0)
      setFinalTime(null)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current)
      }, 100)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
      if (startTimeRef.current > 0) {
        setFinalTime(Date.now() - startTimeRef.current)
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [parsing])

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setText('')
      setParsedData(null)
      setFinalTime(null)
    }
  }, [isOpen])

  // AI 解析
  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setParsedData(null)
    
    try {
      // 根据是否全局导入选择不同的 API
      const endpoint = sectionType === 'all' 
        ? '/api/resume/parse'  // 全局解析
        : '/api/resume/parse-section'  // 分模块解析
      
      const body = sectionType === 'all'
        ? { text: text.trim() }
        : { text: text.trim(), section_type: sectionType }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        let errMsg = '解析失败'
        try {
          const err = await response.json()
          errMsg = err.detail || errMsg
        } catch {
          errMsg = `HTTP ${response.status}`
        }
        throw new Error(errMsg)
      }
      
      const result = await response.json()
      // 全局解析返回 { resume: {...} }，提取 resume 字段
      if (sectionType === 'all') {
        setParsedData(result.resume || result)
      } else {
        setParsedData(result.data || result)
      }
    } catch (err: any) {
      console.error('AI 解析失败:', err)
      alert('解析失败: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  // 保存数据
  const handleSave = () => {
    if (parsedData) {
      onSave(parsedData)
      onClose()
    }
  }

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`
  const getTimeColor = (ms: number) => {
    if (ms < 2000) return 'text-green-400'
    if (ms < 5000) return 'text-yellow-400'
    return 'text-red-400'
  }
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'rounded-2xl p-6 w-[90%] max-w-[500px]',
          'bg-gradient-to-br from-indigo-950 to-indigo-900',
          'border border-violet-400/30',
          'shadow-2xl shadow-black/50'
        )}
      >
        {/* 标题 */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-violet-400" />
            AI 导入 - {sectionTitle}
          </h3>
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-white/70 text-sm mb-3">
          {sectionType === 'all' 
            ? '粘贴完整简历内容，AI 将自动解析各模块并填充'
            : '粘贴或输入该模块的文本内容，AI 将自动解析并填充'}
        </p>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              const placeholder = aiImportPlaceholders[sectionType] || ''
              if (placeholder && (!text || placeholder.startsWith(text))) {
                e.preventDefault()
                setText(placeholder)
              }
            }
          }}
          placeholder={(aiImportPlaceholders[sectionType] || '请输入文本内容...') + '（TAB 补全）'}
          className={cn(
            'w-full min-h-[180px] p-3 rounded-lg resize-y',
            'bg-white/5 border border-white/20',
            'text-white text-sm font-inherit',
            'outline-none focus:border-violet-400/60',
            'placeholder:text-white/30'
          )}
        />
        
        {/* 解析结果预览 */}
        {parsedData && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="text-green-400 text-sm font-semibold mb-2 flex items-center gap-2">
              ✅ 解析成功！预览：
            </div>
            <pre className="m-0 text-white/80 text-xs whitespace-pre-wrap break-words max-h-[150px] overflow-auto">
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onClose}
            className={cn(
              'px-5 py-2.5 rounded-lg',
              'bg-white/10 border border-white/20',
              'text-white/80 text-sm',
              'hover:bg-white/15 transition-colors'
            )}
          >
            取消
          </button>
          
          {/* 解析按钮 */}
          {!parsedData && (
            <button
              onClick={handleParse}
              disabled={!text.trim() || parsing}
              className={cn(
                'px-6 py-2.5 rounded-lg',
                'bg-gradient-to-r from-violet-500 to-indigo-500',
                'text-white text-sm font-semibold',
                'hover:from-violet-600 hover:to-indigo-600',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2 transition-all'
              )}
            >
              {parsing ? (
                <>
                  <span className="animate-spin">🔄</span>
                  解析中...
                  <span className={cn('text-xs font-medium min-w-[40px]', getTimeColor(elapsedTime))}>
                    {formatTime(elapsedTime)}
                  </span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  AI 解析
                </>
              )}
            </button>
          )}
          
          {/* 保存按钮 */}
          {parsedData && (
            <>
              <button
                onClick={() => { setParsedData(null); setFinalTime(null) }}
                className={cn(
                  'px-5 py-2.5 rounded-lg',
                  'bg-white/10 border border-white/20',
                  'text-white/80 text-sm',
                  'hover:bg-white/15 transition-colors',
                  'flex items-center gap-2'
                )}
              >
                <RotateCcw className="w-4 h-4" />
                重新解析
              </button>
              <button
                onClick={handleSave}
                className={cn(
                  'px-6 py-2.5 rounded-lg',
                  'bg-gradient-to-r from-green-500 to-emerald-500',
                  'text-white text-sm font-semibold',
                  'hover:from-green-600 hover:to-emerald-600',
                  'flex items-center gap-2 transition-all'
                )}
              >
                <Save className="w-4 h-4" />
                填充到表单
                {finalTime !== null && (
                  <span className={cn('text-xs font-medium', getTimeColor(finalTime))}>
                    {formatTime(finalTime)}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIImportModal


