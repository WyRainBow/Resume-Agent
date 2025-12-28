/**
 * AI 帮写对话框组件
 * 根据教育经历信息，使用 AI 生成补充说明
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Sparkles, RefreshCw, CheckCircle, X, GraduationCap } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { rewriteResumeStream } from '../../../../services/api'
import { useTypewriter } from '../../../../hooks/useTypewriter'
import { useTimer, TimerDisplay } from '../../../../hooks/useTimer'
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
      prompt: `请侧重描述研究方向和学术成果。可以包括：
        - 研究领域和方向
        - 主要研究课题
        - 学术发表（如有）
        - 科研项目参与`
    }
  }
  
  if (lowerDegree.includes('硕士') || lowerDegree.includes('master') || lowerDegree.includes('研究生')) {
    return {
      focus: '研究方向、项目经验、专业深度',
      prompt: `请侧重描述专业深度和研究能力。可以包括：
        - 研究方向或专业领域
        - 核心研究生课程
        - 项目或研究经历
        - 学术成果或论文`
    }
  }
  
  if (lowerDegree.includes('专科') || lowerDegree.includes('大专')) {
    return {
      focus: '实践技能、职业资格、实训经历',
      prompt: `请侧重描述实践技能和职业能力。可以包括：
        - 专业技能课程
        - 实训或实习经历
        - 职业资格证书
        - 动手能力和项目经验`
    }
  }
  
  // 默认本科
  return {
    focus: '核心课程、GPA、综合能力',
    prompt: `请侧重描述专业基础和综合能力。可以包括：
      - 3-5门核心专业课程
      - 学习成绩亮点（如GPA较高）
      - 竞赛、项目或社团经历
      - 奖学金或荣誉`
  }
}

// 构造 AI 提示词
const buildPrompt = (data: Partial<Education>, regenerateCount: number = 0) => {
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
  if (regenerateCount > 0) {
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
  
  return `你是一个专业的简历顾问，请为以下教育经历生成一段简洁、有亮点的补充说明。${diversityInstruction}

用户教育信息：
- 学校：${school || '未填写'}
- 专业：${major || '未填写'}
- 学位：${degree || '本科'}
- GPA：${gpa || '未填写'}${gpaHighlight}
- 在校时间：${startDate || '未填写'} - ${endDate || '未填写'}

${strategy.prompt}

**严格要求：**
1. 使用 HTML 格式输出
2. 主修课程列表使用 <ul><li> 标签，每门课程一个 <li>
3. 如果有特别优秀的课程成绩，用 <strong> 标签加粗
4. 总字数控制在 80-120 字
5. 内容要基于专业领域的真实常见课程，不要编造具体奖项名称或分数
6. 语言简洁专业，突出核心竞争力
7. ${regenerateCount > 0 ? '**必须生成与之前完全不同的内容，使用不同的课程、不同的描述角度和不同的表达方式。**' : ''}

**输出格式示例：**
<p>主修课程：</p>
<ul>
<li><strong>课程A</strong></li>
<li>课程B</li>
<li>课程C</li>
</ul>
<p>在校期间[描述1-2个亮点]。</p>

请直接输出 HTML 内容，不要添加任何解释或 markdown 代码块标记。`
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
  const handleGenerate = useCallback(async (isRegenerate: boolean = false) => {
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
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    
    const prompt = buildPrompt(educationData, regenerateCountRef.current)
    console.log('[AIWriteDialog] 开始生成，使用 DeepSeek 模型')
    console.log('[AIWriteDialog] 是否重新生成:', isRegenerate)
    console.log('[AIWriteDialog] 重新生成次数:', regenerateCountRef.current)
    console.log('[AIWriteDialog] 教育数据:', educationData)
    console.log('[AIWriteDialog] 提示词:', prompt)
    let fullContent = ''
    
    try {
      // 使用现有的 rewriteResumeStream API
      // 这里我们构造一个简化的 resume 对象，只包含必要信息
      // 注意：education 数组中的对象需要有 description 字段
      const mockResume = {
        name: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        summary: '',
        education: [{
          school: educationData.school || '',
          major: educationData.major || '',
          degree: educationData.degree || '',
          date: `${educationData.startDate || ''} - ${educationData.endDate || ''}`,
          gpa: educationData.gpa || '',
          description: '', // 必须有这个字段，后端会根据它的类型决定输出格式
        }],
        experience: [],
        internships: [],
        projects: [],
        skills: [],
        awards: [],
        publications: [],
        certifications: [],
        languages: [],
        interests: [],
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
    onApply(generatedContent)
    handleClose()
  }

  // 重新生成
  const handleRegenerate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    handleGenerate(true) // 标记为重新生成
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
        <div className="px-6 py-4 min-h-[200px] max-h-[400px] overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-500">
              <p className="mb-4">{error}</p>
              <button
                onClick={handleRegenerate}
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

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className={cn(
                'px-4 py-2 rounded-lg flex items-center gap-2 transition-all',
                'border border-gray-200 dark:border-neutral-700',
                'hover:bg-gray-100 dark:hover:bg-neutral-700',
                'text-neutral-600 dark:text-neutral-300',
                isGenerating && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
              重新生成
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleApply}
                disabled={!generatedContent || isGenerating}
                className={cn(
                  'px-6 py-2 rounded-lg flex items-center gap-2 transition-all',
                  'bg-gradient-to-r from-purple-500 to-pink-500',
                  'hover:from-purple-600 hover:to-pink-600',
                  'text-white font-medium shadow-lg',
                  (!generatedContent || isGenerating) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <CheckCircle className="h-4 w-4" />
                采纳
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

