/**
 * AI 帮写对话框组件
 * 根据教育经历信息，使用 AI 生成补充说明
 */
import { CheckCircle, GraduationCap, Loader2, RefreshCw, Send, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TimerDisplay, useTimer } from '../../../../hooks/useTimer'
import { useTypewriter } from '../../../../hooks/useTypewriter'
import { cn } from '../../../../lib/utils'
import { rewriteResumeStream } from '../../../../services/api'
import type { Education } from '../types'

interface AIWriteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  educationData: Partial<Education>
  onApply: (content: string) => void
}

// 根据学历层次构造不同的提示词策略
const getDegreeStrategy = (degree: string) => {
  const lowerDegree = degree?.toLowerCase() || ''
  
  if (lowerDegree.includes('博士') || lowerDegree.includes('phd') || lowerDegree.includes('doctor')) {
    return {
      focus: '研究方向、学术贡献、发表论文',
      prompt: `请侧重描述研究方向和学术成果。必须包括：
        1. 主修课程（6-8门核心课程，用顿号分隔）
        2. 研究领域和主要研究课题
        3. 学术发表或科研项目参与（如有）
        4. 研究方法或专业工具掌握情况`
    }
  }
  
  if (lowerDegree.includes('硕士') || lowerDegree.includes('master') || lowerDegree.includes('研究生')) {
    return {
      focus: '研究方向、项目经验、专业深度',
      prompt: `请侧重描述专业深度和研究能力。必须包括：
        1. 主修课程（6-8门核心研究生课程，用顿号分隔）
        2. 研究方向或专业领域
        3. 项目或研究经历（具体描述项目内容和成果）
        4. 学术成果或论文（如有）`
    }
  }
  
  if (lowerDegree.includes('专科') || lowerDegree.includes('大专')) {
    return {
      focus: '实践技能、职业资格、实训经历',
      prompt: `请侧重描述实践技能和职业能力。必须包括：
        1. 主修课程（5-7门专业技能课程，用顿号分隔）
        2. 实训或实习经历（具体项目和实践内容）
        3. 职业资格证书（如有）
        4. 动手能力和项目经验（具体成果）`
    }
  }
  
  // 默认本科
  return {
    focus: '核心课程、实践经历、综合能力',
    prompt: `请侧重描述专业基础和综合能力。必须包括：
      1. 主修课程（6-8门核心专业课程，用顿号分隔）
      2. 课程设计或项目经验（具体描述项目内容、使用的技术、实现的功能）
      3. 竞赛、实习或社团经历（如有，描述具体成果或成就）
      4. 额外能力（如英语能力、辅修课程、技能证书等）`
  }
}

// 预设的改写选项
const REFINE_OPTIONS = [
  '更简洁专业',
  '突出技术能力',
  '增加量化数据',
  '优化语言表达',
  '突出工作成果',
  '字数控制在100字以内'
]

// 构造 AI 提示词
const buildPrompt = (data: Partial<Education>, regenerateCount: number = 0, userInstruction?: string) => {
  const { school, major, degree, gpa, startDate, endDate } = data
  const strategy = getDegreeStrategy(degree || '')
  
  // 判断 GPA 是否较高
  let gpaHighlight = ''
  if (gpa) {
    const gpaNum = parseFloat(gpa.replace(/[^0-9.]/g, ''))
    if (gpaNum >= 3.5 || gpaNum >= 85) {
      gpaHighlight = `（GPA ${gpa} 表现优异，请特别强调）`
    }
  }
  
  // 根据重新生成次数添加不同的多样性要求
  let diversityInstruction = ''
  if (regenerateCount > 0 && !userInstruction) {
    const variations = [
      '请从不同的角度描述，可以更侧重实践能力和项目经验。',
      '请尝试不同的表达方式，可以更强调学术成果和研究能力。',
      '请使用不同的课程组合和描述重点，突出不同的核心竞争力。',
      '请从另一个角度展现，可以更注重综合素养和团队协作能力。',
      '请生成一个全新的版本，使用不同的课程选择和成就描述。'
    ]
    const variationIndex = (regenerateCount - 1) % variations.length
    diversityInstruction = `\n**重要：这是第 ${regenerateCount + 1} 次生成，${variations[variationIndex]}请确保生成的内容与之前完全不同。`
  }

  // 处理用户自定义指令
  let customInstruction = ''
  if (userInstruction) {
    customInstruction = `\n\n**用户特别修改指令：**\n"${userInstruction}"\n\n请务必优先遵循上述用户的修改指令，在保持原有专业性的基础上进行调整。如果用户要求更简洁，请大幅缩减字数；如果用户要求更详细，可适当增加细节。`
  }
  
  return `你是一个专业的简历顾问，请为以下教育经历生成一段简洁、具体、有说服力的补充说明。${diversityInstruction}${customInstruction}

用户教育信息：
- 学校：${school || '未填写'}
- 专业：${major || '未填写'}
- 学位：${degree || '本科'}
- GPA：${gpa || '未填写'}${gpaHighlight}
- 在校时间：${startDate || '未填写'} - ${endDate || '未填写'}

${strategy.prompt}

**严格要求：**
1. 使用 HTML 格式输出，必须使用无序列表 <ul><li> 格式，共三行
2. **格式要求**：
   - 第一行：主修课程（用"主修课程："开头，后面用顿号分隔6-8门核心课程）
   - 第二行：实践经历或项目经验（具体描述项目、使用的技术、实现的功能）
   - 第三行：额外能力或成就（如英语能力、辅修课程、竞赛获奖、证书等）
3. **内容要求**：
   - 实践经历要具体，包括项目名称、使用的技术栈、实现的功能（可以用推演数据，但要标注"推演"）
   - 内容要真实可信，基于专业领域的真实常见课程和项目类型
   - 不要编造具体的奖项名称，但可以描述奖项类型和级别
4. **字数要求**：${userInstruction && userInstruction.includes('100') ? '总字数严格控制在 100 字以内' : '总字数严格控制在 140-155 字'}，每行约 45-52 字。内容要精炼，避免冗余描述
5. **语言风格**：简洁专业，突出核心竞争力，每句话都要有价值
6. ${regenerateCount > 0 && !userInstruction ? '**必须生成与之前完全不同的内容，使用不同的课程组合、不同的项目描述、不同的能力展示。**' : ''}

**输出格式示例（计算机专业）：**
<ul>
<li>主修课程：数据结构、算法设计、操作系统、计算机网络、数据库系统、软件工程、人工智能基础</li>
<li>参与计算机专业课程设计，完成基于Java的图书管理系统开发，实现用户管理、图书检索等核心功能</li>
<li>通过大学英语四级考试，具备良好的英文文献阅读能力，可独立查阅计算机领域专业资料</li>
</ul>

**输出格式示例（金融专业）：**
<ul>
<li>主修课程：货币银行学、国际金融、投资学、公司金融、金融市场学、金融工程、计量经济学、金融风险管理</li>
<li>系统学习金融理论与实务知识，参与模拟炒股大赛获校级三等奖，累计收益率达18%（推演）</li>
<li>辅修数据分析课程，掌握Python金融数据分析工具，完成3份行业研究报告（如：2023年消费金融趋势分析）</li>
</ul>

请直接输出 HTML 内容，不要添加任何解释或 markdown 代码块标记。确保严格按照格式要求。`
}

export default function AIWriteDialog({
  open,
  onOpenChange,
  educationData,
  onApply,
}: AIWriteDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const regenerateCountRef = useRef<number>(0) // 记录重新生成次数
  
  // 计时器
  const { elapsedTime, finalTime, startTimer, stopTimer, resetTimer, formatTime, getTimeColor } = useTimer()
  
  // 打字机效果
  const { text: displayText, isTyping, appendContent, reset: resetTypewriter } = useTypewriter({
    initialDelay: 100,
    baseDelay: 10,
    punctuationDelay: 50,
    enableSmartTokenization: true,
    speedVariation: 0.1,
    maxBufferSize: 500
  })

  // 生成内容
  const handleGenerate = useCallback(async (isRegenerate: boolean = false, customInstruction?: string) => {
    setIsGenerating(true)
    setError(null)
    setGeneratedContent('')
    setIsCompleted(false)
    resetTypewriter()
    resetTimer()
    startTimer()
    
    // 如果是重新生成，增加计数
    if (isRegenerate) {
      regenerateCountRef.current += 1
    } else {
      regenerateCountRef.current = 0
      setRefineInput('') // 首次生成清空输入框
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    
    const prompt = buildPrompt(educationData, regenerateCountRef.current, customInstruction)
    console.log('[AIWriteDialog] 开始生成，使用 DeepSeek 模型')
    console.log('[AIWriteDialog] 是否重新生成:', isRegenerate)
    console.log('[AIWriteDialog] 重新生成次数:', regenerateCountRef.current)
    console.log('[AIWriteDialog] 用户指令:', customInstruction)
    console.log('[AIWriteDialog] 提示词:', prompt)
    let fullContent = ''
    
    try {
      // 使用现有的 rewriteResumeStream API
      // 这里我们构造一个简化的 resume 对象，只包含必要信息
      // 注意：需要符合 Resume 类型定义
      const mockResume = {
        name: '',
        contact: {
          phone: '',
          email: '',
          location: '',
        },
        education: [{
          title: educationData.school || '', // Resume 类型中 Education 使用 title 字段
          subtitle: educationData.major || '',
          degree: educationData.degree || '',
          date: `${educationData.startDate || ''} - ${educationData.endDate || ''}`,
          description: '', // 添加 description 字段，初始为空
          details: [], // 用于存储其他信息
        }],
        internships: [],
        projects: [],
        skills: [],
        awards: [],
      }
      
      await rewriteResumeStream(
        'deepseek',
        mockResume,
        'education[0].description',  // 使用正确的路径格式
        prompt,
        (chunk) => {
          fullContent += chunk
          console.log('[AIWriteDialog] 收到数据块:', chunk, '当前总长度:', fullContent.length)
          setGeneratedContent(fullContent)
          // 实时添加到打字机效果
          appendContent(chunk)
        },
        () => {
          console.log('[AIWriteDialog] 生成完成，总长度:', fullContent.length)
          console.log('[AIWriteDialog] 生成内容:', fullContent)
          setIsGenerating(false)
          setIsCompleted(true)
          stopTimer()
        },
        (err) => {
          console.error('[AIWriteDialog] 生成错误:', err)
          setError(err)
          setIsGenerating(false)
          stopTimer()
        },
        abortControllerRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户取消，不显示错误
        console.log('[AIWriteDialog] 用户取消生成')
      } else {
        console.error('[AIWriteDialog] 生成异常:', err)
        setError(err instanceof Error ? err.message : '生成失败')
      }
      setIsGenerating(false)
      stopTimer()
    }
  }, [educationData, resetTypewriter, resetTimer, startTimer, stopTimer])

  // 对话框打开时自动开始生成
  useEffect(() => {
    if (open && !generatedContent && !isGenerating) {
      handleGenerate(false)
    }
  }, [open, generatedContent, isGenerating, handleGenerate])

  // 关闭时清理
  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setGeneratedContent('')
    setError(null)
    setIsGenerating(false)
    setIsCompleted(false)
    resetTypewriter()
    resetTimer()
    regenerateCountRef.current = 0 // 重置重新生成计数
    onOpenChange(false)
  }

  // 采纳内容
  const handleApply = () => {
    // 使用 generatedContent（纯内容，不含 HTML 标签），而不是 displayText（含 HTML）
    console.log('[AIWriteDialog] 采纳内容:', {
      generatedContent: generatedContent?.substring(0, 50) + '...',
      contentLength: generatedContent?.length
    })
    
    if (generatedContent && generatedContent.trim()) {
      onApply(generatedContent.trim())
      handleClose()
    } else {
      console.warn('[AIWriteDialog] 没有可采纳的内容')
      setError('没有可采纳的内容，请等待生成完成或重新生成')
    }
  }

  // 重新生成/智能改写
  const handleRegenerate = (instruction?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    handleGenerate(true, instruction || refineInput)
  }

  // 处理输入框回车
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isGenerating && refineInput.trim()) {
      handleRegenerate()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* 对话框 */}
      <div className={cn(
        'relative w-full max-w-2xl mx-4',
        'bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl',
        'border border-gray-100 dark:border-neutral-800',
        'overflow-hidden'
      )}>
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-neutral-800/50 dark:to-neutral-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                  AI 帮写
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {isGenerating ? '正在生成中...' : isTyping ? '正在输出...' : isCompleted ? '生成完成' : '准备生成'}
                  </p>
                  <TimerDisplay
                    loading={isGenerating || isTyping}
                    elapsedTime={elapsedTime}
                    finalTime={finalTime}
                    formatTime={formatTime}
                    getTimeColor={getTimeColor}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* 教育信息摘要 */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <GraduationCap className="h-4 w-4" />
            <span className="font-medium">{educationData.school || '未填写学校'}</span>
            <span>·</span>
            <span>{educationData.major || '未填写专业'}</span>
            <span>·</span>
            <span>{educationData.degree || '本科'}</span>
            {educationData.gpa && (
              <>
                <span>·</span>
                <span>GPA: {educationData.gpa}</span>
              </>
            )}
          </div>
        </div>

        {/* 生成内容预览 */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 flex-1 overflow-y-auto max-h-[300px]">
            {error ? (
              <div className="flex flex-col items-center justify-center py-8 text-red-500">
                <p className="mb-4">{error}</p>
                <button
                  onClick={() => handleRegenerate()}
                  className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  重试
                </button>
              </div>
            ) : isGenerating && !generatedContent ? (
              <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>正在分析专业信息，生成补充说明...</p>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div 
                  className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700"
                  dangerouslySetInnerHTML={{ 
                    __html: displayText || generatedContent || '<p class="text-gray-400">等待生成...</p>' 
                  }}
                />
              </div>
            )}
          </div>

          {/* 智能改写区域 */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/30">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">智能改写</span>
            </div>
            
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述改写需求，如：更简洁、突出技能等..."
                  disabled={isGenerating}
                  className="w-full pl-4 pr-12 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={() => handleRegenerate()}
                  disabled={isGenerating || !refineInput.trim()}
                  className="absolute right-1 top-1 p-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {REFINE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setRefineInput(option)
                    handleRegenerate(option)
                  }}
                  disabled={isGenerating}
                  className="px-3 py-1 text-xs rounded-full bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!generatedContent || isGenerating || isTyping}
              className={cn(
                'px-6 py-2 rounded-lg flex items-center gap-2 transition-all',
                'bg-gradient-to-r from-purple-500 to-pink-500',
                'hover:from-purple-600 hover:to-pink-600',
                'text-white font-medium shadow-lg',
                (!generatedContent || isGenerating || isTyping) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <CheckCircle className="h-4 w-4" />
              采纳
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

