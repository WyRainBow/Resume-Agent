import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle, CardDescription, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { FileText, Trash2 } from './Icons'
import { cn } from '@/lib/utils'
import type { SavedResume } from '@/services/resumeStorage'

// 格式化时间为 年/月/日 时:分:秒
const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

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
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="relative group"
    >
      {/* 选中状态的发光背景 */}
      {isSelected && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-30 dark:opacity-50 animate-pulse" />
      )}

      {/* 复选框容器 */}
      {onSelectChange && (
        <div 
          className="absolute top-4 left-4 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectChange(resume.id, e.target.checked)}
            className={cn(
              "w-5 h-5 rounded-md border-2 cursor-pointer transition-all duration-300",
              "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
              "checked:bg-blue-600 dark:checked:bg-blue-500",
              "focus:ring-2 focus:ring-blue-500/50 outline-none"
            )}
            title="选择此简历"
          />
        </div>
      )}

      <Card
        className={cn(
          "relative overflow-hidden border-none transition-all duration-300 h-[280px] flex flex-col rounded-2xl",
          "bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl",
          "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]",
          "hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]",
          isSelected && "ring-2 ring-blue-500/50"
        )}
      >
        {/* 背景渐变装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-[100px] pointer-events-none" />

        <CardContent className="relative flex-1 pt-10 text-center flex flex-col items-center z-10">
          <motion.div
            className="mb-5 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400"
            whileHover={{ rotate: 10, scale: 1.1 }}
          >
            <FileText className="h-10 w-10" />
          </motion.div>
          
          <CardTitle className="text-xl font-bold line-clamp-1 text-slate-800 dark:text-slate-100 px-6 mb-2">
            {resume.name || "未命名简历"}
          </CardTitle>
          
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            已保存 · {formatDateTime(resume.updatedAt)}
          </div>
        </CardContent>

        <CardFooter className="relative z-10 pt-0 pb-6 px-6 gap-3">
          <Button
            variant="ghost"
            className="flex-1 h-11 rounded-xl font-semibold bg-slate-100/50 hover:bg-blue-100/50 dark:bg-slate-800/50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(resume.id);
            }}
          >
            编辑
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-11 p-0 rounded-xl bg-slate-100/50 hover:bg-red-100/50 dark:bg-slate-800/50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(resume.id);
            }}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}