import { getAllTemplates, getTemplateById, getTemplateMetadata } from '@/data/templates'
import { saveResume } from '@/services/resumeStorage'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '../ResumeDashboard/components/Icons'
import { TemplateCard } from '../ResumeDashboard/components/TemplateCard'
import { Button } from '../ResumeDashboard/components/ui/button'
import type { ResumeData } from '../Workspace/v2/types'

const TemplateMarket = () => {
  const navigate = useNavigate()
  const templates = getAllTemplates()

  const handleSelectTemplate = (templateId: string) => {
    const template = getTemplateById(templateId)
    const templateMetadata = getTemplateMetadata(templateId)
    
    if (!template) {
      console.error(`Template not found: ${templateId}`)
      return
    }

    // 获取模板类型
    const templateType = templateMetadata?.type || 'latex'

    // 🎯 生成带有模板类型标识的 ID
    // 格式：resume_{templateType}_{timestamp}_{random}
    const newId = `resume_${templateType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 基于模板创建新简历，确保 templateType 不被覆盖
    const newResume: ResumeData = {
      ...template,
      id: newId,  // 使用带有模板类型的 ID
      basic: { ...template.basic, name: '未命名简历' },
      templateId: templateId,
      templateType: templateType
    }

    // 保存到本地存储，使用新的 ID
    saveResume(newResume, newId)
    
    // 🎯 根据模板类型跳转到对应的工作区（附带 ID）
    if (templateType === 'html') {
      navigate(`/workspace/html/${newId}`)
    } else {
      navigate(`/workspace/latex/${newId}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 space-y-8 max-w-[1400px] mx-auto relative z-10 py-12 px-4 sm:px-8"
      >
        {/* 顶部标题栏 */}
        <motion.div
          className="flex items-center justify-between"
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                简历模板市场
              </h1>
              <p className="text-base text-gray-600 dark:text-gray-400 mt-2">
                选择适合你的模板开始创建简历
              </p>
            </div>
          </div>
        </motion.div>

        {/* 模板列表 */}
        <motion.div
          className="w-full"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {templates.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                暂无可用模板
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* LaTeX 模板列 */}
              <div>
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      LaTeX 模板
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
                      高质量
                    </span>
                  </div>
                  <p className="text-base text-gray-600 dark:text-gray-400 ml-0">
                    专业级简历模板、生成高质量 PDF、适合投递求职简历
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {templates
                    .filter(t => t.type === 'latex')
                    .map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={handleSelectTemplate}
                      />
                    ))}
                </div>
              </div>

              {/* HTML 模板列 */}
              <div>
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-amber-500 to-orange-400 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      HTML 模板
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium">
                      实时编辑
                    </span>
                  </div>
                  <p className="text-base text-gray-600 dark:text-gray-400 ml-0">
                    实时预览模板、支持快速迭代、编辑时即刻看到效果
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {templates
                    .filter(t => t.type === 'html')
                    .map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={handleSelectTemplate}
                      />
                    ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

export default TemplateMarket

