/**
 * 详情项渲染组件 - 支持层级结构和粗体标记
 */
import React from 'react'

interface DetailItemProps {
  text: string
  index: number
}

// 缩进层级边距
const indentMargins = [0, 16, 32, 48]

// 不同层级的项目符号样式
const bulletStyles = [
  { symbol: '•', size: '10px', color: '#333' },
  { symbol: '◦', size: '10px', color: '#555' },
  { symbol: '▪', size: '8px', color: '#666' },
  { symbol: '–', size: '10px', color: '#777' },
]

export function renderDetailItem(text: string, index: number): React.ReactElement {
  // 解析缩进级别：> 表示二级，>> 表示三级
  let indentLevel = 0
  let cleanText = text
  while (cleanText.startsWith('>')) {
    indentLevel++
    cleanText = cleanText.slice(1).trim()
  }
  
  // 解析粗体标记
  const boldMatch = cleanText.match(/^\*\*(.+?)\*\*[:：]?\s*(.*)$/)
  const isPureBoldTitle = cleanText.startsWith('**') && cleanText.endsWith('**') && !cleanText.slice(2, -2).includes('**')
  
  const bullet = bulletStyles[Math.min(indentLevel, bulletStyles.length - 1)]
  
  if (isPureBoldTitle) {
    // 纯粗体二级标题
    const titleContent = cleanText.slice(2, -2)
    return (
      <div 
        key={index} 
        style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          marginBottom: '4px',
          marginLeft: `${indentMargins[Math.min(indentLevel, 3)]}px`,
          marginTop: indentLevel === 0 ? '6px' : '2px',
        }}
      >
        <span style={{ 
          marginRight: '8px', 
          lineHeight: '1.5', 
          fontSize: bullet.size,
          color: bullet.color,
          marginTop: '2px',
        }}>
          {bullet.symbol}
        </span>
        <span style={{ 
          fontWeight: 600, 
          flex: 1, 
          lineHeight: '1.5', 
          color: '#1a1a1a',
          fontSize: '10pt',
        }}>
          {titleContent}
        </span>
      </div>
    )
  } else if (boldMatch) {
    // 粗体标题 + 内容
    const boldPart = boldMatch[1]
    const restPart = boldMatch[2]
    return (
      <div 
        key={index} 
        style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          marginBottom: '3px',
          marginLeft: `${indentMargins[Math.min(indentLevel, 3)]}px`,
          marginTop: indentLevel === 0 ? '4px' : '1px',
        }}
      >
        <span style={{ 
          marginRight: '8px', 
          lineHeight: '1.55', 
          fontSize: bullet.size,
          color: bullet.color,
          marginTop: '3px',
        }}>
          {bullet.symbol}
        </span>
        <span style={{ flex: 1, lineHeight: '1.55' }}>
          <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{boldPart}</span>
          {restPart && <span style={{ color: '#333' }}>：{restPart}</span>}
        </span>
      </div>
    )
  } else {
    // 普通文本
    return (
      <div 
        key={index} 
        style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          marginBottom: '2px',
          marginLeft: `${indentMargins[Math.min(indentLevel, 3)]}px`,
        }}
      >
        <span style={{ 
          marginRight: '8px', 
          lineHeight: '1.55', 
          fontSize: bullet.size,
          color: bullet.color,
          marginTop: '3px',
        }}>
          {bullet.symbol}
        </span>
        <span style={{ flex: 1, lineHeight: '1.55', color: '#333' }}>{cleanText}</span>
      </div>
    )
  }
}
