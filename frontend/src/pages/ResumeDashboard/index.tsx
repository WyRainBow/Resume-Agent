import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from './components/Header'
import { CreateCard } from './components/CreateCard'
import { ResumeCard } from './components/ResumeCard'
import { useDashboardLogic } from './hooks/useDashboardLogic'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { AlertCircle, Settings } from './components/Icons'
import { Button } from './components/ui/button'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { useAuth } from '@/contexts/AuthContext'
import AIImportModal from '@/pages/Workspace/v2/shared/AIImportModal'
import { saveResume, setCurrentResumeId } from '@/services/resumeStorage'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { matchCompanyLogo } from '@/pages/Workspace/v2/constants/companyLogos'

const ResumeDashboard = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, user, logout, openModal } = useAuth()
  const {
    resumes,
    createResume,
    deleteResume,
    editResume,
    optimizeResume,
    importJson,
    // 多选模式相关
    isMultiSelectMode,
    toggleMultiSelectMode,
    exitMultiSelectMode,
    selectedIds,
    toggleSelect,
    batchDelete,
    clearSelection,
    selectAll,
    // 备注/别名
    updateAlias,
    // 置顶
    togglePin,
    // 刷新列表
    loadResumes
  } = useDashboardLogic()

  // 登录时数据保存到数据库，未登录时保存到本地存储
  const hasConfiguredFolder = true // 总是有存储配置（本地或云端）

  // AI 智能导入相关状态
  const [aiModalOpen, setAiModalOpen] = useState(false)

  // 打开 AI 导入弹窗
  const handleOpenAIImport = useCallback(() => {
    setAiModalOpen(true)
  }, [])

  // 从 /create-new 带 ?openAIImport=1 进入时自动打开 AI 导入弹窗
  useEffect(() => {
    if (searchParams.get('openAIImport') === '1') {
      setAiModalOpen(true)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('openAIImport')
        return next
      }, { replace: true })
    }
  }, [])

  // AI 解析完成后，创建新简历并跳转到工作区
  const handleAISave = useCallback(async (data: any) => {
    // 将 AI 解析的数据转换为 ResumeData 格式
    const newResumeData: ResumeData = {
      basic: {
        name: data.name || '',
        title: data.objective || '',
        email: data.contact?.email || '',
        phone: data.contact?.phone || '',
        location: data.contact?.location || '',
      },
      education: data.education?.map((e: any, i: number) => {
        let startDate = ''
        let endDate = ''
        if (e.date) {
          const dateStr = e.date.trim()
          const dateMatch = dateStr.match(/^(.+?)\s*[-–~]\s*(.+)$/)
          if (dateMatch) {
            startDate = dateMatch[1].trim()
            endDate = dateMatch[2].trim()
          } else {
            startDate = dateStr
          }
        }
        return {
          id: `edu_${Date.now()}_${i}`,
          school: e.title || '',
          major: e.subtitle || '',
          degree: e.degree || '',
          startDate,
          endDate,
          description: e.details?.join('\n') || '',
          visible: true,
        }
      }) || [],
      experience: data.internships?.map((e: any, i: number) => {
        const raw = (e.title || '').trim()
        const company = !raw ? '' : raw.startsWith('**') && raw.endsWith('**') ? raw : `**${raw}**`
        const logoKey = matchCompanyLogo(e.title || '')
        return {
          id: `exp_${Date.now()}_${i}`,
          company,
          position: e.subtitle || '',
          date: e.date || '',
          details: formatHighlightsToHtml(e.highlights),
          visible: true,
          ...(logoKey ? { companyLogo: logoKey } : {}),
        }
      }) || [],
      projects: data.projects?.map((p: any, i: number) => {
        let description = p.description || ''
        if (p.highlights && p.highlights.length > 0) {
          const highlightsList = formatHighlightsToHtml(p.highlights)
          description = description ? description + highlightsList : highlightsList
        }
        description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        return {
          id: `proj_${Date.now()}_${i}`,
          name: p.title || '',
          role: p.subtitle || '',
          date: p.date || '',
          description: description,
          visible: true,
        }
      }) || [],
      openSource: data.openSource?.map((o: any, i: number) => ({
        id: `os_${Date.now()}_${i}`,
        name: o.title || o.name || '',
        role: o.subtitle || o.role || '',
        repo: o.repoUrl || o.repo || '',
        date: o.date || '',
        description: o.items?.length > 0 ? formatHighlightsToHtml(o.items) : o.description || '',
        visible: true,
      })) || [],
      awards: data.awards?.map((a: any, i: number) => ({
        id: `award_${Date.now()}_${i}`,
        title: a.title || '',
        issuer: a.issuer || '',
        date: a.date || '',
        description: a.description || '',
        visible: true,
      })) || [],
      skillContent: (() => {
        if (data.skills && data.skills.length > 0) {
          const allItems: string[] = []
          for (const s of data.skills) {
            const category = s.category?.trim() || ''
            const details = s.details?.trim() || ''
            if (!details && !category) continue
            if (category) {
              allItems.push(`<li><p><strong>${category}</strong>：${details}</p></li>`)
            } else if (details) {
              const match = details.match(/^([^：:]{1,15})[：:](.+)$/)
              if (match) {
                allItems.push(`<li><p><strong>${match[1].trim()}</strong>：${match[2].trim()}</p></li>`)
              } else {
                allItems.push(`<li><p>${details}</p></li>`)
              }
            }
          }
          return allItems.length > 0 ? `<ul class="custom-list">${allItems.join('')}</ul>` : ''
        }
        return ''
      })(),
      templateType: 'latex',
    }

    // 保存为新简历
    const resumeId = `resume_latex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const saved = await saveResume(newResumeData, resumeId)
    setCurrentResumeId(saved.id)

    // 关闭弹窗
    setAiModalOpen(false)

    // 刷新列表
    await loadResumes()

    // 跳转到工作区编辑（LaTeX 模板）
    navigate(`/workspace/latex/${saved.id}`)
  }, [navigate, loadResumes])

  // 格式化 highlights 为 HTML
  function formatHighlightsToHtml(highlights: any): string {
    if (!highlights) return ''
    const items = Array.isArray(highlights)
      ? highlights
      : typeof highlights === 'string'
        ? highlights.split('\n').filter((line: string) => line.trim())
        : []
    if (!items.length) return ''
    const highlightsHtml = items.map((h: string) => {
      const formatted = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      return `<li>${formatted}</li>`
    }).join('')
    return `<ul class="custom-list">${highlightsHtml}</ul>`
  }

  return (
    <WorkspaceLayout>
      <div className="h-full overflow-y-auto bg-[#f8fafc] dark:bg-[#020617] relative transition-colors duration-500">
        {/* 装饰性背景元素 */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 dark:bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 dark:bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 space-y-10 max-w-[1600px] mx-auto relative z-10 p-6 sm:p-10"
        >
          <motion.div
            className="flex w-full items-center justify-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {hasConfiguredFolder && (
              <Alert className="mb-2 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md max-w-2xl rounded-2xl py-3">
                <AlertDescription className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      {isAuthenticated 
                        ? '数据已同步至云端' 
                        : '数据保存在本地'}
                    </span>
                  </div>
                  {!isAuthenticated && (
                    <button
                      className="text-sm font-black text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => openModal('login')}
                    >
                      立即登录同步
                    </button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </motion.div>

          {/* 顶部标题栏 - 传入多选模式相关 props */}
          <Header
            onImport={importJson}
            onCreate={createResume}
            onAIImport={handleOpenAIImport}
            selectedCount={selectedIds.size}
            onBatchDelete={batchDelete}
            totalCount={resumes.length}
            isMultiSelectMode={isMultiSelectMode}
            onToggleMultiSelectMode={toggleMultiSelectMode}
            onExitMultiSelectMode={exitMultiSelectMode}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
          />

          <motion.div
            className="flex-1 w-full p-3 sm:p-6 pb-16"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              <CreateCard onClick={createResume} />

              <AnimatePresence>
                {resumes.map((resume) => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
                    onEdit={editResume}
                    onDelete={deleteResume}
                    onOptimize={optimizeResume}
                    // 多选模式相关
                    isMultiSelectMode={isMultiSelectMode}
                    isSelected={selectedIds.has(resume.id)}
                    onSelectChange={toggleSelect}
                    // 备注/别名
                    onAliasChange={updateAlias}
                    // 置顶
                    onTogglePin={togglePin}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </div>
      {/* AI 智能导入弹窗 */}
      <AIImportModal
        isOpen={aiModalOpen}
        sectionType="all"
        sectionTitle="AI 智能导入"
        onClose={() => setAiModalOpen(false)}
        onSave={handleAISave}
      />
    </WorkspaceLayout>
  )
}

export default ResumeDashboard