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

export const HTMLTemplateRenderer: React.FC<HTMLTemplateRendererProps> = ({ resumeData }) => {
  const { basic, experience, education, projects, openSource, awards } = resumeData

  return (
    <div className="html-template-container">
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
        {/* 专业技能 */}
        {resumeData.skillContent && (
          <section className="template-section">
            <h2 className="section-title">🎯 专业技能</h2>
            <div
              className="section-content"
              dangerouslySetInnerHTML={{ __html: resumeData.skillContent }}
            />
          </section>
        )}

        {/* 教育经历 */}
        {education.length > 0 && (
          <section className="template-section">
            <h2 className="section-title">教育经历</h2>
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
        )}

        {/* 工作经历 */}
        {experience.length > 0 && (
          <section className="template-section">
            <h2 className="section-title">工作经历</h2>
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
        )}

        {/* 项目经历 */}
        {projects.length > 0 && (
          <section className="template-section">
            <h2 className="section-title">项目经历</h2>
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
        )}

        {/* 开源经历 */}
        {openSource.length > 0 && (
          <section className="template-section">
            <h2 className="section-title">开源经历</h2>
            <div className="section-content">
              {openSource.map((os) => (
                <div key={os.id} className="item">
                  <div className="item-header">
                    <div className="item-title-group">
                      <h3 className="item-title">{os.name}</h3>
                      {os.role && <span className="item-subtitle">{os.role}</span>}
                    </div>
                    {os.date && <span className="item-date">{os.date}</span>}
                  </div>
                  <div
                    className="item-description"
                    dangerouslySetInnerHTML={{ __html: os.description }}
                  />
                  {os.repo && (
                    <a href={os.repo} target="_blank" rel="noopener noreferrer" className="item-link">
                      查看仓库 →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 荣誉奖项 */}
        {awards.length > 0 && (
          <section className="template-section">
            <h2 className="section-title">🏆 荣誉奖项</h2>
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
        )}
      </div>
    </div>
  )
}

export default HTMLTemplateRenderer

