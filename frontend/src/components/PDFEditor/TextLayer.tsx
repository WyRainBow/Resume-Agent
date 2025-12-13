/**
 * TextLayer 组件
 * 渲染可点击的文本区域，用于触发编辑
 */

import React, { useState, useCallback } from 'react'
import type { TextItem, TextPosition, EditItem } from './types'
import { calculateTextPosition } from './utils/coordinates'
import { editorStyles } from './styles'

interface TextLayerProps {
  textItems: TextItem[]
  pageHeight: number  // PDF 原始高度（点）
  scale: number
  pageEdits: EditItem[]  // 当前页已有的编辑
  onTextClick: (text: string, position: TextPosition, fontName: string) => void
}

export const TextLayer: React.FC<TextLayerProps> = ({
  textItems,
  pageHeight,
  scale,
  pageEdits,
  onTextClick,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // 检查某个文本位置是否已经被编辑过
  const isTextEdited = useCallback((position: TextPosition): boolean => {
    return pageEdits.some(edit => {
      const editPos = edit.position
      // 简单的碰撞检测：检查位置是否重叠
      const overlap = (
        Math.abs(editPos.left - position.left) < 5 &&
        Math.abs(editPos.top - position.top) < 5
      )
      return overlap
    })
  }, [pageEdits])

  const handleClick = (item: TextItem, position: TextPosition) => {
    // 如果已经被编辑过，不触发新的编辑
    if (isTextEdited(position)) return
    
    onTextClick(item.str, position, item.fontName)
  }

  return (
    <div style={editorStyles.editOverlay}>
      {textItems.map((item, index) => {
        const position = calculateTextPosition(item, pageHeight, scale)
        const isEdited = isTextEdited(position)
        const isHovered = hoveredIndex === index && !isEdited

        // 如果已被编辑，不显示这个可点击区域
        if (isEdited) return null

        return (
          <div
            key={index}
            style={{
              ...editorStyles.clickableText,
              left: position.left,
              top: position.top,
              width: position.width,
              height: position.height,
              ...(isHovered ? editorStyles.clickableTextHover : {}),
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => handleClick(item, position)}
            title={`点击编辑: "${item.str}"`}
          />
        )
      })}
    </div>
  )
}
