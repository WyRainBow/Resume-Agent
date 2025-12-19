/**
 * 技能格式化工具
 * 将纯文本格式转换为段落格式，自动加粗技能类别
 */

/**
 * 格式化技能文本：将每行的"技能类别: 描述"格式转换为段落，并加粗技能类别
 * @param text 原始文本
 * @returns 格式化后的HTML
 */
export function formatSkillsAsParagraphs(text: string): string {
  // 按行分割
  const lines = text.split('\n').filter(line => line.trim())
  
  // 处理每一行
  const formattedLines = lines.map(line => {
    const trimmedLine = line.trim()
    
    // 匹配"技能类别: 描述"格式
    const match = trimmedLine.match(/^(.+?):\s*(.+)$/)
    
    if (match) {
      // 找到冒号分隔的格式，加粗第一部分
      const category = match[1].trim()
      const description = match[2].trim()
      return `<p><strong>${escapeHtml(category)}</strong>: ${escapeHtml(description)}</p>`
    } else {
      // 没有冒号，保持原样
      return `<p>${escapeHtml(trimmedLine)}</p>`
    }
  })
  
  return formattedLines.join('')
}

/**
 * 从HTML中提取纯文本（用于反向转换）
 */
export function extractTextFromHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

