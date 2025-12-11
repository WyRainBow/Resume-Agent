/**
 * 教育经历模块
 */
import React from 'react'
import type { SectionProps } from '../types'

export function EducationSection({ resume, onBlur, onKeyDown, styles }: SectionProps) {
  const education = resume.education
  if (!education || education.length === 0) return null
  const title = resume.sectionTitles?.education || '教育经历'

  return (
    <div key="education" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.education"
        onBlur={onBlur}
      >
        {title}
      </div>
      {education.map((edu: any, idx: number) => {
        const school = edu.school || edu.title || ''
        const degree = edu.degree || edu.subtitle || ''
        const major = edu.major || ''
        const date = edu.date || edu.duration || ''
        const details = edu.details || []
        const description = edu.description || ''
        
        if (!school && !degree) return null
        
        return (
          <div key={idx} style={styles.entry}>
            <div style={styles.entryHeader}>
              <div
                contentEditable 
                suppressContentEditableWarning
                style={{ ...styles.entryTitle, display: 'inline' }}
                data-field={`education.${idx}.titleLine`}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
              >
                {school}{degree ? ` - ${degree}` : ''}{major ? ` - ${major}` : ''}
              </div>
              {date && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  style={styles.entryDate}
                  data-field={`education.${idx}.date`}
                  onBlur={onBlur}
                >
                  {date}
                </span>
              )}
            </div>
            {((Array.isArray(details) && details.length > 0) || description) && (
              <div 
                contentEditable 
                suppressContentEditableWarning
                style={{ fontSize: '10pt', color: '#666', marginTop: '4px' }}
                data-field={`education.${idx}.details`}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
              >
                {Array.isArray(details) && details.length > 0 
                  ? details.join('；') 
                  : description}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
