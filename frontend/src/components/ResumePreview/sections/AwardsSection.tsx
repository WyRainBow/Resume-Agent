/**
 * 荣誉奖项模块
 */
import React from 'react'
import type { SectionProps } from '../types'

export function AwardsSection({ resume, onBlur, styles }: Omit<SectionProps, 'onKeyDown'>) {
  const awards = resume.awards
  if (!awards || awards.length === 0) return null
  const title = resume.sectionTitles?.awards || '荣誉奖项'

  return (
    <div key="awards" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.awards"
        onBlur={onBlur}
      >
        {title}
      </div>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={{ ...styles.awardsList, listStyle: 'none', padding: 0, minHeight: '1em' }}
        data-field="awards"
        onBlur={onBlur}
      >
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {awards.map((award: any, idx: number) => {
            const text = typeof award === 'string' ? award : (award.title || award.name || '')
            if (!text) return null
            return <li key={idx} style={styles.awardItem}>{text}</li>
          })}
        </ul>
      </div>
    </div>
  )
}
