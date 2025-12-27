/**
 * PDF 生成器
 * 将简历 JSON 转换为 PDF
 */
import html2pdf from 'html2pdf.js'

interface ResumeData {
  name?: string
  contact?: {
    phone?: string
    email?: string
  }
  summary?: string
  experience?: Array<any>
  projects?: Array<any>
  skills?: Array<any>
  education?: Array<any>
  awards?: Array<any>
}

export async function generatePDFFromJSON(
  resumeData: ResumeData,
  fileName: string
) {
  // 构建 HTML 内容
  const htmlContent = buildResumeHTML(resumeData)

  // 配置选项
  const options = {
    margin: [10, 10, 10, 10],
    filename: `${fileName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  // 生成 PDF
  return new Promise((resolve, reject) => {
    html2pdf()
      .set(options)
      .from(htmlContent)
      .save()
      .then(() => resolve(true))
      .catch((error: any) => reject(error))
  })
}

function buildResumeHTML(data: ResumeData): HTMLElement {
  const container = document.createElement('div')
  container.style.cssText = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 210mm;
    padding: 10mm;
  `

  // 姓名和联系方式
  let html = ''
  if (data.name) {
    html += `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${data.name}</h1>
        ${
          data.contact
            ? `<div style="font-size: 12px; color: #666;">
            ${data.contact.phone ? `📞 ${data.contact.phone}` : ''}
            ${data.contact.email ? `📧 ${data.contact.email}` : ''}
          </div>`
            : ''
        }
      </div>
    `
  }

  // 求职意向
  if (data.summary) {
    html += `
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">求职意向</h2>
        <p>${data.summary}</p>
      </div>
    `
  }

  // 教育经历
  if (data.education && data.education.length > 0) {
    html += `
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">教育经历</h2>
        ${data.education
          .map(
            (edu: any) => `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: bold;">${edu.title || ''}${edu.subtitle ? ' - ' + edu.subtitle : ''}</div>
            <div style="font-size: 12px; color: #666;">${edu.date || ''}</div>
            ${edu.details ? `<div style="margin-top: 5px;">${edu.details.join('; ')}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // 工作经历
  if (data.experience && data.experience.length > 0) {
    html += `
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">工作经历</h2>
        ${data.experience
          .map(
            (exp: any) => `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: bold;">${exp.title || ''}${exp.subtitle ? ' - ' + exp.subtitle : ''}</div>
            <div style="font-size: 12px; color: #666;">${exp.date || ''}</div>
            ${
              exp.highlights
                ? `<ul style="margin: 5px 0; padding-left: 20px;">${exp.highlights.map((h: string) => `<li>${h}</li>`).join('')}</ul>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // 项目经历
  if (data.projects && data.projects.length > 0) {
    html += `
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">项目经历</h2>
        ${data.projects
          .map(
            (proj: any) => `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: bold;">${proj.title || ''}${proj.subtitle ? ' - ' + proj.subtitle : ''}</div>
            <div style="font-size: 12px; color: #666;">${proj.date || ''}</div>
            ${proj.description ? `<div>${proj.description}</div>` : ''}
            ${
              proj.highlights
                ? `<ul style="margin: 5px 0; padding-left: 20px;">${proj.highlights.map((h: string) => `<li>${h}</li>`).join('')}</ul>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // 技能
  if (data.skills && data.skills.length > 0) {
    html += `
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">技能</h2>
        <div>${data.skills.map((skill: any) => {
          if (typeof skill === 'string') return skill
          return `${skill.category || ''}: ${skill.details || ''}`
        }).join(' • ')}</div>
      </div>
    `
  }

  // 奖项
  if (data.awards && data.awards.length > 0) {
    html += `
      <div style="margin-bottom: 15px;">
        <h2 style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-bottom: 10px;">奖项</h2>
        <ul style="margin: 0; padding-left: 20px;">
          ${data.awards.map((award: any) => `<li>${award.title || award}</li>`).join('')}
        </ul>
      </div>
    `
  }

  container.innerHTML = html
  return container
}

