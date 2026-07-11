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
 *
 * 行为按场景显式声明，不再靠隐藏的默认开关跨调用点共享启发式规则：
 *   - 扁平列表（experience / education / projects highlights）：`highlightsToHtml`
 *   - 可能带「分组标题 + 子项」结构的字段（openSource items）：`groupedHighlightsToHtml`
 *   - 技能：`skillsToHtml`（不过滤）；AI 解析导入路径额外用 `dropNonSkillEntries` 剔除混入项
 */

export type ListStyle = 'bullet' | 'numbered' | 'none'

export interface HighlightsToHtmlOptions {
  /** 列表样式：'bullet'（默认，无序）| 'numbered'（有序）| 'none'（不成列表，逐条 <p>） */
  listStyle?: ListStyle
}

// —— 富文本片段拼装工具（消除重复的字符串模板） ——

/** 单个列表项：内容统一用 <p> 包裹，对齐编辑器 / 后端标准格式 */
const wrapLi = (content: string): string => `<li><p>${content}</p></li>`

/** 列表容器：统一挂 `custom-list` 类名（嵌套子列表再加 `nested-list`） */
const wrapUl = (
  inner: string,
  opts: { tag?: 'ul' | 'ol'; nested?: boolean } = {},
): string => {
  const { tag = 'ul', nested = false } = opts
  return `<${tag} class="custom-list${nested ? ' nested-list' : ''}">${inner}</${tag}>`
}

/**
 * 检测是否是分组标题。
 * 仅认可模型显式输出的 `**分组标题**` 标记 —— 这是唯一可靠的信号。
 * 历史上还有「以专项/优化/模块结尾的短文本」「纯短文本不含标点」两条启发式兜底规则，
 * 误判率高（会把「性能优化」这类普通要点当成标题，把下一条错误地降级成它的子项），
 * 已移除。
 */
function isGroupTitle(text: string): boolean {
  return /^\*\*[^*]+\*\*$/.test(text.trim())
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
 * 字符串数组 / 纯文本 → `<ul class="custom-list">` 富文本 HTML（扁平列表，不做分组识别）。
 * 用于 experience.details / education.description / projects highlights 等本质上就是
 * 扁平要点的字段。需要「分组标题 + 子项」嵌套结构的字段（openSource items）请用
 * `groupedHighlightsToHtml`。
 */
export function highlightsToHtml(
  highlights: unknown,
  options: HighlightsToHtmlOptions = {},
): string {
  const { listStyle = 'bullet' } = options

  const items = toItems(highlights)
  if (!items.length) return ''

  // 无列表样式：逐条 <p>
  if (listStyle === 'none') {
    return items.map((h) => `<p>${boldMarkdownToHtml(h.trim())}</p>`).join('')
  }

  const liHtml = items.map((h) => wrapLi(boldMarkdownToHtml(h.trim()))).join('')
  return wrapUl(liHtml, { tag: listStyle === 'numbered' ? 'ol' : 'ul' })
}

/**
 * openSource items 专用：识别 `**分组标题**` 生成嵌套列表（「项目A：… / 项目B：…」这类
 * 真正带层级的开源项目清单）。没有 `**标题**` 标记时退化成扁平列表，行为等同
 * `highlightsToHtml`。仅用于确实可能有分组结构的字段，不要用在扁平要点字段上。
 */
export function groupedHighlightsToHtml(items: unknown): string {
  const list = toItems(items)
  if (!list.length) return ''

  // 没有显式分组标记 → 扁平列表
  if (!list.some((h) => isGroupTitle(h))) {
    return highlightsToHtml(list)
  }

  const groups: { title: string; children: string[] }[] = []
  let current: { title: string; children: string[] } | null = null

  for (const item of list) {
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
        const childrenHtml = g.children.map((c) => wrapLi(c)).join('')
        const titleInner = `<strong>${g.title.replace(/<\/?strong>/g, '')}</strong>`
        return `<li><p>${titleInner}</p>${wrapUl(childrenHtml, { nested: true })}</li>`
      }
      return wrapLi(g.title)
    })
    .join('')

  return wrapUl(groupsHtml)
}

export interface SkillEntry {
  category?: string
  name?: string
  details?: string
  description?: string
}

/** 从一行文本提取 "分类：描述" → `<li><p><strong>分类</strong>：描述</p></li>`，否则整行成条 */
function skillLineToLi(line: string): string {
  const cleaned = line.replace(/^[-•·*●]\s*/, '').trim()
  if (!cleaned) return ''
  const match = cleaned.match(/^([^：:]{1,15})[：:](.+)$/)
  if (match) {
    return wrapLi(`<strong>${match[1].trim()}</strong>：${match[2].trim()}`)
  }
  return wrapLi(cleaned)
}

/**
 * AI 解析导入路径专用：判断一个技能条目其实是「混入技能区的项目描述」
 *（无分类、长文本、且带明显的项目动词）。
 * 仅供 `dropNonSkillEntries` 使用 —— 只有 AI 解析导入才需要这层清洗，
 * 其它导入路径（ResumeDashboard / CocoChat）不做过滤，避免静默丢数据。
 */
function isNonSkillEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as SkillEntry
  const category = (e.category ?? e.name ?? '').trim()
  const details = (e.details ?? e.description ?? '').trim()
  return (
    !category &&
    details.length > 100 &&
    (details.includes('参与') ||
      details.includes('负责') ||
      details.includes('开发') ||
      details.includes('主导') ||
      details.includes('构建'))
  )
}

/**
 * AI 解析导入路径专用：剔除明显混入技能区的项目描述条目，再交给 `skillsToHtml`。
 * 只在 `useAIImport.ts` 显式调用；非数组输入原样返回。
 */
export function dropNonSkillEntries(skills: unknown): unknown {
  if (!Array.isArray(skills)) return skills
  return skills.filter((entry) => !isNonSkillEntry(entry))
}

/**
 * 专业技能（skillContent）统一转换 → `<ul class="custom-list"><li><p><strong>分类</strong>：描述</p></li></ul>`。
 * 支持：对象数组（{category/name, details/description}）、字符串数组、纯文本（按换行拆分）。
 * 本函数不做任何过滤 —— 所有传入条目都会被转换。若某条调用链需要剔除混入的项目描述，
 * 在调用点先用 `dropNonSkillEntries` 预处理（目前仅 AI 解析导入需要）。
 */
export function skillsToHtml(skills: unknown): string {
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

    if (category) {
      items.push(wrapLi(`<strong>${category}</strong>：${details}`))
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
  return wrapUl(items.join(''))
}
