/**
 * 个人总结模块
 */
import React from 'react'
import type { SectionProps } from '../types'

export function SummarySection({ resume, onBlur, onKeyDown, styles }: SectionProps) {
  const summary = resume.summary
  if (!summary) return null
  const title = resume.sectionTitles?.summary || '个人总结'

  return (
    <div key="summary" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.summary"
        onBlur={onBlur}
      >
        {title}
      </div>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={{ ...styles.summaryText, minHeight: '2em' }}
        data-field="summary"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        {summary}
      </div>
    </div>
  )
}
