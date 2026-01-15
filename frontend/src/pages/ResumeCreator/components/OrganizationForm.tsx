import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Send, Undo2, Redo2, Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, Link2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthPicker } from './MonthPicker'

export interface Organization {
  id: string
  name: string
  role: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
}

interface OrganizationFormProps {
  onSkip: () => void
  onSubmit: (data: Organization) => void
}

export const OrganizationForm: React.FC<OrganizationFormProps> = ({ onSkip, onSubmit }) => {
  const [formData, setFormData] = useState<Organization>({
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
    name: '计算机协会',
    role: '副会长',
    description: '负责协会日常运营与活动策划。成功组织了多场技术沙龙和编程比赛，累计参与人数超过500人。提升了协会在校内的影响力，并与多家企业建立了合作关系。'
  }

  const handleChange = (field: keyof Organization, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 处理 Tab 键一键补全
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof Organization) => {
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
          <ClipboardList className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">分享你的社团组织经历</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">学生会、社团活动、志愿服务... 这些经历展现了你的领导力、团队协作和社会责任感</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 社团/组织名称 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            社团/组织名称
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'name')}
            placeholder="例如：计算机协会"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 职务/角色 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            职务/角色
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'role')}
            placeholder="例如：副会长"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 起止时间 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">起止时间</label>
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

        {/* 经历描述 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            经历描述
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
              placeholder="写作公式：【担任职务+职责】→【组织活动+参与人数】→【取得成果+影响力】&#10;&#10;点击右上角「AI 帮写」，让 AI 帮你生成专业的描述"
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

