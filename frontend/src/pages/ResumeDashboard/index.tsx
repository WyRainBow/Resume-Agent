import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from './components/Header'
import { CreateCard } from './components/CreateCard'
import { ResumeCard } from './components/ResumeCard'
import { useDashboardLogic } from './hooks/useDashboardLogic'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { AlertCircle, Settings } from './components/Icons'
import { Button } from './components/ui/button'

const ResumeDashboard = () => {
  const {
    resumes,
    createResume,
    deleteResume,
    editResume,
    importJson,
    // 批量删除相关
    selectedIds,
    toggleSelect,
    batchDelete
  } = useDashboardLogic()

  // 模拟 hasConfiguredFolder 状态，因为我们使用 localStorage，总是"已配置"或不需要配置
  const hasConfiguredFolder = true

  return (
    <div className="min-h-screen bg-background p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 space-y-6 max-w-[1600px] mx-auto"
      >
        <motion.div
          className="flex w-full items-center justify-center px-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {hasConfiguredFolder ? (
            <Alert className="mb-6 bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <AlertDescription className="flex items-center justify-between">
                <span className="text-green-700 dark:text-green-400">
                  简历数据已自动保存到本地存储
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-4 hover:bg-green-100 dark:hover:bg-green-900"
                  onClick={() => {
                    // router.push("/app/dashboard/settings");
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  设置
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert
              variant="destructive"
              className="mb-6 bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>注意</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span className="text-red-700 dark:text-red-400">
                  建议配置云端同步，防止浏览器缓存清除时数据丢失。
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4 hover:bg-red-100 dark:hover:bg-red-900"
                  onClick={() => {
                    // router.push("/app/dashboard/settings");
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  前往设置
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </motion.div>

        {/* 顶部标题栏 - 传入批量删除相关 props */}
        <Header 
          onImport={importJson} 
          onCreate={createResume}
          selectedCount={selectedIds.size}
          onBatchDelete={batchDelete}
        />

        <motion.div
          className="flex-1 w-full p-3 sm:p-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <CreateCard onClick={createResume} />

            <AnimatePresence>
              {resumes.map((resume) => (
                <ResumeCard
                  key={resume.id}
                  resume={resume}
                  onEdit={editResume}
                  onDelete={deleteResume}
                  // 传入选中状态和回调
                  isSelected={selectedIds.has(resume.id)}
                  onSelectChange={toggleSelect}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default ResumeDashboard