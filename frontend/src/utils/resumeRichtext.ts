/**
 * 简历富文本字段格式化 —— 单一事实来源（前端导入链路统一入口）
 *
 * 所有导入路径（PDF / 图片 / 文本粘贴 / CocoChat 对话导入）都复用这里的转换，
 * 保证列表型字段统一产出 `<ul class="custom-list">` HTML —— 与 Agent 生成/编辑/润色
 * 链路（backend/agent/prompt/manus.py + backend/agent/utils/resume_richtext.py）的
 * 标准格式一致。`class="custom-list"` 是硬性要求：前端 RichEditor / 预览 / 导出的 CSS
 * 依赖这个类名做样式，裸 `<ul>` 会掉样式。
 *
 * 标准格式：
 *   列表字段：<ul class="custom-list"><li><p>要点…</p></li></ul>
 *   带小标题：<ul class="custom-list"><li><p><strong>小标题</strong>：描述</p></li></ul>
 */

export type ListStyle = 'bullet' | 'numbered' | 'none'

export interface HighlightsToHtmlOptions {
  /** 列表样式：'bullet'（默认，无序）| 'numbered'（有序）| 'none'（不成列表，逐条 <p>） */
  listStyle?: ListStyle
  /** 每个 <li> 内容是否用 <p> 包裹，默认 true（对齐编辑器/后端标准格式） */
  wrapParagraph?: boolean
  /** 识别 `**分组标题**` 生成嵌套列表，默认 true */
  detectGroups?: boolean
}

/** 检测是否是分组标题（如"**搜索服务拆分专项**"、"**性能优化**"） */
function isGroupTitle(text: string): boolean {
  const trimmed = text.trim()

  // 1. 【最重要】以 **xxx** 包裹的文本 = 模型输出的分组标题
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
    return true
  }

  // 2. 以"专项"或"优化"结尾的短文本（常见的分组名称模式）
  if ((trimmed.endsWith('专项') || trimmed.endsWith('优化') || trimmed.endsWith('模块')) && trimmed.length < 25) {
    return true
  }

  // 3. 纯中文短文本（<15字符），不含冒号、句号、逗号等描述性标点
  if (trimmed.length < 15 &&
      /^[一-龥A-Za-z0-9\s\-]+$/.test(trimmed) &&
      !trimmed.includes(':') &&
      !trimmed.includes('：') &&
      !trimmed.includes('。') &&
      !trimmed.includes('，') &&
      !trimmed.includes(',')) {
    return true
  }

  return false
}

/** Markdown 加粗 `**x**` → `<strong>x</strong>` */
function boldMarkdownToHtml(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

/** 归一化输入为字符串数组（数组原样过滤 / 字符串按换行拆分） */
function toItems(highlights: unknown): string[] {
  if (Array.isArray(highlights)) {
    return highlights
      .map((line) => (typeof line === 'string' ? line : String(line ?? '')))
      .filter((line) => line.trim())
  }
  if (typeof highlights === 'string') {
    return highlights.split('\n').filter((line) => line.trim())
  }
  return []
}

/**
 * 字符串数组 / 纯文本 → `<ul class="custom-list">` 富文本 HTML。
 * 统一 experience.details / education.description / projects highlights /
 * openSource.items 等列表型字段的转换。
 */
export function highlightsToHtml(
  highlights: unknown,
  options: HighlightsToHtmlOptions = {},
): string {
  const { listStyle = 'bullet', wrapParagraph = true, detectGroups = true } = options

  const items = toItems(highlights)
  if (!items.length) return ''

  const renderLi = (content: string): string =>
    wrapParagraph ? `<li><p>${content}</p></li>` : `<li>${content}</li>`

  // 嵌套分组（仅 bullet 样式下生效）
  if (detectGroups && listStyle === 'bullet' && items.some((h) => isGroupTitle(h))) {
    const groups: { title: string; children: string[] }[] = []
    let current: { title: string; children: string[] } | null = null

    for (const item of items) {
      const trimmed = item.trim()
      const formatted = boldMarkdownToHtml(trimmed)
      if (isGroupTitle(trimmed)) {
        if (current) groups.push(current)
        current = { title: formatted, children: [] }
      } else if (current) {
        current.children.push(formatted)
      } else {
        groups.push({ title: formatted, children: [] })
      }
    }
    if (current) groups.push(current)

    const groupsHtml = groups
      .map((g) => {
        if (g.children.length > 0) {
          const childrenHtml = g.children.map((c) => renderLi(c)).join('')
          const titleInner = `<strong>${g.title.replace(/<\/?strong>/g, '')}</strong>`
          const title = wrapParagraph ? `<p>${titleInner}</p>` : titleInner
          return `<li>${title}<ul class="custom-list nested-list">${childrenHtml}</ul></li>`
        }
        return renderLi(g.title)
      })
      .join('')

    return `<ul class="custom-list">${groupsHtml}</ul>`
  }

  // 无列表样式：逐条 <p>
  if (listStyle === 'none') {
    return items.map((h) => `<p>${boldMarkdownToHtml(h.trim())}</p>`).join('')
  }

  const liHtml = items.map((h) => renderLi(boldMarkdownToHtml(h.trim()))).join('')
  const tag = listStyle === 'numbered' ? 'ol' : 'ul'
  return `<${tag} class="custom-list">${liHtml}</${tag}>`
}

export interface SkillEntry {
  category?: string
  name?: string
  details?: string
  description?: string
}

export interface SkillsToHtmlOptions {
  /** 过滤明显混入的项目描述（无分类的长文本），默认 true */
  filterNonSkill?: boolean
}

/** 从一行文本提取 "分类：描述" → `<li><p><strong>分类</strong>：描述</p></li>`，否则整行成条 */
function skillLineToLi(line: string): string {
  const cleaned = line.replace(/^[-•·*●]\s*/, '').trim()
  if (!cleaned) return ''
  const match = cleaned.match(/^([^：:]{1,15})[：:](.+)$/)
  if (match) {
    return `<li><p><strong>${match[1].trim()}</strong>：${match[2].trim()}</p></li>`
  }
  return `<li><p>${cleaned}</p></li>`
}

/**
 * 专业技能（skillContent）统一转换 → `<ul class="custom-list"><li><p><strong>分类</strong>：描述</p></li></ul>`。
 * 支持：对象数组（{category/name, details/description}）、字符串数组、纯文本（按换行拆分）。
 */
export function skillsToHtml(
  skills: unknown,
  options: SkillsToHtmlOptions = {},
): string {
  const { filterNonSkill = true } = options

  const items: string[] = []

  const pushEntry = (entry: SkillEntry | string) => {
    if (typeof entry === 'string') {
      const li = skillLineToLi(entry)
      if (li) items.push(li)
      return
    }
    const category = (entry.category ?? entry.name ?? '').trim()
    const details = (entry.details ?? entry.description ?? '').trim()
    if (!details && !category) return

    // 过滤掉明显不是技能的内容（如项目描述混入技能）
    if (filterNonSkill && !category && details.length > 100 &&
        (details.includes('参与') || details.includes('负责') || details.includes('开发') ||
         details.includes('主导') || details.includes('构建'))) {
      return
    }

    if (category) {
      items.push(`<li><p><strong>${category}</strong>：${details}</p></li>`)
    } else if (details) {
      const li = skillLineToLi(details)
      if (li) items.push(li)
    }
  }

  if (Array.isArray(skills)) {
    for (const s of skills) pushEntry(s as SkillEntry | string)
  } else if (typeof skills === 'string') {
    for (const line of skills.split(/\n+/)) pushEntry(line)
  }

  if (!items.length) return ''
  return `<ul class="custom-list">${items.join('')}</ul>`
}
