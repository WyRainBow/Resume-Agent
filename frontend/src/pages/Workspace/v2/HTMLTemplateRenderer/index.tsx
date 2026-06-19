/**
 * HTML 模板渲染器
 * 用于实时预览和编辑 HTML 模板格式的简历
 */
import React from 'react'
import { cn } from '@/lib/utils'
import type { ResumeData } from '../types'
import { getLogoUrl } from '../constants/companyLogos'
import { getSchoolLogoUrl } from '../constants/schoolLogos'
import { stripHtmlTags } from '../utils'
import { formatBirthDateForHeader, resolveEmploymentStatusForRender } from '../utils/birthDateDisplay'
import './styles.css'

interface HTMLTemplateRendererProps {
  resumeData: ResumeData
}

// 渲染单个模块的函数
const renderSection = (section: { id: string; title: string }, resumeData: ResumeData) => {
  const { basic, experience, education, projects, openSource, awards, selfEvaluation, skillContent } = resumeData
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

    case 'selfEvaluation':
      if (!selfEvaluation) return null
      return (
        <section key="selfEvaluation" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div
            className="section-content"
            dangerouslySetInnerHTML={{ __html: selfEvaluation }}
          />
        </section>
      )

    case 'education':
      if (education.length === 0) return null
      return (
        <section key="education" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {education.map((edu) => {
              const logoUrl = edu.schoolLogo ? getSchoolLogoUrl(edu.schoolLogo) : null
              const logoSize = edu.schoolLogoSize || 20
              const schoolStyle: React.CSSProperties = {}
              if (edu.schoolNameFontSize) schoolStyle.fontSize = `${edu.schoolNameFontSize}px`
              return (
                <div key={edu.id} className="item">
                  <div className="item-header">
                    <div className="item-title-group">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {logoUrl && (
                          <img
                            src={logoUrl}
                            alt=""
                            style={{
                              height: `${logoSize}px`,
                              maxWidth: `${logoSize * 4}px`,
                              objectFit: 'contain',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <h3 className="item-title" style={Object.keys(schoolStyle).length ? schoolStyle : undefined}>
                          {stripHtmlTags(edu.school)}
                        </h3>
                      </div>
                      <span className="item-subtitle">{stripHtmlTags(edu.degree)} · {stripHtmlTags(edu.major)}</span>
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
              )
            })}
          </div>
        </section>
      )

    case 'experience': {
      if (experience.length === 0) return null
      const logoSize = resumeData.globalSettings?.companyLogoSize || 20
      return (
        <section key="experience" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {experience.map((exp) => {
              const logoUrl = exp.companyLogo ? getLogoUrl(exp.companyLogo) : null
              const expLogoSize = exp.companyLogoSize || logoSize
              const expCompanyFontSize = exp.companyNameFontSize ?? resumeData.globalSettings?.companyNameFontSize
              const companyStyle: React.CSSProperties = {}
              if (expCompanyFontSize) companyStyle.fontSize = `${expCompanyFontSize}px`
              return (
                <div key={exp.id} className="item">
                  <div className="item-header">
                    <div className="item-title-group">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {logoUrl && (
                          <img
                            src={logoUrl}
                            alt=""
                            style={{
                              height: `${expLogoSize}px`,
                              maxWidth: `${expLogoSize * 4}px`,
                              objectFit: 'contain',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <h3 className="item-title" style={Object.keys(companyStyle).length ? companyStyle : undefined}>{stripHtmlTags(exp.company)}</h3>
                      </div>
                      <span className="item-subtitle">{stripHtmlTags(exp.position)}</span>
                    </div>
                    <span className="item-date">{exp.date}</span>
                  </div>
                  <div
                    className="item-description"
                    dangerouslySetInnerHTML={{ __html: exp.details }}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )
    }

    case 'projects':
      if (projects.length === 0) return null
      const projectLinkDisplay = resumeData.globalSettings?.projectLinkDisplay || 'inline'
      const projectLinkLabel = resumeData.globalSettings?.projectLinkLabel ?? '链接'
      const projectLinkPrefix = projectLinkLabel ? `${projectLinkLabel}: ` : ''
      return (
        <section key="projects" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {projects.map((proj) => (
              <div key={proj.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">
                      {stripHtmlTags(proj.name)}
                      {projectLinkDisplay === 'icon' && proj.link && (
                        <a
                          href={proj.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={proj.link}
                          style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" style={{ fill: '#24292f', verticalAlign: 'middle' }}>
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                          </svg>
                        </a>
                      )}
                      {projectLinkDisplay === 'inline' && proj.link && (
                        <span style={{ marginLeft: '8px' }}>
                          {projectLinkPrefix && <span style={{ color: '#475569' }}>{projectLinkPrefix}</span>}
                          <a
                            href={proj.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb', fontStyle: 'italic' }}
                          >
                            {proj.link}
                          </a>
                        </span>
                      )}
                    </h3>
                    <span className="item-subtitle">{stripHtmlTags(proj.role)}</span>
                  </div>
                  <span className="item-date">{proj.date}</span>
                </div>
                {projectLinkDisplay === 'below' && proj.link && (
                  <div className="item-description">
                    {projectLinkPrefix}
                    <a
                      href={proj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', fontStyle: 'italic' }}
                    >
                      {proj.link}
                    </a>
                  </div>
                )}
                <div
                  className="item-description"
                  dangerouslySetInnerHTML={{ __html: proj.description }}
                />
              </div>
            ))}
          </div>
        </section>
      )

    case 'openSource': {
      if (openSource.length === 0) return null
      const repoDisplay = resumeData.globalSettings?.openSourceRepoDisplay || 'below'
      const repoLabel = resumeData.globalSettings?.openSourceRepoLabel ?? '仓库'
      const repoPrefix = repoLabel ? `${repoLabel}: ` : ''
      return (
        <section key="openSource" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {openSource.map((os) => (
              <div key={os.id} className="item">
                <div className="item-header">
                  <div className="item-title-group">
                    <h3 className="item-title">
                      {stripHtmlTags(os.name)}
                      {repoDisplay === 'icon' && os.repo && (
                        <a
                          href={os.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={os.repo}
                          style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" style={{ fill: '#24292f', verticalAlign: 'middle' }}>
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                          </svg>
                        </a>
                      )}
                      {repoDisplay === 'inline' && os.repo && (
                        <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                          {repoPrefix && <span style={{ color: '#475569' }}>{repoPrefix}</span>}
                          <a
                            href={os.repo}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb' }}
                          >
                            {os.repo}
                          </a>
                        </span>
                      )}
                    </h3>
                    {os.role && <span className="item-subtitle">{stripHtmlTags(os.role)}</span>}
                  </div>
                  {os.date && <span className="item-date">{os.date}</span>}
                </div>
                <div
                  className="item-description"
                  dangerouslySetInnerHTML={{ __html: os.description }}
                />
                {repoDisplay === 'below' && os.repo && (
                  <a href={os.repo} target="_blank" rel="noopener noreferrer" className="item-link">
                    {repoPrefix ? `${repoPrefix}${os.repo}` : os.repo}
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
      const awardsListType = resumeData.globalSettings?.awardsListType || 'unordered'
      const AwardsListTag = (awardsListType === 'ordered' ? 'ol' : 'ul') as 'ol' | 'ul'
      return (
        <section key="awards" className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            <AwardsListTag>
              {awards.map((award) => {
                const title = stripHtmlTags(award.title || '')
                const issuer = stripHtmlTags(award.issuer || '')
                const date = award.date || ''
                const desc = award.description || ''
                const parts = [title, issuer].filter(Boolean).join(' - ')
                const main = desc ? (parts ? `${parts}：${desc}` : desc) : (parts || '')
                const text = date ? (main ? `${main}（${date}）` : date) : main
                return <li key={award.id}>{text}</li>
              })}
            </AwardsListTag>
          </div>
        </section>
      )

    default:
      // 自定义模块
      const customItems = (resumeData.customData[sectionId] || []).filter((item) => item.visible !== false)
      if (customItems.length === 0) return null
      return (
        <section key={sectionId} className="template-section">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-content">
            {customItems.map((item) => {
              const itemTitle = stripHtmlTags(item.title || '').trim()
              const itemSubtitle = stripHtmlTags(item.subtitle || '').trim()
              // 条目标题为空或与模块名相同时视为冗余，不再作为子标题渲染（单块语义，避免重复）
              const showTitle = !!itemTitle && itemTitle !== sectionTitle.trim()
              const showHeader = showTitle || !!itemSubtitle || !!item.dateRange
              return (
                <div key={item.id} className="item">
                  {showHeader && (
                    <div className="item-header">
                      <div className="item-title-group">
                        {showTitle && <h3 className="item-title">{itemTitle}</h3>}
                        {itemSubtitle && <span className="item-subtitle">{itemSubtitle}</span>}
                      </div>
                      {item.dateRange && <span className="item-date">{item.dateRange}</span>}
                    </div>
                  )}
                  {item.description && (
                    <div
                      className="item-description"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}
                </div>
              )
            })}
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
            {basic.phone && (() => {
              const mode = resumeData.globalSettings?.contactLabelMode || 'icon'
              return (
                <div className="info-item">
                  {mode === 'icon' ? '📞 ' : mode === 'text' ? '电话：' : ''}{basic.phone}
                </div>
              )
            })()}
            {basic.email && (() => {
              const mode = resumeData.globalSettings?.contactLabelMode || 'icon'
              return (
                <div className="info-item">
                  {mode === 'icon' ? '📧 ' : mode === 'text' ? '邮箱：' : ''}{basic.email}
                </div>
              )
            })()}
            {basic.location && (() => {
              const mode = resumeData.globalSettings?.contactLabelMode || 'icon'
              return (
                <div className="info-item">
                  {mode === 'icon' ? '📍 ' : mode === 'text' ? '地点：' : ''}{basic.location}
                </div>
              )
            })()}
            {basic.birthDate && (() => {
              const mode = resumeData.globalSettings?.contactLabelMode || 'icon'
              const birthDisplayMode = resumeData.globalSettings?.birthDateDisplayMode || 'birthDate'
              const label = mode === 'icon' ? '🎂 ' : mode === 'text' ? (birthDisplayMode === 'age' ? '年龄：' : '生日：') : ''
              return (
                <div className="info-item">
                  {label}{formatBirthDateForHeader(basic.birthDate || '', birthDisplayMode)}
                </div>
              )
            })()}
            {basic.blog && (() => {
              const mode = resumeData.globalSettings?.contactLabelMode || 'icon'
              return (
                <div className="info-item">
                  {mode === 'icon' ? '🔗 ' : mode === 'text' ? '博客：' : ''}
                  <a href={basic.blog} target="_blank" rel="noopener noreferrer">{basic.blog}</a>
                </div>
              )
            })()}
          </div>
        </div>
        {(() => {
          const mode = resumeData.globalSettings?.birthDateDisplayMode || 'birthDate'
          const status = resolveEmploymentStatusForRender(
            basic.employementStatus,
            basic.birthDate,
            mode
          )
          return status ? <div className="employment-status">{status}</div> : null
        })()}
      </header>

      <div className="template-content">
        {/* 根据 menuSections 的顺序动态渲染模块 */}
        {sectionsToRender.map(section => renderSection(section, resumeData))}
      </div>
    </div>
  )
}

export default HTMLTemplateRenderer
