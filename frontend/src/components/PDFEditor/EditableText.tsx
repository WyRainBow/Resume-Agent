/**
 * 可编辑文本组件
 * 用于在 PDF 上显示可编辑的文本输入框
 * 
 * 优化：精确宽度匹配 + 动态扩展
 * - 初始宽度精确等于原文字宽度
 * - 用户输入更长文字时自动扩展
 * - 用户输入更短文字时保持原宽度（确保遮盖原文）
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { EditItem } from './types'
import { measureTextWidth } from './utils/measureText'

interface EditableTextProps {
  edit: EditItem
  onUpdate: (newText: string) => void
  onFinish: () => void
  onCancel: () => void
  onReEdit: () => void  // 重新进入编辑模式
}

export const EditableText: React.FC<EditableTextProps> = ({
  edit,
  onUpdate,
  onFinish,
  onCancel,
  onReEdit,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(edit.newText)

  // 检查 position 是否存在
  if (!edit.position) {
    console.error('Edit position is undefined:', edit)
    return null
  }

  // 动态宽度：根据输入内容实时计算
  const [dynamicWidth, setDynamicWidth] = useState(edit.position.width)

  // 计算文字需要的宽度
  const calculateWidth = useCallback((text: string) => {
    const measuredWidth = measureTextWidth(text, edit.position.fontSize || 12)
    // 取原始宽度和新文字宽度的较大值，确保遮盖原文
    // +8 是输入框的内边距补偿
    const originalWidth = edit.position.width || 100
    return Math.max(originalWidth, measuredWidth + 8)
  }, [edit.position.width, edit.position.fontSize])

  // 初始化时计算宽度
  useEffect(() => {
    setDynamicWidth(calculateWidth(edit.newText))
  }, [edit.newText, calculateWidth])

  // 自动聚焦
  useEffect(() => {
    if (edit.isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [edit.isEditing])

  // 同步外部值变化
  useEffect(() => {
    setLocalValue(edit.newText)
  }, [edit.newText])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalValue(value)
    // 实时更新宽度
    setDynamicWidth(calculateWidth(value))
    onUpdate(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onFinish()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const handleBlur = () => {
    // 延迟处理，防止点击其他地方时立即触发
    setTimeout(() => {
      onFinish()
    }, 100)
  }

  // 高度增加 20% 以覆盖中文字符的上下延伸
  const adjustedHeight = (edit.position.height || 12) * 1.2

  // 如果不是编辑状态，显示已修改的文本（精确遮盖）
  if (!edit.isEditing) {
    // 计算新文字的实际宽度
    const newTextWidth = measureTextWidth(edit.newText, edit.position.fontSize || 12)
    // 遮盖宽度 = max(原文字宽度, 新文字宽度)
    const coverWidth = Math.max(edit.position.width || 100, newTextWidth + 4)
    
    return (
      <div
        style={{
          position: 'absolute',
          left: edit.position.left || 0,
          top: (edit.position.top || 0) - 2,  // 微调垂直位置
          width: coverWidth,
          height: adjustedHeight + 4,
          fontSize: edit.position.fontSize || 12,
          lineHeight: `${adjustedHeight}px`,
          backgroundColor: 'white',
          color: '#000',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          cursor: 'text',
          whiteSpace: 'nowrap',
        }}
        onClick={(e) => {
          e.stopPropagation()
          onReEdit()
        }}
      >
        {edit.newText}
      </div>
    )
  }

  // 编辑状态：显示输入框
  // 计算位置补偿：border(2px) + padding-left(1px) = 3px
  const inputLeftOffset = 3
  const inputPaddingH = 1  // 水平内边距
  
  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      spellCheck={false}
      style={{
        position: 'absolute',
        left: (edit.position.left || 0) - inputLeftOffset,  // 精确补偿边框+内边距
        top: (edit.position.top || 0) - 4,    // 边框 + 垂直居中补偿
        width: Math.max(dynamicWidth + inputPaddingH * 2, 50),  // 补偿内边距，最小宽度 50px
        height: adjustedHeight + 8,
        fontSize: edit.position.fontSize || 12,
        lineHeight: 1,
        fontFamily: 'inherit',
        backgroundColor: 'white',
        color: '#000',
        border: '2px solid #2563eb',
        borderRadius: '2px',
        outline: 'none',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
        boxSizing: 'border-box',
        padding: `2px ${inputPaddingH}px`,  // 减小水平内边距
        zIndex: 10,
      }}
    />
  )
}
