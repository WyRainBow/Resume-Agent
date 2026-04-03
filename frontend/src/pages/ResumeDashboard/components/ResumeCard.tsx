import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy } from 'lucide-react'
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
  onDuplicate?: (id: string) => void
  /** 是否处于多选模式 */
  isMultiSelectMode?: boolean
  /** 是否被选中（用于批量删除） */
  isSelected?: boolean
  /** 选中状态变化回调 */
  onSelectChange?: (id: string, selected: boolean) => void
  /** 备注/别名变化回调 */
  onAliasChange?: (id: string, alias: string) => void
  /** 置顶切换回调 */
  onTogglePin?: (id: string) => void
}

export const ResumeCard: React.FC<ResumeCardProps> = ({
  resume,
  onEdit,
  onDelete,
  onDuplicate,
  isMultiSelectMode = false,
  isSelected = false,
  onSelectChange,
  onAliasChange,
  onTogglePin
}) => {
  const [isEditingAlias, setIsEditingAlias] = useState(false)
  const [aliasValue, setAliasValue] = useState(resume.alias || '')
  const inputRef = useRef<HTMLInputElement>(null)

  // 当进入编辑模式时，聚焦输入框
  useEffect(() => {
    if (isEditingAlias && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingAlias])

  // 保存备注
  const saveAlias = () => {
    const trimmedAlias = aliasValue.trim()
    if (trimmedAlias !== (resume.alias || '')) {
      onAliasChange?.(resume.id, trimmedAlias)
    }
    setIsEditingAlias(false)
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveAlias()
    } else if (e.key === 'Escape') {
      setAliasValue(resume.alias || '')
      setIsEditingAlias(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="relative group"
    >
      {/* 置顶状态的发光背景 */}
      {resume.pinned && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl blur opacity-20 dark:opacity-30" />
      )}

      {/* 选中状态的发光背景 - 只在多选模式下显示 */}
      {isMultiSelectMode && isSelected && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-30 dark:opacity-50 animate-pulse" />
      )}

      {/* 复选框容器 - 只在多选模式下显示 */}
      {isMultiSelectMode && onSelectChange && (
        <motion.div 
          className="absolute top-4 left-4 z-20"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
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
        </motion.div>
      )}

      <Card
        className={cn(
          "relative overflow-visible border border-slate-200/60 transition-all duration-300 min-h-[380px] flex flex-col rounded-2xl",
          "bg-white dark:bg-slate-900/40 backdrop-blur-xl",
          "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]",
          "hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]",
          isMultiSelectMode && isSelected && "ring-2 ring-slate-900"
        )}
      >
        <CardContent className="relative flex-1 min-h-0 pt-12 text-center flex flex-col items-center z-10">
          <motion.div
            className="mb-6 p-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-800"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <FileText className="h-12 w-12" />
          </motion.div>
          
          <CardTitle className="text-2xl font-black tracking-tight line-clamp-1 text-slate-900 dark:text-slate-100 px-6 mb-2">
            {resume.name || "未命名简历"}
          </CardTitle>
          
          {/* 备注/别名区域 */}
          <div 
            className="px-6 mb-4 min-h-[28px] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isEditingAlias ? (
              <input
                ref={inputRef}
                type="text"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                onBlur={saveAlias}
                onKeyDown={handleKeyDown}
                placeholder="添加备注..."
                className={cn(
                  "w-full max-w-[200px] px-3 py-1.5 text-sm text-center rounded-xl font-bold",
                  "bg-white dark:bg-slate-800 shadow-lg",
                  "border-2 border-slate-900",
                  "text-slate-900 dark:text-white",
                  "focus:outline-none"
                )}
              />
            ) : (
              <button
                onClick={() => setIsEditingAlias(true)}
                className={cn(
                  "text-sm px-3 py-1 rounded-full transition-all duration-300 font-bold",
                  resume.alias 
                    ? "bg-slate-100 text-slate-900 border border-slate-200" 
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title="点击编辑备注"
              >
                {resume.alias || "+ 添加备注"}
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest space-y-1.5">
            <div className="flex items-center justify-center gap-1.5">
              <span>创建时间</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span>{formatDateTime(resume.createdAt).split(' ')[0]}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span>更新时间 {formatDateTime(resume.updatedAt).split(' ')[0]}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="relative z-10 mt-auto pt-0 pb-6 px-4 gap-2 flex-nowrap">
          {/* 置顶按钮 */}
          {onTogglePin && (
            <Button
              variant="ghost"
              className={cn(
                "h-10 w-10 shrink-0 p-0 rounded-xl transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50",
                resume.pinned
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                  : "bg-slate-100/50 hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-900/30 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-400"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(resume.id);
              }}
              title={resume.pinned ? '取消置顶' : '置顶'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
                <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354" />
              </svg>
            </Button>
          )}
          <Button
            variant="ghost"
            className="flex-1 min-w-0 h-10 px-2 rounded-xl text-sm font-semibold bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all duration-300 border border-slate-200/50"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(resume.id);
            }}
          >
            编辑
          </Button>
          {onDuplicate && (
            <Button
              variant="ghost"
              className="flex-1 min-w-0 h-10 px-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all duration-300 border border-slate-200/50 inline-flex items-center justify-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(resume.id);
              }}
              title="复制一个一模一样的简历"
              aria-label="复制一个一模一样的简历"
            >
              <Copy className="h-4 w-4 shrink-0 max-[270px]:hidden" />
              <span className="truncate">复制</span>
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-10 w-10 shrink-0 p-0 rounded-xl bg-slate-100/50 hover:bg-red-50 dark:bg-slate-800/50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50"
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
