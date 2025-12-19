/**
 * 排版格式化工具函数
 * 支持双向转换：紧凑格式 ↔ 段落格式 ↔ 列表格式
 */

export type ContentFormat = 'compact' | 'paragraph' | 'list' | 'unknown'

/**
 * 从 HTML 中提取纯文本（保留换行）
 */
function extractTextFromHTML(html: string): string {
  if (typeof document === 'undefined') {
    // SSR 环境，使用正则表达式简单提取
    return html.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim()
  }
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  return tempDiv.textContent || tempDiv.innerText || ''
}

/**
 * 检测是否为技能格式（类别: 描述）
 */
function isSkillFormat(text: string): boolean {
  // 检测是否包含 "类别: 描述" 格式
  const skillPattern = /^[^:]+:\s*.+/
  const lines = text.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) return false
  
  // 至少 50% 的行符合技能格式
  const matchedLines = lines.filter(line => skillPattern.test(line.trim()))
  return matchedLines.length >= Math.ceil(lines.length * 0.5)
}

/**
 * 智能分割紧凑格式的技能文本
 * 识别 "类别: 描述" 模式，正确分割技能项
 */
function splitCompactSkills(text: string): string[] {
  // 匹配模式：类别: 描述（类别后跟冒号和空格，描述到下一个类别前）
  // 使用正则表达式匹配 "类别: 描述" 模式
  const skillPattern = /([^:]+):\s*([^:]+?)(?=\s+[^:]+:|$)/g
  const skills: string[] = []
  let match
  
  while ((match = skillPattern.exec(text)) !== null) {
    const category = match[1].trim()
    const description = match[2].trim()
    if (category && description) {
      skills.push(`${category}: ${description}`)
    }
  }
  
  // 如果没有匹配到，尝试按空格分割（降级方案）
  if (skills.length === 0) {
    // 查找所有 "类别: " 的位置
    const colonIndices: number[] = []
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ':' && i > 0 && text[i - 1] !== ' ' && i < text.length - 1 && text[i + 1] === ' ') {
        colonIndices.push(i)
      }
    }
    
    if (colonIndices.length > 0) {
      for (let i = 0; i < colonIndices.length; i++) {
        const start = i === 0 ? 0 : colonIndices[i - 1] + 1
        const end = i === colonIndices.length - 1 ? text.length : colonIndices[i]
        const skill = text.substring(start, end).trim()
        if (skill) {
          skills.push(skill)
        }
      }
    }
  }
  
  return skills.length > 0 ? skills : [text]
}

/**
 * 检测内容格式类型
 */
export function detectContentFormat(html: string): ContentFormat {
  if (!html || !html.trim()) return 'unknown'
  
  // 检查是否包含列表结构
  const hasList = /<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>|<li[^>]*>|<\/li>/i.test(html)
  if (hasList) return 'list'
  
  // 提取纯文本
  const text = extractTextFromHTML(html)
  
  // 检查是否为段落格式（多行，每行一个技能）
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length > 1 && isSkillFormat(text)) {
    return 'paragraph'
  }
  
  // 检查是否为紧凑格式（单行或很少行，包含多个技能）
  if (lines.length <= 2) {
    const skillCount = splitCompactSkills(text).length
    if (skillCount > 1) {
      return 'compact'
    }
  }
  
  // 检查是否为段落格式（即使只有一行，但格式正确）
  if (isSkillFormat(text)) {
    return 'paragraph'
  }
  
  return 'unknown'
}

/**
 * 将文本行转换为段落 HTML（保留已有的 HTML 标签）
 */
function convertLinesToParagraphs(lines: string[]): string {
  return lines
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      
      // 如果已经包含 HTML 标签，直接包装在 <p> 中
      if (trimmed.includes('<')) {
        return `<p>${trimmed}</p>`
      }
      
      // 纯文本，需要转义 HTML 特殊字符
      const escaped = trimmed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
      
      return `<p>${escaped}</p>`
    })
    .filter(p => p)
    .join('\n')
}

/**
 * 将段落转换为列表 HTML
 */
function convertParagraphsToList(html: string, ordered: boolean = false): string {
  if (typeof document === 'undefined') {
    // SSR 环境，使用正则表达式解析
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gis
    const matches = Array.from(html.matchAll(paragraphRegex))
    
    if (matches.length === 0) {
      // 如果没有段落标签，尝试按换行分割
      const text = extractTextFromHTML(html)
      const lines = text.split('\n').filter(line => line.trim())
      const listItems = lines.map(line => `<li>${line.trim()}</li>`).join('\n')
      return ordered ? `<ol>\n${listItems}\n</ol>` : `<ul>\n${listItems}\n</ul>`
    }
    
    const listItems = matches.map(match => `<li>${match[1].trim()}</li>`).join('\n')
    return ordered ? `<ol>\n${listItems}\n</ol>` : `<ul>\n${listItems}\n</ul>`
  }
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  const paragraphs = tempDiv.querySelectorAll('p')
  const listItems: string[] = []
  
  paragraphs.forEach((p) => {
    const content = p.innerHTML.trim()
    if (content) {
      listItems.push(`<li>${content}</li>`)
    }
  })
  
  if (listItems.length === 0) {
    // 如果没有段落，尝试按换行分割
    const text = extractTextFromHTML(html)
    const lines = text.split('\n').filter(line => line.trim())
    lines.forEach(line => {
      listItems.push(`<li>${line.trim()}</li>`)
    })
  }
  
  const listTag = ordered ? 'ol' : 'ul'
  return `<${listTag}>\n${listItems.join('\n')}\n</${listTag}>`
}

/**
 * 解析 HTML 列表并转换为段落格式
 */
function parseListToParagraphs(html: string): string {
  if (typeof document === 'undefined') {
    // SSR 环境，使用正则表达式解析
    const listItemRegex = /<li[^>]*>(.*?)<\/li>/gis
    const matches = Array.from(html.matchAll(listItemRegex))
    
    if (matches.length === 0) {
      const text = extractTextFromHTML(html)
      const lines = text.split('\n').filter(line => line.trim())
      return convertLinesToParagraphs(lines)
    }
    
    const paragraphs = matches.map(match => {
      const content = match[1].trim()
      if (content.includes('<p>')) {
        return content
      }
      return `<p>${content}</p>`
    })
    
    return paragraphs.join('\n')
  }
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // 查找所有列表项
  const listItems = tempDiv.querySelectorAll('ul li, ol li')
  
  if (listItems.length === 0) {
    // 如果没有列表项，尝试直接解析文本
    const text = extractTextFromHTML(html)
    const lines = text.split('\n').filter(line => line.trim())
    return convertLinesToParagraphs(lines)
  }
  
  // 提取每个列表项的 HTML 内容（保留内部格式如 <strong> 等）
  const paragraphs: string[] = []
  
  listItems.forEach((li) => {
    // 获取列表项的 HTML 内容（保留内部格式如 <strong> 等）
    const content = li.innerHTML.trim()
    
    if (content) {
      // 如果内容包含段落标签，直接使用
      if (content.includes('<p>')) {
        paragraphs.push(content)
      } else {
        // 否则包装在段落标签中
        paragraphs.push(`<p>${content}</p>`)
      }
    }
  })
  
  return paragraphs.join('\n')
}

/**
 * 规则格式化：智能转换格式
 * 
 * @param html 输入的 HTML 内容
 * @param targetFormat 目标格式（'paragraph' | 'list'），如果为 'auto' 则自动判断
 * @param ordered 如果转换为列表，是否使用有序列表
 * @returns 格式化后的 HTML 内容
 */
export function formatLayoutByRules(
  html: string,
  targetFormat: 'paragraph' | 'list' | 'auto' = 'auto',
  ordered: boolean = false
): string {
  if (!html || !html.trim()) {
    return html
  }
  
  try {
    const currentFormat = detectContentFormat(html)
    
    // 自动判断目标格式
    if (targetFormat === 'auto') {
      if (currentFormat === 'list') {
        targetFormat = 'paragraph'
      } else if (currentFormat === 'paragraph') {
        targetFormat = 'list'
      } else if (currentFormat === 'compact') {
        targetFormat = 'paragraph'
      } else {
        // 未知格式，尝试转换为段落
        targetFormat = 'paragraph'
      }
    }
    
    // 执行转换
    if (targetFormat === 'list') {
      // 转换为列表格式
      if (currentFormat === 'list') {
        // 已经是列表，切换有序/无序
        return convertParagraphsToList(parseListToParagraphs(html), ordered)
      } else {
        // 从段落或紧凑格式转换为列表
        const text = extractTextFromHTML(html)
        if (currentFormat === 'compact') {
          // 紧凑格式：先分割，再转换为列表
          const skills = splitCompactSkills(text)
          const listItems = skills.map(skill => `<li>${skill}</li>`).join('\n')
          return ordered ? `<ol>\n${listItems}\n</ol>` : `<ul>\n${listItems}\n</ul>`
        } else {
          // 段落格式：直接转换为列表
          return convertParagraphsToList(html, ordered)
        }
      }
    } else {
      // 转换为段落格式
      if (currentFormat === 'list') {
        // 列表转段落
        return parseListToParagraphs(html)
      } else if (currentFormat === 'compact') {
        // 紧凑格式转段落
        const text = extractTextFromHTML(html)
        const skills = splitCompactSkills(text)
        return convertLinesToParagraphs(skills)
      } else if (currentFormat === 'paragraph') {
        // 已经是段落格式，保持原样
        return html
      } else {
        // 未知格式，尝试解析
        const text = extractTextFromHTML(html)
        if (isSkillFormat(text)) {
          const lines = text.split('\n').filter(line => line.trim())
          return convertLinesToParagraphs(lines)
        }
        return html
      }
    }
  } catch (error) {
    console.error('格式化失败:', error)
    // 出错时返回原内容
    return html
  }
}

/**
 * 检测内容是否需要格式化
 */
export function needsFormatting(html: string): boolean {
  if (!html || !html.trim()) return false
  
  const format = detectContentFormat(html)
  return format !== 'unknown'
}
