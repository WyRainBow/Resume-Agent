/**
 * 简历实时预览组件
 * 使用 HTML/CSS 渲染，拖拽时立即显示变化
 * 注意：仅用于预览，最终 PDF 使用 LaTeX 生成
 */
import React from 'react'
import type { Resume } from '../types/resume'

interface Props {
  resume: Resume | null
  sectionOrder?: string[]
}

export default function ResumePreview({ resume, sectionOrder }: Props) {
  if (!resume) {
    return (
      <div style={styles.placeholder}>
        <div style={styles.placeholderText}>暂无简历数据</div>
      </div>
    )
  }

  const defaultOrder = ['education', 'experience', 'projects', 'skills', 'awards', 'summary']
  // 如果 sectionOrder 是空数组或 undefined，使用默认顺序
  const order = (sectionOrder && sectionOrder.length > 0) ? sectionOrder : defaultOrder

  return (
    <div style={styles.container}>
      {/* 打印样式：只打印简历内容 */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #resume-preview, #resume-preview * { visibility: visible; }
          #resume-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            margin: 0;
            padding: 15mm 20mm;
            box-shadow: none;
          }
        }
      `}</style>
      <div id="resume-preview" style={styles.paper}>
        {/* 头部：姓名和联系方式 */}
        <div style={styles.header}>
          <div style={styles.name}>{resume.name || '姓名'}</div>
          <div style={styles.contact}>
            <span>{resume.contact?.phone}</span>
            {resume.contact?.phone && resume.contact?.email && <span> · </span>}
            <span>{resume.contact?.email}</span>
            {(resume.contact?.phone || resume.contact?.email) && <span> · 北京市</span>}
          </div>
        </div>

        {/* 按顺序渲染各模块 */}
        {order.map((sectionType) => {
          switch (sectionType) {
            case 'education':
              return renderEducation(resume)
            case 'experience':
            case 'internships':
              return renderExperience(resume)
            case 'projects':
              return renderProjects(resume)
            case 'skills':
              return renderSkills(resume)
            case 'awards':
              return renderAwards(resume)
            case 'summary':
              return renderSummary(resume)
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}

function renderEducation(resume: Resume) {
  const education = resume.education
  if (!education || education.length === 0) return null

  return (
    <div key="education" style={styles.section}>
      <div style={styles.sectionTitle}>教育经历</div>
      {education.map((edu: any, idx: number) => (
        <div key={idx} style={styles.entry}>
          <div style={styles.entryHeader}>
            <div>
              <span style={styles.entryTitle}>{edu.school || edu.title}</span>
              <span style={styles.entrySubtitle}> - {edu.degree} · {edu.major}</span>
            </div>
            <span style={styles.entryDate}>{edu.date}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function renderExperience(resume: Resume) {
  const internships = resume.internships
  if (!internships || internships.length === 0) return null

  return (
    <div key="experience" style={styles.section}>
      <div style={styles.sectionTitle}>工作经历</div>
      {internships.map((item: any, idx: number) => (
        <div key={idx} style={styles.entry}>
          <div style={styles.entryHeader}>
            <div>
              <span style={styles.entryTitle}>{item.title}</span>
              <span style={styles.entrySubtitle}> - {item.subtitle}</span>
            </div>
            <span style={styles.entryDate}>{item.date}</span>
          </div>
          {item.highlights && item.highlights.length > 0 && (
            <ul style={styles.highlights}>
              {item.highlights.map((h: string, i: number) => (
                <li key={i} style={styles.highlightItem}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function renderProjects(resume: Resume) {
  const projects = resume.projects
  if (!projects || projects.length === 0) return null

  return (
    <div key="projects" style={styles.section}>
      <div style={styles.sectionTitle}>项目经历</div>
      {projects.map((item: any, idx: number) => (
        <div key={idx} style={styles.entry}>
          <div style={styles.entryHeader}>
            <div>
              <span style={styles.entryTitle}>{item.title}</span>
              <span style={styles.entrySubtitle}> - {item.subtitle}</span>
            </div>
            <span style={styles.entryDate}>{item.date}</span>
          </div>
          {item.highlights && item.highlights.length > 0 && (
            <ul style={styles.highlights}>
              {item.highlights.map((h: string, i: number) => (
                <li key={i} style={styles.highlightItem}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function renderSkills(resume: Resume) {
  const skills = resume.skills
  if (!skills || skills.length === 0) return null

  return (
    <div key="skills" style={styles.section}>
      <div style={styles.sectionTitle}>专业技能</div>
      <div style={styles.skillsList}>
        {skills.map((skill: string, idx: number) => (
          <span key={idx} style={styles.skillItem}>{skill}</span>
        ))}
      </div>
    </div>
  )
}

function renderAwards(resume: Resume) {
  const awards = resume.awards
  if (!awards || awards.length === 0) return null

  return (
    <div key="awards" style={styles.section}>
      <div style={styles.sectionTitle}>荣誉奖项</div>
      <ul style={styles.awardsList}>
        {awards.map((award: string, idx: number) => (
          <li key={idx} style={styles.awardItem}>{award}</li>
        ))}
      </ul>
    </div>
  )
}

function renderSummary(resume: Resume) {
  const summary = resume.summary
  if (!summary) return null

  return (
    <div key="summary" style={styles.section}>
      <div style={styles.sectionTitle}>个人总结</div>
      <p style={styles.summaryText}>{summary}</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    backgroundColor: '#525659',
    padding: '20px',
  },
  paper: {
    width: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    backgroundColor: 'white',
    padding: '40px 50px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontSize: '10pt',
    lineHeight: 1.4,
    color: '#333',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#525659',
  },
  placeholderText: {
    color: '#888',
    fontSize: '16px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '16px',
    borderBottom: '2px solid #333',
    paddingBottom: '12px',
  },
  name: {
    fontSize: '22pt',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  contact: {
    fontSize: '10pt',
    color: '#555',
  },
  section: {
    marginBottom: '14px',
  },
  sectionTitle: {
    fontSize: '12pt',
    fontWeight: 'bold',
    color: '#000',
    borderBottom: '1px solid #ccc',
    paddingBottom: '4px',
    marginBottom: '8px',
  },
  entry: {
    marginBottom: '10px',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  },
  entryTitle: {
    fontWeight: 'bold',
    fontSize: '10.5pt',
  },
  entrySubtitle: {
    color: '#555',
    fontSize: '10pt',
  },
  entryDate: {
    color: '#666',
    fontSize: '9pt',
    whiteSpace: 'nowrap' as const,
  },
  highlights: {
    paddingLeft: '18px',
    marginTop: '4px',
    marginBottom: 0,
  },
  highlightItem: {
    marginBottom: '2px',
    fontSize: '9.5pt',
  },
  skillsList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px 12px',
  },
  skillItem: {
    background: '#f0f0f0',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '9.5pt',
  },
  awardsList: {
    paddingLeft: '18px',
    marginTop: 0,
    marginBottom: 0,
  },
  awardItem: {
    marginBottom: '2px',
    fontSize: '9.5pt',
  },
  summaryText: {
    fontSize: '9.5pt',
    textAlign: 'justify' as const,
    margin: 0,
  },
}
