/**
 * 基本信息字段「显示样式」紧凑分段切换：标签 + 值 / 仅值。
 * 原「图标（emoji）」样式已废弃，只保留这两种。
 * 设计：knowledge-base/specs/2026-06-24-per-field-display-style-design.md
 */
import { type ReactNode } from 'react'
import { Tag, Minus } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { FieldLabelMode } from '../types'

interface FieldStyleToggleProps {
  mode: FieldLabelMode
  onModeChange: (mode: FieldLabelMode) => void
}

const OPTIONS: { mode: FieldLabelMode; Icon: typeof Tag; title: string }[] = [
  { mode: 'text', Icon: Tag, title: '标签 + 值（如 邮箱：xxx）' },
  { mode: 'none', Icon: Minus, title: '仅值（xxx）' },
]

/** 即时悬浮提示（150ms 淡入，无原生 title 的 1~2s 延迟），支持深色模式 */
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/tip:opacity-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {label}
      </span>
    </span>
  )
}

export default function FieldStyleToggle({ mode, onModeChange }: FieldStyleToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5">
        {OPTIONS.map(({ mode: m, Icon, title }) => (
          <Tip key={m} label={title}>
            <button
              type="button"
              onClick={() => onModeChange(m)}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md transition-all active:scale-90',
                mode === m
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </Tip>
        ))}
      </div>
    </div>
  )
}
