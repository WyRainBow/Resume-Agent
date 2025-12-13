/**
 * 可拖拽分割条组件
 */
import React from 'react'

interface DividerProps {
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export function Divider({ isDragging, onMouseDown }: DividerProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: '3px',
        cursor: 'col-resize',
        background: isDragging 
          ? 'rgba(167, 139, 250, 0.8)' 
          : 'rgba(255, 255, 255, 0.15)',
        transition: isDragging ? 'none' : 'background 0.2s',
        position: 'relative',
        zIndex: 10,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = 'rgba(167, 139, 250, 0.5)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
        }
      }}
    />
  )
}
