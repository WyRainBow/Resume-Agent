import React, { useState } from 'react'
import { Check, ChevronDown, ChevronUp, X, SkipForward } from 'lucide-react'
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext'
import { formatPatchDiffSide, getPatchDiffDisplay } from '../../utils/resumePatch'
import { AgentSpecialCard } from './AgentSpecialCard'
import DiffRichContent from './DiffRichContent'

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

const COLLAPSE_THRESHOLD = 300

const resolvedVariantStyles = {
  success: {
    shell: "border-blue-200/80 bg-chat-surface",
    header: "border-blue-100 bg-blue-50/50",
    title: "text-blue-800",
    summary: "text-chat-ink-muted",
    icon: "text-blue-600",
  },
  default: {
    shell: "border-chat-border/80 bg-chat-surface",
    header: "border-chat-border/60 bg-chat-canvas/60",
    title: "text-chat-ink",
    summary: "text-chat-ink-muted",
    icon: "text-chat-ink-muted",
  },
  muted: {
    shell: "border-chat-border/60 bg-chat-canvas/40",
    header: "border-chat-border/40 bg-chat-canvas/30",
    title: "text-chat-ink-muted",
    summary: "text-chat-ink-muted/80",
    icon: "text-chat-ink-muted",
  },
} as const

function ResolvedPatchCard({
  patch,
  variant,
  icon,
  label,
}: {
  patch: PendingPatch
  variant: keyof typeof resolvedVariantStyles
  icon: React.ReactNode
  label: string
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [contentExpanded, setContentExpanded] = useState(false)
  const styles = resolvedVariantStyles[variant]

  return (
    <div className={`overflow-hidden rounded-xl border shadow-sm ${styles.shell}`}>
      <div className={`flex items-center gap-2.5 px-4 py-2.5 ${styles.header}`}>
        <span className={`shrink-0 ${styles.icon}`}>{icon}</span>
        <span className={`shrink-0 text-sm font-semibold ${styles.title}`}>{label}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${styles.summary}`}>
          {renderPatchSummary(patch.summary)}
        </span>
        <button
          type="button"
          onClick={() => setDetailsExpanded((value) => !value)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-50"
        >
          {detailsExpanded ? (
            <>
              收起
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              展开
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {detailsExpanded && (
        <div className="border-t border-chat-border/60 p-4">
          <PatchDiffGrid
            patch={patch}
            expanded={contentExpanded}
            onToggleExpand={() => setContentExpanded((value) => !value)}
          />
        </div>
      )}
    </div>
  )
}

function PatchDiffGrid({
  patch,
  expanded,
  onToggleExpand,
}: {
  patch: PendingPatch
  expanded: boolean
  onToggleExpand?: () => void
}) {
  const beforeDisplay = getPatchDiffDisplay(patch.paths, patch.before)
  const afterDisplay = getPatchDiffDisplay(patch.paths, patch.after)
  const beforeText = formatPatchDiffSide(patch.paths, patch.before)
  const afterText = formatPatchDiffSide(patch.paths, patch.after)
  const isLong = beforeText.length > COLLAPSE_THRESHOLD || afterText.length > COLLAPSE_THRESHOLD
  const showFull = expanded || !isLong

  return (
    <>
      {isLong && onToggleExpand && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-xs text-chat-accent-deep transition-colors hover:text-chat-accent"
          >
            {expanded ? (
              <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>展开全部 <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-chat-border/70">
        <div className="pr-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-chat-ink-muted">
            修改前
          </div>
          <div className={`${!showFull ? 'relative max-h-48 overflow-hidden' : ''}`}>
            <DiffRichContent display={beforeDisplay} variant="before" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-chat-surface to-transparent" />
            )}
          </div>
        </div>
        <div className="bg-blue-50/40 pl-4 dark:bg-blue-950/20">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-700">
            修改后
          </div>
          <div className={`${!showFull ? 'relative max-h-48 overflow-hidden' : ''}`}>
            <DiffRichContent display={afterDisplay} variant="after" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-blue-50/40 to-transparent" />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/** 「全部应用」条：同一批 ≥2 个待确认 patch 时显示，一键全部合并写回简历。 */
export function ApplyAllPatchesBar({ patches }: { patches: PendingPatch[] }) {
  const { applyPatches } = useResumeContext()
  const pending = patches.filter(p => p.status === 'pending')
  if (pending.length < 2) return null
  return (
    <button
      type="button"
      onClick={() => applyPatches(pending.map(p => p.patch_id))}
      className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-blue-700 hover:border-blue-700"
    >
      <Check className="h-4 w-4" />
      全部应用（{pending.length} 处）
    </button>
  )
}

export function ResumeDiffCard({ patch }: { patch: PendingPatch }) {
  const { applyPatch, rejectPatch } = useResumeContext()
  const [expanded, setExpanded] = useState(false)

  if (patch.status === 'applied') {
    return (
      <ResolvedPatchCard
        patch={patch}
        variant="success"
        icon={<Check className="h-4 w-4" />}
        label="已应用"
      />
    )
  }
  if (patch.status === 'rejected') {
    return (
      <ResolvedPatchCard
        patch={patch}
        variant="default"
        icon={<X className="h-4 w-4" />}
        label="已拒绝"
      />
    )
  }
  if (patch.status === 'superseded') {
    return (
      <ResolvedPatchCard
        patch={patch}
        variant="muted"
        icon={<SkipForward className="h-4 w-4" />}
        label="已跳过"
      />
    )
  }

  const beforeText = formatPatchDiffSide(patch.paths, patch.before)
  const afterText = formatPatchDiffSide(patch.paths, patch.after)
  const isLong = beforeText.length > COLLAPSE_THRESHOLD || afterText.length > COLLAPSE_THRESHOLD

  return (
    <AgentSpecialCard
      variant="accent"
      title={renderPatchSummary(patch.summary)}
      badge={
        isLong ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-chat-accent-deep transition-colors hover:text-chat-accent"
          >
            {expanded ? (
              <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>展开全部 <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        ) : undefined
      }
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => applyPatch(patch.patch_id)}
            className="flex-1 rounded-lg border border-blue-600 bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-blue-700 hover:border-blue-700"
          >
            <Check className="-mt-0.5 mr-1 inline-block h-4 w-4" />
            应用
          </button>
          <button
            type="button"
            onClick={() => rejectPatch(patch.patch_id)}
            className="flex-1 rounded-lg border border-chat-border bg-white dark:bg-slate-800 py-2.5 text-sm font-medium text-chat-ink transition-all active:scale-[0.98] hover:bg-chat-canvas dark:hover:bg-slate-700"
          >
            <X className="-mt-0.5 mr-1 inline-block h-4 w-4" />
            拒绝
          </button>
        </div>
      }
    >
      <PatchDiffGrid patch={patch} expanded={expanded} />
    </AgentSpecialCard>
  )
}
