import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from '../ResumeDashboard/components/Icons'
import { Button } from '../ResumeDashboard/components/ui/button'
import { TemplateCard } from '../ResumeDashboard/components/TemplateCard'
import { getAllTemplates, getTemplateById } from '@/data/templates'
import { saveResume } from '@/services/resumeStorage'
import type { ResumeData } from '../Workspace/v2/types'

const TemplateMarket = () => {
  const navigate = useNavigate()
  const templates = getAllTemplates()

  const handleSelectTemplate = (templateId: string) => {
    const template = getTemplateById(templateId)
    if (!template) {
      console.error(`Template not found: ${templateId}`)
      return
    }

    // 基于模板创建新简历
    const newResume: ResumeData = {
      ...template,
      basic: { ...template.basic, name: '未命名简历' },
      templateId: templateId
    }

    // 保存到本地存储（saveResume 会自动设置当前简历 ID）
    saveResume(newResume)
    
    // 跳转到编辑页面
    navigate('/workspace')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 space-y-6 max-w-[1600px] mx-auto relative z-10"
      >
        {/* 顶部标题栏 */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                简历市场
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                选择一个模板开始创建你的简历
              </p>
            </div>
          </div>
        </motion.div>

        {/* 模板列表 */}
        <motion.div
          className="w-full p-3 sm:p-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                暂无可用模板
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleSelectTemplate}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

export default TemplateMarket

