import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { FileText } from './Icons'
import { cn } from '@/lib/utils'
import type { SavedResume } from '@/services/resumeStorage'

interface ResumeCardProps {
  resume: SavedResume
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  /** 是否被选中（用于批量删除） */
  isSelected?: boolean
  /** 选中状态变化回调 */
  onSelectChange?: (id: string, selected: boolean) => void
}

export const ResumeCard: React.FC<ResumeCardProps> = ({ 
  resume, 
  onEdit, 
  onDelete,
  isSelected = false,
  onSelectChange
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative"
    >
      {/* 复选框 - 用于批量选择删除 */}
      {onSelectChange && (
        <div 
          className="absolute top-3 left-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectChange(resume.id, e.target.checked)}
            className={cn(
              "w-5 h-5 rounded border-2 cursor-pointer transition-all duration-200",
              "accent-gray-900 dark:accent-primary",
              "hover:scale-110"
            )}
            title="选择此简历"
          />
        </div>
      )}

      <Card
        className={cn(
          "group border transition-all duration-200 h-[260px] flex flex-col",
          "hover:border-gray-400 hover:bg-gray-50",
          "dark:hover:border-primary dark:hover:bg-primary/10",
          // 选中状态时添加高亮边框
          isSelected && "border-red-400 bg-red-50/30 dark:border-red-500 dark:bg-red-950/20"
        )}
      >
        <CardContent className="relative flex-1 pt-6 text-center flex flex-col items-center">
          <motion.div
            className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-primary/10"
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            <FileText className="h-8 w-8 text-gray-600 dark:text-primary" />
          </motion.div>
          <CardTitle className="text-xl line-clamp-1 text-gray-900 dark:text-gray-100 px-4">
            {resume.name || "未命名简历"}
          </CardTitle>
          <CardDescription className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            更新于
            <span className="ml-2">
              {new Date(resume.updatedAt).toLocaleDateString()} {new Date(resume.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </CardDescription>
        </CardContent>
        <CardFooter className="pt-0 pb-4 px-4">
          <div className="grid grid-cols-2 gap-2 w-full">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                className="w-full text-sm hover:bg-gray-100 dark:border-primary/50 dark:hover:bg-primary/10"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(resume.id);
                }}
              >
                编辑
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                className="w-full text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(resume.id);
                }}
              >
                删除
              </Button>
            </motion.div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}