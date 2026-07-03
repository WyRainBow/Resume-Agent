/**
 * 专业技能润色结果强制无序列表：
 * 结果没有 <ul>/<ol> 时，把段落逐条包成 <ul class="custom-list">（与 PDF 渲染一致）。
 * 拆条规则：按 </p>、<br> 分行；一段里多个「<strong>标签</strong>：内容」时，
 * 按「句末（。；）+ 粗体标签」边界继续拆（用哨兵字符，不用 lookbehind，兼容旧 Safari）。
 */
const SEP = '␟' // 罕见分隔符，仅作内部拆分哨兵

export function ensureSkillBulletList(html: string): string {
  const raw = (html || '').trim()
  if (!raw) return html
  if (/<[uo]l[\s>]/i.test(raw)) return raw

  const paras = raw.match(/<p[^>]*>[\s\S]*?<\/p>/gi)
  const inners =
    paras && paras.length > 0
      ? paras.map((p) => p.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, ''))
      : raw.split(/\n+/)

  const segments: string[] = []
  for (const inner of inners) {
    for (const part of inner.split(/<br\s*\/?>/i)) {
      const marked = part.replace(/([。；;])\s*(<strong)/gi, `$1${SEP}$2`)
      for (const seg of marked.split(SEP)) {
        const t = seg.trim()
        if (t) segments.push(t)
      }
    }
  }
  if (segments.length === 0) return raw
  return `<ul class="custom-list">${segments.map((s) => `<li><p>${s}</p></li>`).join('')}</ul>`
}
