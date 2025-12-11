/**
 * 工作/实习经历模块
 */
import React from 'react'
import type { SectionProps } from '../types'
import { renderDetailItem } from './DetailItem'

export function ExperienceSection({ resume, onBlur, onKeyDown, styles }: SectionProps) {
  const internships = resume.internships
  if (!internships || internships.length === 0) return null
  const sectionTitle = resume.sectionTitles?.experience || resume.sectionTitles?.internships || '工作经历'
  const isCompactMode = sectionTitle === '实习经历'

  return (
    <div key="experience" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.experience"
        onBlur={onBlur}
      >
        {sectionTitle}
      </div>
      {internships.map((item: any, idx: number) => {
        const title = item.title || item.company || ''
        const subtitle = item.subtitle || item.position || ''
        const date = item.date || item.duration || ''
        const details = item.highlights || item.details || []
        
        if (!title && !subtitle) return null
        
        // 简洁模式
        if (isCompactMode) {
          return (
            <div key={idx} style={{ ...styles.entry, marginBottom: details.length > 0 ? '10px' : '2px' }}>
              <div style={styles.entryHeader}>
                <div
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ ...styles.entryTitle, display: 'inline', fontWeight: 'normal' }}
                  data-field={`experience.${idx}.titleLine`}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                >
                  {title}{subtitle ? ` - ${subtitle}` : ''}
                </div>
                {date && (
                  <span 
                    contentEditable 
                    suppressContentEditableWarning
                    style={styles.entryDate}
                    data-field={`experience.${idx}.date`}
                    onBlur={onBlur}
                  >
                    {date}
                  </span>
                )}
              </div>
              {details.length > 0 && (
                <div 
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ marginTop: '4px', paddingLeft: '4px' }}
                  data-field={`experience.${idx}.details`}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                >
                  {details.map((h: string, i: number) => renderDetailItem(h, i))}
                </div>
              )}
            </div>
          )
        }
        
        // 完整模式
        return (
          <div key={idx} style={{ ...styles.entry, marginBottom: '14px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'baseline',
              marginBottom: '2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ 
                    fontWeight: 700, 
                    fontSize: '11pt', 
                    color: '#000',
                    display: 'inline',
                  }}
                  data-field={`experience.${idx}.title`}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                >
                  {title}
                </div>
                {subtitle && (
                  <span style={{ fontSize: '10pt', color: '#444', fontStyle: 'italic' }}>
                    – {subtitle}
                  </span>
                )}
              </div>
              {date && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ color: '#555', fontSize: '9pt', whiteSpace: 'nowrap', fontStyle: 'italic' }}
                  data-field={`experience.${idx}.date`}
                  onBlur={onBlur}
                >
                  {date}
                </span>
              )}
            </div>
            
            {details.length > 0 && (
              <div 
                contentEditable 
                suppressContentEditableWarning
                style={{ marginTop: '4px', paddingLeft: '4px' }}
                data-field={`experience.${idx}.details`}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
              >
                {details.map((h: string, i: number) => renderDetailItem(h, i))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
