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
import { motion } from 'framer-motion'
import { cn } from '../../../lib/utils'

// Hooks
import { useResumeData, usePDFOperations, useAIImport } from './hooks'

// 组件
import { Header, BackgroundDecoration } from './components'
import ResizableLayout from './ResizableLayout'
import AIImportModal from './shared/AIImportModal'

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
      />

      {/* AI 导入弹窗 */}
      <AIImportModal
        isOpen={aiModalOpen}
        sectionType={aiModalSection}
        sectionTitle={aiModalTitle}
        onClose={() => setAiModalOpen(false)}
        onSave={handleAISave}
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
