/**
 * 报告创建页面
 * 用户输入 topic，创建报告并跳转到编辑页面
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createReport } from '@/services/api'
import { useReportStore } from '@/stores/reportStore'

export default function ReportCreate() {
  const [topic, setTopic] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!topic.trim()) {
      setError('请输入报告主题')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // 构建 prompt，引导 agent 使用工具来生成报告
      // 让 agent 知道这是一个报告生成任务，应该使用工具（如 browser_use 的 web_search）来获取信息
      const prompt = `请生成一份关于"${topic.trim()}"的详细研究报告。

任务要求：
1. 首先使用 browser_use 工具的 web_search 功能搜索相关信息，获取最新的数据、观点和案例
2. 分析搜索到的信息，整理关键要点和趋势
3. 生成一份结构完整、内容详实的 Markdown 格式报告，包括：
   - 概述/引言：介绍主题背景和重要性
   - 主要内容和分析：深入分析各个关键方面
   - 关键数据和案例：提供具体的数据支撑和实际案例
   - 结论和建议：总结要点并提出建议

重要提示：
- 必须使用 browser_use 工具的 web_search 功能来获取最新信息
- 报告应该是结构化的 Markdown 格式，包含标题、段落、列表等
- 内容要详实、有深度，不能只是简单的概述
- 使用获取到的真实数据和案例来支撑观点

现在开始执行：先搜索相关信息，然后生成报告。`
      
      // 保存 pendingPrompt 到 store
      useReportStore.setPendingPrompt(prompt)

      // 创建报告
      const result = await createReport(topic.trim())
      
      // 跳转到编辑页面
      navigate(`/reports/${result.reportId}/edit`)
    } catch (err) {
      console.error('创建报告失败:', err)
      setError(err instanceof Error ? err.message : '创建报告失败，请重试')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">创建新报告</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
              报告主题
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="输入你想要生成报告的主题，例如：写一份关于 AI 发展趋势的研究报告"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              disabled={isSubmitting}
            />
            <p className="mt-2 text-sm text-gray-500">
              描述你想要生成的报告内容，AI 将根据你的描述自动生成完整的报告。
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !topic.trim()}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '创建中...' : '创建报告'}
          </button>
        </form>
      </div>
    </div>
  )
}
