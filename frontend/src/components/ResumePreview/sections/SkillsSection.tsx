/**
 * 专业技能模块
 */
import React from 'react'
import type { SectionProps } from '../types'

export function SkillsSection({ resume, onBlur, onKeyDown, styles }: SectionProps) {
  const skills = resume.skills
  if (!skills || skills.length === 0) return null
  const title = resume.sectionTitles?.skills || '专业技能'

  return (
    <div key="skills" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.skills"
        onBlur={onBlur}
      >
        {title}
      </div>
      <ul 
        contentEditable 
        suppressContentEditableWarning
        style={{ fontSize: '10pt', lineHeight: 1.6, minHeight: '2em', margin: 0, paddingLeft: '24px' }}
        data-field="skills"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        {skills.map((skill: any, idx: number) => {
          const isObject = typeof skill === 'object' && skill !== null
          const category = isObject ? (skill.category || '') : skill
          const details = isObject ? (skill.details || '') : ''
          return (
            <li key={idx}>
              {category && details ? (
                <><strong>{category}</strong>: {details}</>
              ) : (
                category || details
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
