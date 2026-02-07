/**
 * 生成完整的 HTML 文件内容（包含内联 CSS）
 */
import type { ResumeData } from '../types'
import { getLogoUrl } from '../constants/companyLogos'

// 生成单个模块的 HTML
function generateSectionHTML(section: { id: string; title: string }, resumeData: ResumeData): string {
  const { basic, experience, education, projects, openSource, awards, skillContent } = resumeData
  const sectionId = section.id
  const sectionTitle = section.title

  switch (sectionId) {
    case 'basic':
      return ''

    case 'skills':
      if (!skillContent) return ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">${skillContent}</div>
        </section>
      `

    case 'education':
      if (education.length === 0) return ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">
            ${education.map(edu => `
              <div class="item">
                <div class="item-header">
                  <div class="item-title-group">
                    <h3 class="item-title">${escapeHtml(edu.school)}</h3>
                    <span class="item-subtitle">${escapeHtml(edu.degree)} · ${escapeHtml(edu.major)}</span>
                  </div>
                  <span class="item-date">${escapeHtml(edu.startDate)} ~ ${escapeHtml(edu.endDate)}</span>
                </div>
                ${edu.description ? `<div class="item-description">${edu.description}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      `

    case 'experience': {
      if (experience.length === 0) return ''
      const companyFontSize = resumeData.globalSettings?.companyNameFontSize
      const logoSize = resumeData.globalSettings?.companyLogoSize || 20
      const styleParts: string[] = []
      if (companyFontSize) styleParts.push(`font-size:${companyFontSize}px`)
      const companyStyle = styleParts.length ? ` style="${styleParts.join(';')}"` : ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">
            ${experience.map(exp => {
              const logoUrl = exp.companyLogo ? getLogoUrl(exp.companyLogo) : null
              const logoHtml = logoUrl
                ? `<img src="${escapeHtml(logoUrl)}" alt="" style="height:${logoSize}px;width:${logoSize}px;object-fit:contain;flex-shrink:0" />`
                : ''
              return `
              <div class="item">
                <div class="item-header">
                  <div class="item-title-group">
                    <div style="display:flex;align-items:center;gap:6px">
                      ${logoHtml}
                      <h3 class="item-title"${companyStyle}>${escapeHtml(exp.company)}</h3>
                    </div>
                    <span class="item-subtitle">${escapeHtml(exp.position)}</span>
                  </div>
                  <span class="item-date">${escapeHtml(exp.date)}</span>
                </div>
                <div class="item-description">${exp.details}</div>
              </div>
            `}).join('')}
          </div>
        </section>
      `
    }

    case 'projects':
      if (projects.length === 0) return ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">
            ${projects.map(proj => `
              <div class="item">
                <div class="item-header">
                  <div class="item-title-group">
                    <h3 class="item-title">${escapeHtml(proj.name)}</h3>
                    <span class="item-subtitle">${escapeHtml(proj.role)}</span>
                  </div>
                  <span class="item-date">${escapeHtml(proj.date)}</span>
                </div>
                <div class="item-description">${proj.description}</div>
                ${proj.link ? `<a href="${escapeHtml(proj.link)}" target="_blank" rel="noopener noreferrer" class="item-link">查看项目 →</a>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      `

    case 'openSource': {
      if (openSource.length === 0) return ''
      const repoDisplay = resumeData.globalSettings?.openSourceRepoDisplay || 'below'
      const repoLabel = resumeData.globalSettings?.openSourceRepoLabel ?? '仓库'
      const repoPrefix = repoLabel ? `${escapeHtml(repoLabel)}: ` : ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">
            ${openSource.map(os => `
              <div class="item">
                <div class="item-header">
                  <div class="item-title-group">
                    <h3 class="item-title">
                      ${escapeHtml(os.name)}
                      ${repoDisplay === 'icon' && os.repo ? `<a href="${escapeHtml(os.repo)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(os.repo)}" style="margin-left:6px;vertical-align:middle;display:inline-block"><svg viewBox="0 0 16 16" width="14" height="14" style="fill:#24292f;vertical-align:middle"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>` : ''}
                      ${repoDisplay === 'inline' && os.repo ? `<span style="font-weight:normal;font-size:12px;margin-left:8px">${repoPrefix ? `<span style="color:#475569">${repoPrefix}</span>` : ''}<a href="${escapeHtml(os.repo)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb">${escapeHtml(os.repo)}</a></span>` : ''}
                    </h3>
                    ${os.role ? `<span class="item-subtitle">${escapeHtml(os.role)}</span>` : ''}
                  </div>
                  ${os.date ? `<span class="item-date">${escapeHtml(os.date)}</span>` : ''}
                </div>
                <div class="item-description">${os.description}</div>
                ${repoDisplay === 'below' && os.repo ? `<a href="${escapeHtml(os.repo)}" target="_blank" rel="noopener noreferrer" class="item-link">${repoPrefix ? repoPrefix + escapeHtml(os.repo) : escapeHtml(os.repo)}</a>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      `
    }

    case 'awards':
      if (awards.length === 0) return ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">
            ${awards.map(award => `
              <div class="item">
                <div class="item-header">
                  <div class="item-title-group">
                    <h3 class="item-title">${escapeHtml(award.title)}</h3>
                    ${award.issuer ? `<span class="item-subtitle">${escapeHtml(award.issuer)}</span>` : ''}
                  </div>
                  ${award.date ? `<span class="item-date">${escapeHtml(award.date)}</span>` : ''}
                </div>
                ${award.description ? `<p class="item-description">${escapeHtml(award.description)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      `

    default:
      // 自定义模块
      const customItems = resumeData.customData[sectionId]
      if (!customItems || customItems.length === 0) return ''
      return `
        <section class="template-section">
          <h2 class="section-title">${escapeHtml(sectionTitle)}</h2>
          <div class="section-content">
            ${customItems.map(item => `
              <div class="item">
                <div class="item-header">
                  <div class="item-title-group">
                    <h3 class="item-title">${escapeHtml(item.title)}</h3>
                    ${item.subtitle ? `<span class="item-subtitle">${escapeHtml(item.subtitle)}</span>` : ''}
                  </div>
                  ${item.dateRange ? `<span class="item-date">${escapeHtml(item.dateRange)}</span>` : ''}
                </div>
                ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      `
  }
}

export function generateHTMLFile(resumeData: ResumeData): string {
  const { basic, globalSettings } = resumeData
  const pagePadding = globalSettings?.pagePadding ?? 40

  // 读取 CSS 样式（内联）
  const css = `
    <style>
      .html-template-container {
        width: 100%;
        max-width: 850px;
        background: white;
        padding: ${pagePadding}px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
          'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        margin: 0 auto;
      }
      .template-header {
        border-bottom: 3px solid #2563eb;
        padding-bottom: 20px;
        margin-bottom: 24px;
      }
      .header-main {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 12px;
      }
      .header-left {
        flex: 1;
      }
      .candidate-name {
        font-size: 32px;
        font-weight: bold;
        color: #1f2937;
        margin: 0;
        line-height: 1.2;
      }
      .candidate-title {
        font-size: 18px;
        color: #2563eb;
        margin: 6px 0 0 0;
        font-weight: 600;
      }
      .header-right {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: right;
      }
      .info-item {
        font-size: 13px;
        color: #666;
        white-space: nowrap;
      }
      .employment-status {
        font-size: 12px;
        color: #666;
        display: inline-block;
        padding: 4px 8px;
        background: #f0f9ff;
        border-radius: 4px;
        margin-top: 8px;
      }
      .template-content {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .template-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .section-title {
        font-size: 16px;
        font-weight: bold;
        color: #1f2937;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e5e7eb;
      }
      .section-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      /* 专业技能等列表内容的样式 */
      .section-content ul,
      .section-content ol {
        margin: 0;
        padding-left: 24px;
        line-height: 1.7;
      }
      .section-content ul {
        list-style-type: disc;
      }
      .section-content ol {
        list-style-type: decimal;
      }
      .section-content li {
        margin: 6px 0;
        color: #555;
        font-size: 14px;
      }
      .section-content li p {
        margin: 0;
      }
      /* 嵌套列表 */
      .section-content ul ul,
      .section-content ol ol,
      .section-content ul ol,
      .section-content ol ul {
        margin: 4px 0;
        padding-left: 20px;
      }
      .section-content ul ul {
        list-style-type: circle;
      }
      .section-content ol ol {
        list-style-type: lower-alpha;
      }
      .item {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .item-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }
      .item-title {
        font-size: 15px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }
      .item-subtitle {
        font-size: 13px;
        color: #2563eb;
      }
      .item-date {
        font-size: 12px;
        color: #999;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .item-description {
        font-size: 13px;
        color: #555;
        margin: 0;
        line-height: 1.5;
      }
      .item-description p {
        margin: 0;
        padding: 0;
      }
      .item-description ul,
      .item-description ol {
        margin: 4px 0;
        padding-left: 20px;
      }
      .item-description li {
        margin: 3px 0;
      }
      .item-link {
        font-size: 12px;
        color: #2563eb;
        text-decoration: none;
        font-weight: 500;
      }
      .item-link:hover {
        color: #1d4ed8;
        text-decoration: underline;
      }
      @media print {
        .html-template-container {
          box-shadow: none;
          padding: ${Math.max(15, pagePadding - 10)}px;
        }
      }
    </style>
  `

  // 生成 HTML 内容
  const htmlContent = `
    <div class="html-template-container">
      <header class="template-header">
        <div class="header-main">
          <div class="header-left">
            <h1 class="candidate-name">${escapeHtml(basic.name || '未命名')}</h1>
            <p class="candidate-title">${escapeHtml(basic.title || '求职者')}</p>
          </div>
          <div class="header-right">
            ${basic.phone ? `<div class="info-item">📞 ${escapeHtml(basic.phone)}</div>` : ''}
            ${basic.email ? `<div class="info-item">📧 ${escapeHtml(basic.email)}</div>` : ''}
            ${basic.location ? `<div class="info-item">📍 ${escapeHtml(basic.location)}</div>` : ''}
          </div>
        </div>
        ${basic.employementStatus ? `<div class="employment-status">${escapeHtml(basic.employementStatus)}</div>` : ''}
      </header>

      <div class="template-content">
        ${(() => {
          // 根据 menuSections 的顺序生成模块 HTML（排除 basic，因为它在 header 中）
          const sectionsToRender = resumeData.menuSections
            .filter(section => section.id !== 'basic' && section.enabled)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          
          return sectionsToRender
            .map(section => generateSectionHTML(section, resumeData))
            .filter(html => html.trim() !== '')
            .join('')
        })()}
      </div>
    </div>
  `

  // 生成完整的 HTML 文档
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(basic.name || '简历')} - 简历</title>
  ${css}
</head>
<body>
  ${htmlContent}
</body>
</html>`
}

// HTML 转义函数
function escapeHtml(text: string): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

