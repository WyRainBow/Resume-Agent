import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BasicInfo {
  name: string
  phone: string
  email: string
}

interface BasicInfoFormProps {
  onSkip: () => void
  onSubmit: (data: BasicInfo) => void
}

export const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ onSkip, onSubmit }) => {
  const [formData, setFormData] = useState<BasicInfo>({
    name: '',
    phone: '',
    email: ''
  })

  // Placeholder 示例值映射
  const placeholderExamples: Record<string, string> = {
    name: '张三',
    phone: '13800138000',
    email: 'your.email@example.com'
  }

  const handleChange = (field: keyof BasicInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 处理 Tab 键一键补全
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: keyof BasicInfo) => {
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
      formData.phone?.trim() &&
      formData.email?.trim()
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
      className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-xl"
    >
      {/* 头部引导 */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Phone className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">完善你的联系方式</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">最后一步！让我们确保 HR 能够轻松联系到优秀的你</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 姓名 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            姓名
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'name')}
            placeholder="请输入姓名"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 手机号码 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            手机号码
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'phone')}
            placeholder="例如：13800138000"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        {/* 邮箱地址 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            邮箱地址
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'email')}
            placeholder="例如：your.email@example.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
          />
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

