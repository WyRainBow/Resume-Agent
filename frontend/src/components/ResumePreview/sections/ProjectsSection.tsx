/**
 * 项目经历模块
 */
import React from 'react'
import type { SectionProps } from '../types'
import { renderDetailItem } from './DetailItem'

export function ProjectsSection({ resume, onBlur, onKeyDown, styles }: SectionProps) {
  const projects = resume.projects
  if (!projects || projects.length === 0) return null
  const sectionTitle = resume.sectionTitles?.projects || '项目经历'

  return (
    <div key="projects" style={styles.section}>
      <div 
        contentEditable 
        suppressContentEditableWarning
        style={styles.sectionTitle}
        data-field="sectionTitle.projects"
        onBlur={onBlur}
      >
        {sectionTitle}
      </div>
      {projects.map((item: any, idx: number) => {
        const title = item.title || item.name || ''
        const subtitle = item.subtitle || item.role || ''
        const date = item.date || ''
        const details = item.highlights || item.details || []
        const repoUrl = item.repoUrl || ''
        const stack = item.stack || []
        
        if (!title) return null
        
        return (
          <div key={idx} style={{ ...styles.entry, marginBottom: '14px' }}>
            {/* 项目标题行 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'baseline',
              marginBottom: '2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <div
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ 
                    fontWeight: 700, 
                    fontSize: '11pt', 
                    color: '#000',
                    display: 'inline',
                  }}
                  data-field={`projects.${idx}.title`}
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
                {repoUrl && (
                  <a 
                    href={repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#5b6cf9', fontSize: '9pt', textDecoration: 'none', opacity: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗
                  </a>
                )}
              </div>
              {date && (
                <span 
                  contentEditable 
                  suppressContentEditableWarning
                  style={{ color: '#555', fontSize: '9pt', whiteSpace: 'nowrap', fontStyle: 'italic' }}
                  data-field={`projects.${idx}.date`}
                  onBlur={onBlur}
                >
                  {date}
                </span>
              )}
            </div>
            
            {/* 技术栈标签 */}
            {stack.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                {stack.map((tech: string, i: number) => (
                  <span key={i} style={{
                    fontSize: '8pt',
                    padding: '2px 8px',
                    background: 'linear-gradient(135deg, #f0f4ff, #e8ecff)',
                    border: '1px solid #d0d8f0',
                    borderRadius: '10px',
                    color: '#4a5490',
                  }}>
                    {tech}
                  </span>
                ))}
              </div>
            )}
            
            {/* 项目详情 */}
            {details.length > 0 && (
              <div 
                contentEditable 
                suppressContentEditableWarning
                style={{ marginTop: '4px', paddingLeft: '4px' }}
                data-field={`projects.${idx}.details`}
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
