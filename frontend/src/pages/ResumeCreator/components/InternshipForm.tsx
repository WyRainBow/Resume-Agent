import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Send, Undo2, Redo2, Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, Link2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthPicker } from './MonthPicker'

export interface Internship {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
}

interface InternshipFormProps {
  onSkip: () => void
  onSubmit: (data: Internship) => void
}

export const InternshipForm: React.FC<InternshipFormProps> = ({ onSkip, onSubmit }) => {
  const [formData, setFormData] = useState<Internship>({
    id: Date.now().toString(),
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: ''
  })

  // Placeholder 示例值映射
  const placeholderExamples: Record<string, string> = {
    company: '百度',
    position: '前端开发实习生',
    description: '负责公司前端项目的开发与维护，使用 React 和 TypeScript 技术栈。参与需求分析和技术方案设计，优化页面性能，提升用户体验。完成多个核心功能模块开发，代码质量优秀，获得团队认可。'
  }

  const handleChange = (field: keyof Internship, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 处理 Tab 键一键补全
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof Internship) => {
    if (e.key === 'Tab' && !e.shiftKey && !formData[field]) {
      e.preventDefault()
      const exampleValue = placeholderExamples[field]
      if (exampleValue) {
        handleChange(field, exampleValue)
      }
    }
  }

  const isFormValid = () => {
    return !!(
      formData.company?.trim() &&
      formData.position?.trim() &&
      formData.startDate?.trim() &&
      (formData.isCurrent || formData.endDate?.trim())
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-2xl"
    >
      {/* 头部引导 */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Briefcase className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">分享你的实习/工作经历</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">每一次实践都是向上生长的机会，让我们一起展示你的精彩经历</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 公司名称 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            公司名称
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.company}
            onChange={(e) => handleChange('company', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'company')}
            placeholder="例如：百度"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 职位名称 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            职位名称
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.position}
            onChange={(e) => handleChange('position', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'position')}
            placeholder="例如：前端开发实习生"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 实习时间 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">实习时间</label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">开始:</span>
              <div className="w-40">
                <MonthPicker
                  value={formData.startDate}
                  onChange={(val) => handleChange('startDate', val)}
                  placeholder="选择时间"
                />
              </div>
            </div>
            <span className="text-gray-400">-</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">结束:</span>
              <div className="w-40">
                <MonthPicker
                  value={formData.endDate}
                  onChange={(val) => handleChange('endDate', val)}
                  placeholder="选择时间"
                  disabled={formData.isCurrent}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={formData.isCurrent}
                onChange={(e) => handleChange('isCurrent', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">至今</span>
            </label>
          </div>
        </div>

        {/* 工作描述 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            工作描述
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center gap-1">
                <button className="p-1.5 hover:bg-white rounded text-gray-400"><Undo2 className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-400"><Redo2 className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><Bold className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><Italic className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><List className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><ListOrdered className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><AlignLeft className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><AlignCenter className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-white rounded text-gray-600"><Link2 className="w-4 h-4" /></button>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors">
                <Sparkles className="w-3 h-3" />
                AI 帮写
              </button>
            </div>
            {/* 文本域 */}
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              onKeyDown={(e) => handleTabKeyDown(e, 'description')}
              placeholder="写作公式（STAR法则）：【背景情况】→【工作任务】→【具体行动+技术方案】→【成果+数据】&#10;&#10;点击右上角「AI 帮写」，让 AI 帮你生成专业的描述"
              className="w-full h-48 px-4 py-3 bg-white outline-none resize-none text-sm text-gray-600 placeholder:text-gray-300 leading-relaxed"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={onSkip}
            className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold text-[16px] transition-all"
          >
            暂时跳过
          </button>
          <button
            onClick={() => isFormValid() && onSubmit(formData)}
            disabled={!isFormValid()}
            className={cn(
              "flex-[2] py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg",
              isFormValid()
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4 transform rotate-45" />
            提交
          </button>
        </div>
      </div>
    </motion.div>
  )
}

