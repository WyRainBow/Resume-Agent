/**
 * 开源经历模块
 */
import React from 'react'
import type { SectionProps } from '../types'

export function OpenSourceSection({ resume, onBlur, onKeyDown, styles }: SectionProps) {
  const openSource = resume.openSource
  if (!openSource || openSource.length === 0) return null
  const title = resume.sectionTitles?.openSource || '开源经历'

  return (
    <div key="opensource" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.openSource"
        onBlur={onBlur}
      >
        {title}
      </div>
      {openSource.map((item: any, idx: number) => {
        const itemTitle = item.title || ''
        const subtitle = item.subtitle || ''
        const items = item.items || []
        const repoUrl = item.repoUrl || ''
        
        if (!itemTitle) return null
        
        return (
          <div key={idx} style={styles.entry}>
            <div style={styles.entryHeader}>
              <div>
                <div
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ ...styles.entryTitle, display: 'inline' }}
                  data-field={`opensource.${idx}.titleLine`}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                >
                  {itemTitle}{subtitle ? ` - ${subtitle}` : ''}
                </div>
                {repoUrl && (
                  <a 
                    href={repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ marginLeft: '8px', color: '#6366f1', fontSize: '10pt', textDecoration: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 仓库
                  </a>
                )}
              </div>
            </div>
            <div 
              contentEditable 
              suppressContentEditableWarning
              style={{ ...styles.highlights, paddingLeft: '18px', minHeight: '1em' }}
              data-field={`opensource.${idx}.items`}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            >
              {items.length > 0 
                ? <ul style={{ margin: 0, paddingLeft: '18px' }}>{items.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                : '点击添加开源贡献描述...'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
