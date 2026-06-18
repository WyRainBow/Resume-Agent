/**
 * AI 助手 Dock —— 统一的右下角浮动入口
 * 把分散的简历 AI 能力收敛到一个可发现的常驻面板：JD 优化（简历级）+ 逐字段能力指引。
 * 纯增量、复用既有弹窗与按钮，不改动既有逐字段流程，也不与 Agent 对话页重复。
 */
import { useState } from 'react'
import { Sparkles, X, Target, Wand2, SpellCheck, MousePointerClick } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface AiCopilotDockProps {
  /** 打开「针对 JD 优化」弹窗 */
  onJdOptimize: () => void
  /** JD 是否已填写（决定 JD 优化是否可用） */
  jdReady: boolean
  /** 跳转/聚焦到 JD 输入区 */
  onFocusJd: () => void
}

export default function AiCopilotDock({ onJdOptimize, jdReady, onFocusJd }: AiCopilotDockProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[300px] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">AI 助手</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {/* 简历级动作 */}
          <div className="p-3 space-y-2">
            <button
              onClick={() => { if (jdReady) { onJdOptimize(); setOpen(false) } else { onFocusJd(); setOpen(false) } }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-950/40 transition-colors text-left"
            >
              <Target className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100">针对 JD 优化简历</div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {jdReady ? '按目标岗位逐字段优化' : '先在下方填写职位描述'}
                </div>
              </div>
            </button>

            {/* 逐字段能力指引 */}
            <div className="pt-1">
              <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 px-1 mb-1.5">字段内 AI 能力</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2.5 px-1 text-xs text-neutral-600 dark:text-neutral-300">
                  <MousePointerClick className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  选中正文文字 → 划词 AI 改写
                </li>
                <li className="flex items-center gap-2.5 px-1 text-xs text-neutral-600 dark:text-neutral-300">
                  <Wand2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  富文本工具栏「AI 润色」多轮优化
                </li>
                <li className="flex items-center gap-2.5 px-1 text-xs text-neutral-600 dark:text-neutral-300">
                  <SpellCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  工具栏「语法体检」一键修复
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 浮动入口按钮 */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="AI 助手"
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all',
          'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white hover:scale-105 active:scale-95',
          open && 'ring-4 ring-purple-500/20'
        )}
      >
        <Sparkles className="w-5 h-5" />
      </button>
    </div>
  )
}
