import { AIImportModal } from '@/pages/Workspace/v2/shared/AIImportModal'
import AIWriteDialog from '@/pages/Workspace/v2/shared/AIWriteDialog'
import type { Education as WorkspaceEducation } from '@/pages/Workspace/v2/types'
import { motion } from 'framer-motion'
import { ChevronDown, Plus, Sparkles, Upload } from 'lucide-react'
import React, { useState } from 'react'
import { MonthPicker } from './MonthPicker'

export interface Education {
  id: string
  school: string
  major: string
  degree: string
  startDate: string
  endDate: string
  description: string
}

interface EducationFormProps {
  data?: Education
  onChange: (data: Education) => void
  onSubmit: () => void
}

const DEGREES = ['专科', '本科', '硕士', '博士', '其他']

export const EducationForm: React.FC<EducationFormProps> = ({ 
  data, 
  onChange,
  onSubmit 
}) => {
  const [formData, setFormData] = useState<Education>(data || {
    id: Date.now().toString(),
    school: '',
    major: '',
    degree: '',
    startDate: '',
    endDate: '',
    description: ''
  })
  
  const [isDegreeOpen, setIsDegreeOpen] = useState(false)
  const [showAIImport, setShowAIImport] = useState(false)
  const [showAIWrite, setShowAIWrite] = useState(false)

  // Placeholder 示例值映射
  const placeholderExamples: Record<string, string> = {
    school: '清华大学',
    major: '计算机科学与技术',
    description: '主修课程包括数据结构、算法设计、操作系统等。曾获得校级优秀学生奖学金，参与多个项目开发。'
  }

  const handleChange = (field: keyof Education, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    onChange(newData)
  }

  // 处理 Tab 键一键补全
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof Education) => {
    if (e.key === 'Tab' && !e.shiftKey && !formData[field]) {
      e.preventDefault()
      const exampleValue = placeholderExamples[field]
      if (exampleValue) {
        handleChange(field, exampleValue)
      }
    }
  }

  // AI 导入完成后的处理
  const handleAIImportComplete = (data: any) => {
    // 如果导入的是教育经历数据，则更新表单
    if (data.education) {
      const edu = data.education[0] || data.education
      handleChange('school', edu.school || edu.schoolName || '')
      handleChange('major', edu.major || edu.majorName || '')
      handleChange('degree', edu.degree || edu.degreeType || '')
      handleChange('startDate', edu.startDate || '')
      handleChange('endDate', edu.endDate || '')
      handleChange('description', edu.description || edu.detail || '')
    }
    setShowAIImport(false)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 w-full max-w-2xl"
    >
      {/* 头部引导 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900">分享你的求学经历</h3>
          <p className="text-sm text-gray-500">每一段求学路都是向上生长的见证</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* 学校名称 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            学校名称 <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.school}
            onChange={(e) => handleChange('school', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'school')}
            placeholder="例如：清华大学"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50"
          />
        </div>

        {/* 专业 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            专业 <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
          </label>
          <input
            type="text"
            value={formData.major}
            onChange={(e) => handleChange('major', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'major')}
            placeholder="例如：计算机科学与技术"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50"
          />
        </div>

        {/* 学历选择 */}
        <div className="space-y-1.5 relative">
          <label className="text-sm font-medium text-gray-700">
            学历 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDegreeOpen(!isDegreeOpen)}
              className="w-full px-4 py-2.5 text-left rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            >
              <span className={formData.degree ? 'text-gray-900' : 'text-gray-400'}>
                {formData.degree || '请选择...'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDegreeOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDegreeOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20 py-1">
                {DEGREES.map((degree) => (
                  <button
                    key={degree}
                    type="button"
                    onClick={() => {
                      handleChange('degree', degree)
                      setIsDegreeOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 text-gray-700 hover:text-blue-600 flex items-center justify-between group"
                  >
                    {degree}
                    {formData.degree === degree && <Plus className="w-4 h-4 text-blue-600 rotate-45" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 在校时间 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            在校时间 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <MonthPicker
                value={formData.startDate}
                onChange={(value) => handleChange('startDate', value)}
                placeholder="开始时间"
              />
            </div>
            <span className="text-gray-400 font-medium">-</span>
            <div className="flex-1">
              <MonthPicker
                value={formData.endDate}
                onChange={(value) => handleChange('endDate', value)}
                placeholder="结束时间"
              />
            </div>
          </div>
        </div>

        {/* 在校经历 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              在校经历
              <span className="ml-2 text-xs text-gray-400 font-normal">(按 Tab 快速填充示例)</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAIImport(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-blue-700 hover:from-blue-100 hover:to-indigo-100 transition-all shadow-sm group"
              >
                <Upload className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">AI 导入</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAIWrite(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 text-purple-700 hover:from-purple-100 hover:to-pink-100 transition-all shadow-sm group"
              >
                <Sparkles className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">AI 帮写</span>
              </button>
            </div>
          </div>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            onKeyDown={(e) => handleTabKeyDown(e, 'description')}
            placeholder="请描述你的在校经历、主修课程、获得的奖项等..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none min-h-[120px] resize-none"
          />
        </div>

        {/* 提交按钮 */}
        <button
          onClick={onSubmit}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
        >
          提交
        </button>
      </div>

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={showAIImport}
        sectionType="education"
        sectionTitle="教育经历"
        onClose={() => setShowAIImport(false)}
        onSave={handleAIImportComplete}
      />

      {/* AI 帮写对话框 */}
      <AIWriteDialog
        open={showAIWrite}
        onOpenChange={setShowAIWrite}
        educationData={formData as unknown as WorkspaceEducation}
        onApply={(content) => {
          handleChange('description', content)
          setShowAIWrite(false)
        }}
      />
    </motion.div>
  )
}

