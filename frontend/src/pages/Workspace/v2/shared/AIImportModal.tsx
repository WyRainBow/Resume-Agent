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
  opensource: 'Kubernetes\n核心贡献者 · 2023.03 - 2024.06\n- 提交性能优化 PR #12345，优化 Pod 调度算法，被成功合并\n- 修复关键 Bug #12346，解决内存泄漏问题\n- 参与社区讨论，协助新贡献者\n仓库: https://github.com/kubernetes/kubernetes\n\nVue.js\n贡献者 · 2022.08 - 2023.12\n- 实现新特性：响应式系统性能优化\n- 修复 SSR 渲染问题，提升首屏加载速度 30%\n- 编写单元测试，提升代码覆盖率\n仓库: https://github.com/vuejs/vue\n\nReact\n社区维护者 · 2021.05 - 2022.10\n- 维护 React 官方文档中文翻译\n- 提交多个 Bug 修复和性能优化 PR\n- 组织线上技术分享活动\n仓库: https://github.com/facebook/react',
  all: '张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n求职意向: 后端开发工程师\n\n教育经历:\n北京大学\n计算机科学与技术\n2022.09 - 2026.06\n学校: 清华大学\n学历: 本科\n专业: 电子信息\n\n实习经历:\n实习经历一\n算法实习生\n2025.06 - 2025.10\n\n实习经历二\n后端开发实习生\n2025.02 - 2025.06\n\n实习经历三\n前端开发实习生\n2024.12 - 2025.01\n\n项目经历:\n项目一\n- 子项目甲\n  * 描述该子项目的主要目标和解决的问题\n  * 概述采用的核心技术手段或架构思路\n  * 说明实现过程中的关键策略或容灾措施\n- 子项目乙\n  * 介绍从 0 到 1 搭建某模块的背景与价值\n  * 说明缓存或性能优化的思路与结果\n  * 描述数据一致性或稳定性保障方案\n- 子项目丙\n  * 总结优化高风险操作的范围与收益\n  * 概括查询调优、索引策略等具体动作\n  * 解释资源隔离或负载转移方式\n\n项目二\n- 项目描述：\n  概述一个具备多模态检索、长文阅读与结构化输出能力的智能系统，强调其解决的痛点与特性。\n- 核心职责与产出：\n  描述在需求拆解、链路打通以及配套平台建设中的角色与贡献。\n  * 模块一：说明如何利用大模型进行推理规划与查询扩展，提升召回能力\n  * 模块二：概括多源融合检索架构，指出使用的检索方式与调度策略\n  * 模块三：描述 RAG 或抗幻觉生成的实现思路、Prompt 策略与输出形式\n  * 模块四：介绍广告或数据闭环链路的建设，涵盖埋点、分析与反馈机制\n\n开源经历:\n社区贡献一（某分布式项目）\n* 仓库：[https://example.com/repo1](https://example.com/repo1)\n* 简述提交的核心 PR 或 Issue 处理经验\n* 说明在社区内承担的协作职责\n\n社区贡献二\n* 组件一：列举涉及的技术栈与能力范围\n* 仓库：[https://example.com/repo2（可演示）](https://example.com/repo2（可演示）)\n* 能力二：描述检索、知识构建或多 Agent 流程的实现\n* 成果：简述分享传播与社区反馈\n\n专业技能:\n后端: 熟悉若干编程语言或服务框架\n数据库: 了解常见数据库及调优思路\n缓存: 掌握缓存策略与典型问题处理\n网络: 熟悉常见网络协议与连接管理\n操作系统: 理解进程线程与资源管理机制\nAI: 了解 Agent、RAG、Function Call 与 Prompt 工程\n\n荣誉奖项:\n例如学科竞赛、省级奖项等',
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
      // 处理命名不一致：openSource -> opensource
      const normalizedType = sectionType === 'openSource' ? 'opensource' : sectionType
      
      // 根据是否全局导入选择不同的 API
      const endpoint = sectionType === 'all' 
        ? '/api/resume/parse'  // 全局解析
        : '/api/resume/parse-section'  // 分模块解析
      
      const body = sectionType === 'all'
        ? { text: text.trim() }
        : { text: text.trim(), section_type: normalizedType }
      
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
              // 处理命名不一致：openSource -> opensource
              const normalizedType = sectionType === 'openSource' ? 'opensource' : sectionType
              const placeholder = aiImportPlaceholders[normalizedType] || ''
              if (placeholder && (!text || placeholder.startsWith(text))) {
                e.preventDefault()
                setText(placeholder)
              }
            }
          }}
          placeholder={(() => {
            // 处理命名不一致：openSource -> opensource
            const normalizedType = sectionType === 'openSource' ? 'opensource' : sectionType
            return (aiImportPlaceholders[normalizedType] || '请输入文本内容...') + '（TAB 补全）'
          })()}
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


