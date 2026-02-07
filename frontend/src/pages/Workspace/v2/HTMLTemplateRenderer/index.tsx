/**
 * HTML 模板渲染器
 * 用于实时预览和编辑 HTML 模板格式的简历
 */
import React from 'react'
import { cn } from '@/lib/utils'
import type { ResumeData } from '../types'
import './styles.css'

interface HTMLTemplateRendererProps {
  resumeData: ResumeData
}

// 渲染单个模块的函数
const renderSection = (section: { id: string; title: string }, resumeData: ResumeData) => {
  const { basic, experience, education, projects, openSource, awards, skillContent } = resumeData
  const sectionId = section.id
  const sectionTitle = section.title

  switch (sectionId) {
    case 'basic':
      // 基本信息在 header 中显示，这里不渲染
      return null

    case 'skills':
      if (!skillContent) return null
      return (
        <section key="skills" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div
            className="section-content"
            dangerouslySetInnerHTML={{ __html: skillContent }}
          />
        </section>
      )

    case 'education':
      if (education.length === 0) return null
      return (
        <section key="education" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {education.map((edu) => (
              <div key={edu.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">{edu.school}</h3>
                    <span className="item-subtitle">{edu.degree} · {edu.major}</span>
                  </div>
                  <span className="item-date">{edu.startDate} ~ {edu.endDate}</span>
                </div>
                {edu.description && (
                  <div
                    className="item-description"
                    dangerouslySetInnerHTML={{ __html: edu.description }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )

    case 'experience':
      if (experience.length === 0) return null
      return (
        <section key="experience" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {experience.map((exp) => (
              <div key={exp.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">{exp.company}</h3>
                    <span className="item-subtitle">{exp.position}</span>
                  </div>
                  <span className="item-date">{exp.date}</span>
                </div>
                <div
                  className="item-description"
                  dangerouslySetInnerHTML={{ __html: exp.details }}
                />
              </div>
            ))}
          </div>
        </section>
      )

    case 'projects':
      if (projects.length === 0) return null
      return (
        <section key="projects" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {projects.map((proj) => (
              <div key={proj.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">{proj.name}</h3>
                    <span className="item-subtitle">{proj.role}</span>
                  </div>
                  <span className="item-date">{proj.date}</span>
                </div>
                <div
                  className="item-description"
                  dangerouslySetInnerHTML={{ __html: proj.description }}
                />
                {proj.link && (
                  <a href={proj.link} target="_blank" rel="noopener noreferrer" className="item-link">
                    查看项目 →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )

    case 'openSource': {
      if (openSource.length === 0) return null
      const repoDisplay = resumeData.globalSettings?.openSourceRepoDisplay || 'below'
      return (
        <section key="openSource" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {openSource.map((os) => (
              <div key={os.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">
                      {os.name}
                      {repoDisplay === 'inline' && os.repo && (
                        <a
                          href={os.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontWeight: 'normal', fontSize: '12px', marginLeft: '8px', color: '#2563eb' }}
                        >
                          {os.repo}
                        </a>
                      )}
                    </h3>
                    {os.role && <span className="item-subtitle">{os.role}</span>}
                  </div>
                  {os.date && <span className="item-date">{os.date}</span>}
                </div>
                <div
                  className="item-description"
                  dangerouslySetInnerHTML={{ __html: os.description }}
                />
                {repoDisplay === 'below' && os.repo && (
                  <a href={os.repo} target="_blank" rel="noopener noreferrer" className="item-link">
                    查看仓库 →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )
    }

    case 'awards':
      if (awards.length === 0) return null
      return (
        <section key="awards" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {awards.map((award) => (
              <div key={award.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">{award.title}</h3>
                    {award.issuer && <span className="item-subtitle">{award.issuer}</span>}
                  </div>
                  {award.date && <span className="item-date">{award.date}</span>}
                </div>
                {award.description && (
                  <p className="item-description">{award.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )

    default:
      // 自定义模块
      const customItems = resumeData.customData[sectionId]
      if (!customItems || customItems.length === 0) return null
      return (
        <section key={sectionId} className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {customItems.map((item) => (
              <div key={item.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">{item.title}</h3>
                    {item.subtitle && <span className="item-subtitle">{item.subtitle}</span>}
                  </div>
                  {item.dateRange && <span className="item-date">{item.dateRange}</span>}
                </div>
                {item.description && (
                  <div
                    className="item-description"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )
  }
}

export const HTMLTemplateRenderer: React.FC<HTMLTemplateRendererProps> = ({ resumeData }) => {
  const { basic, globalSettings } = resumeData
  const pagePadding = globalSettings?.pagePadding ?? 40

  // 根据 menuSections 的顺序渲染模块（排除 basic，因为它在 header 中）
  const sectionsToRender = resumeData.menuSections
    .filter(section => section.id !== 'basic' && section.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className="html-template-container" style={{ padding: `${pagePadding}px` }}>
      {/* 顶部 - 基本信息 */}
      <header className="template-header">
        <div className="header-main">
          <div className="header-left">
            <h1 className="candidate-name">{basic.name || '未命名'}</h1>
            <p className="candidate-title">{basic.title || '求职者'}</p>
          </div>
          <div className="header-right">
            {basic.phone && <div className="info-item">📞 {basic.phone}</div>}
            {basic.email && <div className="info-item">📧 {basic.email}</div>}
            {basic.location && <div className="info-item">📍 {basic.location}</div>}
          </div>
        </div>
        {basic.employementStatus && (
          <div className="employment-status">{basic.employementStatus}</div>
        )}
      </header>

      <div className="template-content">
        {/* 根据 menuSections 的顺序动态渲染模块 */}
        {sectionsToRender.map(section => renderSection(section, resumeData))}
      </div>
    </div>
  )
}

export default HTMLTemplateRenderer

