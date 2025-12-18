/**
 * 通用字段组件
 * 支持 text、textarea、date、editor 类型
 * 支持 formatButtons 添加格式按钮（如加粗）
 */
import React, { useRef } from 'react'
import { Bold } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import RichEditor from '../shared/RichEditor'
import BoldInput from './BoldInput'

interface FieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'textarea' | 'date' | 'editor'
  className?: string
  formatButtons?: ('bold')[]  // 支持的格式按钮
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
  formatButtons,
}: FieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
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
  // 如果支持加粗格式，使用 BoldInput 组件
  if (formatButtons?.includes('bold')) {
    return (
      <BoldInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        label={label}
      />
    )
  }
  
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm text-gray-600 dark:text-neutral-300">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
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


