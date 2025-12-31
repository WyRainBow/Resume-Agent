import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MonthPickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const MonthPicker: React.FC<MonthPickerProps> = ({ value, onChange, placeholder = '选择时间' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const containerRef = useRef<HTMLDivElement>(null)

  // 解析当前值
  useEffect(() => {
    if (value) {
      const [year] = value.split('年') // 简单的格式解析
      if (year && !isNaN(parseInt(year))) {
        setCurrentYear(parseInt(year))
      }
    }
  }, [value])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const handleSelect = (month: number) => {
    // 格式化为 "YYYY年MM月"
    const formattedDate = `${currentYear}年${month.toString().padStart(2, '0')}月`
    onChange(formattedDate)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full pl-10 pr-8 py-2.5 rounded-xl border bg-gray-50/50 flex items-center cursor-pointer transition-all",
          isOpen ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-blue-400"
        )}
      >
        <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5" />
        <span className={cn("text-sm", !value && "text-gray-400")}>
          {value || placeholder}
        </span>
        {value && (
          <div
            onClick={handleClear}
            className="absolute right-3 p-0.5 rounded-full hover:bg-gray-200 text-gray-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 w-[280px] p-4 z-50"
          >
            {/* 年份切换 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentYear(prev => prev - 1)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-gray-900">{currentYear}年</span>
              <button
                onClick={() => setCurrentYear(prev => prev + 1)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* 月份网格 */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((month) => {
                const isSelected = value === `${currentYear}年${month.toString().padStart(2, '0')}月`
                return (
                  <button
                    key={month}
                    onClick={() => handleSelect(month)}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all",
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                        : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                    )}
                  >
                    {month}月
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

