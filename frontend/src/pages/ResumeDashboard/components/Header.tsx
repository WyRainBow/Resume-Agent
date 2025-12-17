import React from 'react'
import { motion } from 'framer-motion'
import { Button } from './ui/button'
import { Plus, Upload, Trash2 } from './Icons'

interface HeaderProps {
  onImport: () => void
  onCreate: () => void
  /** 选中的简历数量（用于批量删除） */
  selectedCount?: number
  /** 批量删除回调 */
  onBatchDelete?: () => void
}

export const Header: React.FC<HeaderProps> = ({ 
  onImport, 
  onCreate,
  selectedCount = 0,
  onBatchDelete
}) => {
  return (
    <motion.div
      className="px-4 sm:px-6 flex items-center justify-between"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center space-x-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          我的简历
        </h1>
        {/* 显示选中数量提示 */}
        {selectedCount > 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            已选择 {selectedCount} 项
          </motion.span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {/* 批量删除按钮 - 仅在有选中项时显示 */}
        {selectedCount > 0 && onBatchDelete && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Button
              onClick={onBatchDelete}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:text-red-500 dark:border-red-800 dark:hover:bg-red-950/50 dark:hover:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedCount})
            </Button>
          </motion.div>
        )}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Button
            onClick={onImport}
            variant="outline"
            className="hover:bg-gray-100 dark:border-primary/50 dark:hover:bg-primary/10"
          >
            <Upload className="mr-2 h-4 w-4" />
            导入 JSON
          </Button>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Button
            onClick={onCreate}
            variant="default"
            className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            创建简历
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}