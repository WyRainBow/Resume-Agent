import React, { useState } from 'react'
import { Check, ChevronDown, ChevronUp, X, SkipForward } from 'lucide-react'
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext'
import { formatPatchDiffSide } from '../../utils/resumePatch'

function isEmptyContent(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t === '' || t === 'null' || t === 'undefined' || t === '{}'
}

function DiffContent({ text, variant }: { text: string; variant: 'before' | 'after' }) {
  if (isEmptyContent(text)) {
    return (
      <div className="text-sm italic text-gray-400">
        {variant === 'before' ? '（原先无内容）' : '（无内容）'}
      </div>
    )
  }

  const lines = text.split('\n')
  const textColor = variant === 'before' ? 'text-gray-600' : 'text-gray-800'

  return (
    <div className={`text-sm leading-relaxed ${textColor}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />

        const isBullet = /^[-•]\s/.test(trimmed)
        const isNumbered = /^\d+[.)]\s/.test(trimmed)
        const isHeading = /[:：]$/.test(trimmed) && trimmed.length < 30

        if (isBullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-2 py-0.5">
              <span className="text-gray-400 shrink-0">•</span>
              <span>{trimmed.replace(/^[-•]\s*/, '')}</span>
            </div>
          )
        }
        if (isNumbered) {
          return (
            <div key={i} className="py-0.5 font-medium">
              {trimmed}
            </div>
          )
        }
        if (isHeading) {
          return (
            <div key={i} className="pt-2 pb-0.5 font-medium text-gray-900">
              {trimmed}
            </div>
          )
        }
        return (
          <div key={i} className="py-0.5">
            {trimmed}
          </div>
        )
      })}
    </div>
  )
}

const COLLAPSE_THRESHOLD = 300

/** 将 summary 中的 **bold** 转为 React 节点（CompactStatusRow 不走 Markdown 渲染）。 */
function renderPatchSummary(summary: string): React.ReactNode {
  if (!summary.includes('**')) return summary
  const parts = summary.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    const match = part.match(/^\*\*(.+)\*\*$/)
    if (match) {
      return (
        <strong key={`bold-${index}`} className="font-semibold">
          {match[1]}
        </strong>
      )
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
  })
}

/**
 * 已处理（applied / rejected / superseded）状态下的紧凑摘要行。
 * 保留在历史中，让用户清晰看到这条修改的最终命运。
 */
function CompactStatusRow({
  patch,
  tone,
  icon,
  label,
}: {
  patch: PendingPatch
  tone: 'success' | 'neutral' | 'muted'
  icon: React.ReactNode
  label: string
}) {
  const toneClasses = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    neutral: 'border-gray-200 bg-gray-50 text-gray-500',
    muted: 'border-slate-200 bg-slate-50 text-slate-400',
  }[tone]

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${toneClasses} transition-colors`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="font-medium shrink-0">{label}</span>
      <span className="truncate opacity-80">{renderPatchSummary(patch.summary)}</span>
    </div>
  )
}

export function ResumeDiffCard({ patch }: { patch: PendingPatch }) {
  const { applyPatch, rejectPatch } = useResumeContext()
  const [expanded, setExpanded] = useState(false)

  if (patch.status === 'applied') {
    return (
      <CompactStatusRow
        patch={patch}
        tone="success"
        icon={<Check className="h-4 w-4" />}
        label="已应用"
      />
    )
  }
  if (patch.status === 'rejected') {
    return (
      <CompactStatusRow
        patch={patch}
        tone="neutral"
        icon={<X className="h-4 w-4" />}
        label="已拒绝"
      />
    )
  }
  if (patch.status === 'superseded') {
    return (
      <CompactStatusRow
        patch={patch}
        tone="muted"
        icon={<SkipForward className="h-4 w-4" />}
        label="已跳过"
      />
    )
  }

  const beforeText = formatPatchDiffSide(patch.paths, patch.before)
  const afterText = formatPatchDiffSide(patch.paths, patch.after)
  const isLong = beforeText.length > COLLAPSE_THRESHOLD || afterText.length > COLLAPSE_THRESHOLD
  const showFull = expanded || !isLong

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <span className="text-sm font-medium text-blue-800">{renderPatchSummary(patch.summary)}</span>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded ? (
              <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>展开全部 <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">修改前</div>
          <div className={`${!showFull ? 'max-h-48 overflow-hidden relative' : ''}`}>
            <DiffContent text={beforeText} variant="before" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
        </div>
        <div className="p-4 bg-emerald-50/30">
          <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">修改后</div>
          <div className={`${!showFull ? 'max-h-48 overflow-hidden relative' : ''}`}>
            <DiffContent text={afterText} variant="after" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-emerald-50/30 to-transparent" />
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => applyPatch(patch.patch_id)}
          className="flex-1 rounded-lg bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          <Check className="inline-block h-4 w-4 mr-1 -mt-0.5" />
          应用
        </button>
        <button
          onClick={() => rejectPatch(patch.patch_id)}
          className="flex-1 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium py-2 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <X className="inline-block h-4 w-4 mr-1 -mt-0.5" />
          拒绝
        </button>
      </div>
    </div>
  )
}
