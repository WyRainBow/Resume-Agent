import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Code2, Send, Undo2, Redo2, Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, Link2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthPicker } from './MonthPicker'

export interface Project {
  id: string
  name: string
  role: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
}

interface ProjectFormProps {
  onSkip: () => void
  onSubmit: (data: Project) => void
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ onSkip, onSubmit }) => {
  const [formData, setFormData] = useState<Project>({
    id: Date.now().toString(),
    name: '',
    role: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: ''
  })

  // Placeholder 示例值映射
  const placeholderExamples: Record<string, string> = {
    name: '校园二手交易平台',
    role: '技术负责人',
    description: '【项目背景+目标】：为解决校内学生二手物品交易信息不对称问题，开发一个高性能、易用的交易平台。\n【技术架构+负责模块】：使用 React + Node.js + MySQL 技术栈。本人负责后端架构设计、数据库建模及核心交易流程的实现。\n【解决难点+创新点】：引入了 WebSocket 实现即时聊天功能；使用 Redis 缓存热门商品，访问速度提升 40%。\n【项目成果+数据】：项目上线后覆盖全校 80% 的活跃用户，月交易额突破 5 万元。'
  }

  const handleChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 处理 Tab 键一键补全
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof Project) => {
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
      formData.name?.trim() &&
      formData.role?.trim() &&
      formData.startDate?.trim() &&
      (formData.isCurrent || formData.endDate?.trim())
    )
  }

  const handleSubmit = (e?: React.MouseEvent) => {
    e?.preventDefault()
    if (!isFormValid()) return
    onSubmit(formData)
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
          <Code2 className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">展示你的项目经历</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">课程设计、毕业设计、个人项目、竞赛作品... 每一个项目都是你技术能力的最佳证明</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 项目名称 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            项目名称 <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'name')}
            placeholder="例如：校园二手交易平台"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 项目角色 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            项目角色 <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'role')}
            placeholder="例如：技术负责人"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 项目时间 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">项目时间 <span className="text-red-500">*</span></label>
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

        {/* 项目描述 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            项目描述
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
              placeholder="写作公式：【项目背景+目标】→ 【技术架构+负责模块】→ 【解决难点+创新点】→ 【项目成果+数据】&#10;&#10;点击右上角「AI 帮写」，让 AI 帮你生成专业的描述"
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
            onClick={handleSubmit}
            disabled={!isFormValid()}
            className={cn(
              "flex-[2] py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg",
              isFormValid()
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
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

