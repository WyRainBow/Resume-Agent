import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from './ui/button'
import UserMenu from '@/components/UserMenu'
import { Plus, Upload, Trash2, FileText, LayoutGrid } from './Icons'

interface HeaderProps {
  onImport: () => void
  onCreate: () => void
  /** AI 智能导入回调 */
  onAIImport?: () => void
  /** 选中的简历数量（用于批量删除） */
  selectedCount?: number
  /** 批量删除回调 */
  onBatchDelete?: () => void
  /** 简历总数 */
  totalCount?: number
  /** 是否处于多选模式 */
  isMultiSelectMode?: boolean
  /** 切换多选模式 */
  onToggleMultiSelectMode?: () => void
  /** 退出多选模式 */
  onExitMultiSelectMode?: () => void
  /** 全选当前列表 */
  onSelectAll?: () => void
  /** 取消全选 */
  onClearSelection?: () => void
}

export const Header: React.FC<HeaderProps> = ({ 
  onImport, 
  onCreate,
  onAIImport,
  selectedCount = 0,
  onBatchDelete,
  totalCount = 0,
  isMultiSelectMode = false,
  onToggleMultiSelectMode,
  onExitMultiSelectMode,
  onSelectAll,
  onClearSelection
}) => {
  const navigate = useNavigate()
  const allSelected = totalCount > 0 && selectedCount === totalCount
  
  return (
    <motion.div
      className="px-2 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-6"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex items-center space-x-6">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="relative">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl shadow-xl shadow-indigo-500/20 group-hover:rotate-12 transition-all duration-300">
              <span className="text-white font-black text-2xl italic tracking-tighter">RA</span>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
              Resume Agent
            </h1>
            <span className="text-xs text-indigo-500 dark:text-indigo-400 font-bold tracking-[0.2em] uppercase mt-1">
              Dashboard
            </span>
          </div>
        </div>
        
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
              已选 {selectedCount}
            </span>
          </motion.div>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-3">
        <UserMenu />
        {/* 多选模式按钮 */}
        {totalCount > 0 && onToggleMultiSelectMode && (
          <Button
            onClick={onToggleMultiSelectMode}
            variant={isMultiSelectMode ? "default" : "ghost"}
            className={`rounded-xl h-12 px-6 font-bold transition-all duration-300 ${
              isMultiSelectMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {isMultiSelectMode ? '退出多选' : '多选'}
          </Button>
        )}

        {/* 多选模式下：全选 / 取消全选 */}
        {isMultiSelectMode && totalCount > 0 && onSelectAll && onClearSelection && (
          <Button
            onClick={allSelected ? onClearSelection : onSelectAll}
            variant="outline"
            className="rounded-xl h-12 px-6 font-bold border-2 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 bg-white/50 dark:bg-slate-900/50"
          >
            {allSelected ? '取消全选' : '全选'}
          </Button>
        )}

        {/* 简历市场 */}
        <Button
          onClick={() => navigate('/templates')}
          variant="outline"
          className="rounded-xl h-12 px-6 font-bold border-2 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300"
        >
          <LayoutGrid className="mr-2 h-5 w-5" />
          简历市场
        </Button>

        {/* AI 智能导入按钮 */}
        {onAIImport && (
          <Button
            onClick={onAIImport}
            variant="outline"
            className="rounded-xl h-12 px-6 font-bold border-2 border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300"
          >
            <Upload className="mr-2 h-5 w-5 text-violet-500" />
            AI 智能导入
          </Button>
        )}

        {/* 导入按钮 */}
        <Button
          onClick={onImport}
          variant="outline"
          className="rounded-xl h-12 px-6 font-bold border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300"
        >
          <Upload className="mr-2 h-5 w-5" />
          导入 JSON
        </Button>

        {/* 创建按钮 */}
        <Button
          onClick={onCreate}
          className="rounded-xl h-12 px-8 font-black bg-slate-900 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="mr-2 h-5 w-5 stroke-[3px]" />
          新建简历
        </Button>

        {/* 批量删除 */}
        {selectedCount > 0 && onBatchDelete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Button
              onClick={onBatchDelete}
              className="rounded-xl h-12 px-6 font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-2 border-red-100 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-all duration-300"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              删除
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}