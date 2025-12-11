/**
 * 可排序的模块卡片组件
 */
import React, { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SortableSectionProps } from './types'
import { SectionEditor } from './SectionEditor'

export function SortableSection({ 
  section, 
  expanded, 
  onToggle, 
  onUpdate,
  onTitleChange,
  onAIImport,
  importing
}: SortableSectionProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState(section.title)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.8 : 1,
  }

  // 开始编辑标题
  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTitle(section.title)
    setIsEditingTitle(true)
  }

  // 确认编辑
  const handleConfirmEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTitleChange(editingTitle)
    setIsEditingTitle(false)
  }

  // 取消编辑
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTitle(section.title)
    setIsEditingTitle(false)
  }

  // 处理标题栏点击展开
  const handleHeaderClick = (e: React.MouseEvent) => {
    onToggle()
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{
        background: isDragging 
          ? 'rgba(167, 139, 250, 0.3)' 
          : 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: isDragging 
          ? '2px solid rgba(167, 139, 250, 0.6)' 
          : '1px solid rgba(255, 255, 255, 0.15)',
        marginBottom: '8px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        boxShadow: isDragging 
          ? '0 20px 40px rgba(0, 0, 0, 0.3)' 
          : '0 4px 15px rgba(0, 0, 0, 0.1)',
      }}>
        {/* 标题栏 - 点击展开/收起 */}
        <div 
          onClick={handleHeaderClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 14px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {/* 拖拽手柄图标 */}
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '8px',
              marginRight: '12px',
              opacity: 0.5,
              transition: 'opacity 0.2s',
              cursor: 'grab',
            }}
          >
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
            </div>
          </div>

          {/* 图标和标题 */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
          }}>
            <span style={{ fontSize: '16px' }}>{section.icon}</span>
            
            {isEditingTitle ? (
              /* 编辑模式 */
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  autoFocus
                  style={{ 
                    color: 'white', 
                    fontSize: '14px', 
                    fontWeight: 600,
                    background: 'rgba(167, 139, 250, 0.2)',
                    border: '1px solid rgba(167, 139, 250, 0.5)',
                    outline: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    width: '120px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onTitleChange(editingTitle)
                      setIsEditingTitle(false)
                    } else if (e.key === 'Escape') {
                      setEditingTitle(section.title)
                      setIsEditingTitle(false)
                    }
                  }}
                />
                <button
                  onClick={handleConfirmEdit}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                  title="确认"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                  title="取消"
                >
                  ✕
                </button>
              </div>
            ) : (
              /* 显示模式 */
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  color: 'white', 
                  fontSize: '14px', 
                  fontWeight: 600,
                }}>
                  {section.title}
                </span>
                <button
                  onClick={handleStartEdit}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.8)',
                    padding: '3px 7px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '24px',
                    height: '24px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#fff'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  }}
                  title="编辑标题"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          {/* AI 导入按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAIImport()
            }}
            disabled={importing}
            style={{
              padding: '6px 12px',
              background: importing 
                ? 'rgba(124, 58, 237, 0.5)' 
                : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              border: '1px solid rgba(167, 139, 250, 0.5)',
              borderRadius: '6px',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500,
              cursor: importing ? 'not-allowed' : 'pointer',
              marginRight: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: importing ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              if (!importing) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)'
                e.currentTarget.style.filter = 'brightness(1.1)'
              }
            }}
            onMouseLeave={(e) => {
              if (!importing) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
                e.currentTarget.style.filter = 'brightness(1)'
              }
            }}
            title="AI 智能导入"
          >
            {importing ? '导入中...' : '✨AI 导入'}
          </button>

          {/* 展开/收起箭头 */}
          <div 
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
            }}
          >
            ▶
          </div>
        </div>

        {/* 展开的内容区 */}
        {expanded && (
          <div style={{
            padding: '0 20px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            animation: 'fadeIn 0.3s ease',
          }}>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <SectionEditor 
              section={section} 
              onUpdate={onUpdate} 
            />
          </div>
        )}
      </div>
    </div>
  )
}
