import React, { useState } from 'react'
import { Check, ChevronDown, ChevronUp, X, SkipForward } from 'lucide-react'
import { useOptionalResumeContext, type PendingPatch } from '../../contexts/ResumeContext'
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
    shell: "border-black fresh:border-slate-200 bg-chat-surface",
    header: "border-black fresh:border-slate-200/70 bg-blue-50/50",
    title: "text-blue-800",
    summary: "text-chat-ink-muted",
    icon: "text-blue-600",
  },
  default: {
    shell: "border-black fresh:border-slate-200 bg-chat-surface",
    header: "border-black fresh:border-slate-200/70 bg-chat-canvas/60",
    title: "text-chat-ink",
    summary: "text-chat-ink-muted",
    icon: "text-chat-ink-muted",
  },
  muted: {
    shell: "border-black fresh:border-slate-200/50 bg-chat-canvas/40",
    header: "border-black fresh:border-slate-200/30 bg-chat-canvas/30",
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
    <div className={`overflow-hidden rounded-none fresh:rounded-lg border-2 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm ${styles.shell}`}>
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

/** 「全部应用」条：同一批 ≥2 个待确认 patch 时显示，一键全部合并写回简历。置顶常驻（sticky），滚动浏览卡片时不消失。 */
export function ApplyAllPatchesBar({ patches }: { patches: PendingPatch[] }) {
  // 用可选 context：ResumeProvider 缺失时（HMR context 失配、Provider 外渲染
  // 如历史快照）优雅返回 null，而非抛错崩掉整棵卡片子树。
  const ctx = useOptionalResumeContext()
  const pending = patches.filter(p => p.status === 'pending')
  if (!ctx || pending.length < 2) return null
  return (
    <button
      type="button"
      onClick={() => ctx.applyPatches(pending.map(p => p.patch_id))}
      className="sticky top-2 z-10 mb-1 flex w-full items-center justify-center gap-1.5 rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm transition-all hover:bg-blue-700 hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
    >
      <Check className="h-4 w-4" />
      全部应用（{pending.length} 处）
    </button>
  )
}

export function ResumeDiffCard({ patch, defaultCollapsed = false }: { patch: PendingPatch; defaultCollapsed?: boolean }) {
  // 可选 context：缺失时卡片仍渲染（可读 diff），应用/拒绝按钮 no-op，
  // 不抛错崩溃（对齐 ConversationArtifactStack 的 useOptionalResumeContext）。
  const ctx = useOptionalResumeContext()
  const applyPatch = ctx?.applyPatch
  const rejectPatch = ctx?.rejectPatch
  const [expanded, setExpanded] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

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

  // 折叠态：一行摘要 + 小号应用/拒绝按钮，点摘要展开看 diff（整份优化多卡时降低 review 负担）
  if (collapsed) {
    return (
      <div className="overflow-hidden rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-chat-surface shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-chat-ink">
              {renderPatchSummary(patch.summary)}
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-chat-accent-deep">
              看修改 <ChevronDown className="h-3.5 w-3.5" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => applyPatch?.(patch.patch_id)}
            className="inline-flex shrink-0 items-center gap-1 rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition-all hover:bg-blue-700"
          >
            <Check className="h-3.5 w-3.5" />
            应用
          </button>
          <button
            type="button"
            onClick={() => rejectPatch?.(patch.patch_id)}
            className="inline-flex shrink-0 items-center rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-white px-2 py-1 text-xs text-chat-ink transition-all hover:bg-chat-canvas dark:bg-slate-800 dark:hover:bg-slate-700"
            title="拒绝"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
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
        isLong || defaultCollapsed ? (
          <div className="flex items-center gap-2">
            {isLong && (
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
            )}
            {defaultCollapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-1 text-xs text-chat-ink-muted transition-colors hover:text-chat-ink"
              >
                收起卡片 <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : undefined
      }
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => applyPatch?.(patch.patch_id)}
            className="flex-1 rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm transition-all hover:bg-blue-700 hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            <Check className="-mt-0.5 mr-1 inline-block h-4 w-4" />
            应用
          </button>
          <button
            type="button"
            onClick={() => rejectPatch?.(patch.patch_id)}
            className="flex-1 rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-white dark:bg-slate-800 py-2.5 text-sm font-medium text-chat-ink shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm transition-all hover:bg-chat-canvas hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] dark:hover:bg-slate-700"
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
