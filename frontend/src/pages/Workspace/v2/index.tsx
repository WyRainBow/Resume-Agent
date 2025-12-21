/**
 * Workspace v2 - 三列布局主入口
 * 
 * 目录结构:
 * v2/
 * ├── index.tsx              # 主入口（当前文件）
 * ├── constants.ts           # 常量和初始数据
 * ├── types/                 # 类型定义
 * ├── hooks/                 # 自定义 Hooks
 * │   ├── useResumeData.ts   # 简历数据管理
 * │   ├── usePDFOperations.ts # PDF 操作
 * │   └── useAIImport.ts     # AI 导入
 * ├── utils/                 # 工具函数
 * │   └── convertToBackend.ts # 数据转换
 * ├── components/            # 页面级组件
 * │   ├── Header.tsx         # 顶部导航
 * │   └── BackgroundDecoration.tsx # 背景装饰
 * ├── SidePanel/             # 第一列：布局管理
 * ├── EditPanel/             # 第二列：可视化编辑
 * ├── PreviewPanel/          # 第三列：PDF 预览
 * ├── ResizableLayout.tsx    # 可拖拽布局
 * └── shared/                # 共享组件
 *     ├── AIImportModal.tsx  # AI 导入弹窗
 *     └── RichEditor/        # 富文本编辑器
 */
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../../lib/utils'

// Hooks
import { useResumeData, usePDFOperations, useAIImport } from './hooks'

// 组件
import { Header, BackgroundDecoration } from './components'
import ResizableLayout from './ResizableLayout'
import AIImportModal from './shared/AIImportModal'
import APISettingsDialog from './shared/APISettingsDialog'

export default function WorkspaceV2() {
  // 简历数据管理
  const {
    resumeData,
    setResumeData,
    activeSection,
    setActiveSection,
    currentResumeId,
    setCurrentId,
    updateBasicInfo,
    updateProject,
    deleteProject,
    reorderProjects,
    updateExperience,
    deleteExperience,
    reorderExperiences,
    updateEducation,
    deleteEducation,
    reorderEducations,
    updateOpenSource,
    deleteOpenSource,
    reorderOpenSources,
    updateAward,
    deleteAward,
    reorderAwards,
    updateSkillContent,
    updateMenuSections,
    reorderSections,
    toggleSectionVisibility,
    updateGlobalSettings,
    addCustomSection,
  } = useResumeData()

  // PDF 操作
  const {
    pdfBlob,
    loading,
    progress,
    saveSuccess,
    handleRender,
    handleDownload,
    handleSaveToDashboard,
  } = usePDFOperations({ resumeData, currentResumeId, setCurrentId })

  // AI 导入
  const {
    aiModalOpen,
    aiModalSection,
    aiModalTitle,
    setAiModalOpen,
    handleAIImport,
    handleGlobalAIImport,
    handleAISave,
  } = useAIImport({ setResumeData })

  // API 设置弹窗
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false)

  // 文件输入引用（用于导入 JSON）
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 导出 JSON
  const handleExportJSON = () => {
    try {
      const jsonString = JSON.stringify(resumeData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resume-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出 JSON 失败:', error)
      alert('导出失败，请重试')
    }
  }

  // 导入 JSON
  const handleImportJSON = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const importedData = JSON.parse(text)
        
        // 验证数据格式（基本检查）
        if (typeof importedData === 'object' && importedData !== null) {
          setResumeData(importedData)
          alert('导入成功！')
        } else {
          throw new Error('无效的 JSON 格式')
        }
      } catch (error) {
        console.error('导入 JSON 失败:', error)
        alert('导入失败：文件格式不正确，请确保是有效的 JSON 文件')
      }
    }
    reader.onerror = () => {
      alert('读取文件失败，请重试')
    }
    reader.readAsText(file)
    
    // 清空 input，以便可以重复选择同一文件
    event.target.value = ''
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'w-full h-screen overflow-hidden relative',
        'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100',
        'dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950'
      )}
    >
      {/* 背景装饰 */}
      <BackgroundDecoration />

      {/* 顶部导航 */}
      <Header
        saveSuccess={saveSuccess}
        onGlobalAIImport={handleGlobalAIImport}
        onSaveToDashboard={handleSaveToDashboard}
        onAPISettings={() => setApiSettingsOpen(true)}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
      />

      {/* 隐藏的文件输入（用于导入 JSON） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={aiModalOpen}
        sectionType={aiModalSection}
        sectionTitle={aiModalTitle}
        onClose={() => setAiModalOpen(false)}
        onSave={handleAISave}
      />

      {/* API 设置弹窗 */}
      <APISettingsDialog
        open={apiSettingsOpen}
        onOpenChange={setApiSettingsOpen}
      />

      {/* 三列布局 - 可拖拽分隔线 */}
      <ResizableLayout
        resumeData={resumeData}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        toggleSectionVisibility={toggleSectionVisibility}
        updateMenuSections={updateMenuSections}
        reorderSections={reorderSections}
        updateGlobalSettings={updateGlobalSettings}
        addCustomSection={addCustomSection}
        updateBasicInfo={updateBasicInfo}
        updateProject={updateProject}
        deleteProject={deleteProject}
        reorderProjects={reorderProjects}
        updateExperience={updateExperience}
        deleteExperience={deleteExperience}
        reorderExperiences={reorderExperiences}
        updateEducation={updateEducation}
        deleteEducation={deleteEducation}
        reorderEducations={reorderEducations}
        updateOpenSource={updateOpenSource}
        deleteOpenSource={deleteOpenSource}
        reorderOpenSources={reorderOpenSources}
        updateAward={updateAward}
        deleteAward={deleteAward}
        reorderAwards={reorderAwards}
        updateSkillContent={updateSkillContent}
        handleAIImport={handleAIImport}
        pdfBlob={pdfBlob}
        loading={loading}
        progress={progress}
        handleRender={handleRender}
        handleDownload={handleDownload}
      />
    </motion.main>
  )
}
