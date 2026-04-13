import { ExternalLink, FileText, Loader2, PencilLine, X } from 'lucide-react'
import type { JDRecord } from '@/services/jdAnalysis'

interface Props {
  jd: JDRecord | null
  open: boolean
  titleDraft: string
  savingTitle: boolean
  onClose: () => void
  onTitleChange: (value: string) => void
  onSaveTitle: () => void
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  }
  const text = toText(value)
  return text ? [text] : []
}

function SectionTitle({ children }: { children: string }) {
  return <div className="text-xs font-semibold text-slate-500">{children}</div>
}

function ChipList(props: { items: string[]; tone?: 'blue' | 'slate' | 'emerald' }) {
  const { items, tone = 'slate' } = props
  if (!items.length) return null
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-700'
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-xs ${toneClass}`}>
          {item}
        </span>
      ))}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="mt-2 space-y-2 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function JDRecordDetailDialog(props: Props) {
  const { jd, open, titleDraft, savingTitle, onClose, onTitleChange, onSaveTitle } = props

  if (!open || !jd) return null

  const structured = jd.structured_data || {}
  const summary = toText(structured.summary)
  const responsibilities = toStringList(structured.responsibilities)
  const requiredSkills = toStringList(structured.required_skills)
  const preferredSkills = toStringList(structured.preferred_skills)
  const toolsAndStack = toStringList(structured.tools_and_stack)
  const keywords = toStringList(structured.keywords)
  const seniority = toText(structured.seniority)
  const canSaveTitle = titleDraft.trim().length > 0 && titleDraft.trim() !== jd.title.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jd-detail-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h3 id="jd-detail-title" className="text-lg font-semibold text-slate-900">
              JD 详情
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              查看结构化岗位要求，并修改当前 JD 名称
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <SectionTitle>JD 名称</SectionTitle>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <PencilLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={titleDraft}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="输入 JD 名称"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
              <button
                type="button"
                onClick={onSaveTitle}
                disabled={!canSaveTitle || savingTitle}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存名称'}
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {jd.company_name || '未知公司'} · {jd.source_type === 'url' ? '链接导入' : '文本录入'}
              {seniority ? ` · ${seniority}` : ''}
            </div>
            {jd.source_url ? (
              <a
                href={jd.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                查看原始 JD 链接
              </a>
            ) : (
              <div className="mt-3 text-xs text-slate-400">该 JD 由手动粘贴文本创建，没有原始链接。</div>
            )}
          </div>

          {summary ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>岗位概述</SectionTitle>
              <p className="mt-2 text-sm leading-6 text-slate-700">{summary}</p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>岗位职责</SectionTitle>
              <BulletList items={responsibilities} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>必备技能</SectionTitle>
              <ChipList items={requiredSkills} tone="blue" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>加分项</SectionTitle>
              <ChipList items={preferredSkills} tone="emerald" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>工具与技术栈</SectionTitle>
              <ChipList items={toolsAndStack} />
            </div>
          </div>

          {keywords.length ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>关键词</SectionTitle>
              <ChipList items={keywords} tone="slate" />
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              原始 JD 文本
            </div>
            <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">
              {jd.raw_text}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
