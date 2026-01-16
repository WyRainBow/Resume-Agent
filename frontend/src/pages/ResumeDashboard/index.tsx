import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from './components/Header'
import { CreateCard } from './components/CreateCard'
import { ResumeCard } from './components/ResumeCard'
import { useDashboardLogic } from './hooks/useDashboardLogic'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { AlertCircle, Settings } from './components/Icons'
import { Button } from './components/ui/button'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { useAuth } from '@/contexts/AuthContext'
import { LogIn, User } from 'lucide-react'

const ResumeDashboard = () => {
  const { isAuthenticated, user, logout } = useAuth()
  const {
    resumes,
    createResume,
    deleteResume,
    editResume,
    optimizeResume,
    importJson,
    // 批量删除相关
    selectedIds,
    toggleSelect,
    batchDelete,
    selectAll,
    clearSelection,
    isAllSelected
  } = useDashboardLogic()

  // 登录时数据保存到数据库，未登录时保存到本地存储
  const hasConfiguredFolder = true // 总是有存储配置（本地或云端）

  return (
    <WorkspaceLayout>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] relative overflow-hidden transition-colors duration-500">
        {/* 装饰性背景元素 */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 dark:bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 dark:bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 space-y-8 max-w-[1600px] mx-auto relative z-10 p-6 sm:p-10"
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
                    {isAuthenticated 
                      ? '✅ 数据已自动保存到云端数据库' 
                      : '✅ 数据已自动保存到本地存储（登录后可同步到云端）'}
                  </span>
                  {!isAuthenticated && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-4 hover:bg-green-100 dark:hover:bg-green-900"
                      onClick={() => {
                        window.location.href = '/login'
                      }}
                    >
                      登录同步到云端
                    </Button>
                  )}
                  {isAuthenticated && (
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
                  )}
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
            totalCount={resumes.length}
            isAllSelected={isAllSelected}
            onToggleSelectAll={isAllSelected ? clearSelection : selectAll}
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
                    onOptimize={optimizeResume}
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

      {/* 左下角登录按钮 */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 left-6 z-50"
      >
        {isAuthenticated ? (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group"
            onClick={logout}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium">已登录</span>
              <span className="text-sm font-bold text-slate-900">{user?.email}</span>
            </div>
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              window.location.href = '/login'
            }}
            className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:border-indigo-300 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
              <LogIn className="w-4 h-4 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-900">登录/注册</span>
          </motion.button>
        )}
      </motion.div>
    </WorkspaceLayout>
  )
}

export default ResumeDashboard