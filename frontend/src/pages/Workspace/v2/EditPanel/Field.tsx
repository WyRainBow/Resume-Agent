/**
 * 通用字段组件
 * 支持 text、textarea、date、editor 类型
 */
import React from 'react'
import { cn } from '../../../../lib/utils'
import RichEditor from '../shared/RichEditor'

interface FieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'textarea' | 'date' | 'editor'
  className?: string
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
}: FieldProps) => {
  // 富文本编辑器
  if (type === 'editor') {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm text-gray-600 dark:text-neutral-300">
            {label}
          </label>
        )}
        <RichEditor
          content={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>
    )
  }

  // 多行文本
  if (type === 'textarea') {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm text-gray-600 dark:text-neutral-300">
            {label}
          </label>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={cn(
            'w-full px-3 py-2 rounded-md border resize-none',
            'bg-white border-gray-200 text-gray-700',
            'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            className
          )}
        />
      </div>
    )
  }

  // 日期
  if (type === 'date') {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm text-gray-600 dark:text-neutral-300">
            {label}
          </label>
        )}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full px-3 py-2 rounded-md border',
            'bg-white border-gray-200 text-gray-700',
            'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            className
          )}
        />
      </div>
    )
  }

  // 单行文本（默认）
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm text-gray-600 dark:text-neutral-300">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 rounded-md border',
          'bg-white border-gray-200 text-gray-700',
          'dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          className
        )}
      />
    </div>
  )
}

export default Field


