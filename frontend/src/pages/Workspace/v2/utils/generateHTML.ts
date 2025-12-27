/**
 * 生成完整的 HTML 文件内容（包含内联 CSS）
 */
import type { ResumeData } from '../types'

export function generateHTMLFile(resumeData: ResumeData): string {
  const { basic, experience, education, projects, openSource, awards } = resumeData

  // 读取 CSS 样式（内联）
  const css = `
    <style>
      .html-template-container {
        width: 100%;
        max-width: 850px;
        background: white;
        padding: 40px;
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
          padding: 20px;
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
        ${resumeData.skillContent ? `
          <section class="template-section">
            <h2 class="section-title">🎯 专业技能</h2>
            <div class="section-content">${resumeData.skillContent}</div>
          </section>
        ` : ''}

        ${education.length > 0 ? `
          <section class="template-section">
            <h2 class="section-title">教育经历</h2>
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
        ` : ''}

        ${experience.length > 0 ? `
          <section class="template-section">
            <h2 class="section-title">工作经历</h2>
            <div class="section-content">
              ${experience.map(exp => `
                <div class="item">
                  <div class="item-header">
                    <div class="item-title-group">
                      <h3 class="item-title">${escapeHtml(exp.company)}</h3>
                      <span class="item-subtitle">${escapeHtml(exp.position)}</span>
                    </div>
                    <span class="item-date">${escapeHtml(exp.date)}</span>
                  </div>
                  <div class="item-description">${exp.details}</div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${projects.length > 0 ? `
          <section class="template-section">
            <h2 class="section-title">项目经历</h2>
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
        ` : ''}

        ${openSource.length > 0 ? `
          <section class="template-section">
            <h2 class="section-title">开源经历</h2>
            <div class="section-content">
              ${openSource.map(os => `
                <div class="item">
                  <div class="item-header">
                    <div class="item-title-group">
                      <h3 class="item-title">${escapeHtml(os.name)}</h3>
                      ${os.role ? `<span class="item-subtitle">${escapeHtml(os.role)}</span>` : ''}
                    </div>
                    ${os.date ? `<span class="item-date">${escapeHtml(os.date)}</span>` : ''}
                  </div>
                  <div class="item-description">${os.description}</div>
                  ${os.repo ? `<a href="${escapeHtml(os.repo)}" target="_blank" rel="noopener noreferrer" class="item-link">查看仓库 →</a>` : ''}
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${awards.length > 0 ? `
          <section class="template-section">
            <h2 class="section-title">🏆 荣誉奖项</h2>
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
        ` : ''}
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

