/**
 * 编辑模式选择器组件
 * 在编辑区顶部显示，支持切换"编辑模式"和"对话模式"
 */
import { Edit, MessageSquare, Sparkles } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export type EditMode = 'edit' | 'conversation'

interface EditModeSelectorProps {
  currentMode: EditMode
  onModeChange: (mode: EditMode) => void
  disabled?: boolean
}

const MODES = [
  {
    id: 'edit' as EditMode,
    label: '编辑模式',
    icon: Edit,
    description: '手动编辑简历内容'
  },
  {
    id: 'conversation' as EditMode,
    label: '对话模式',
    icon: MessageSquare,
    description: 'AI 对话式生成简历',
    badge: 'NEW'
  }
] as const

export function EditModeSelector({
  currentMode,
  onModeChange,
  disabled = false
}: EditModeSelectorProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {MODES.map((mode) => {
        const isActive = currentMode === mode.id
        const Icon = mode.icon

        return (
          <button
            key={mode.id}
            onClick={() => !disabled && onModeChange(mode.id)}
            disabled={disabled}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              'flex-1 max-w-[180px]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isActive
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1 text-left">{mode.label}</span>

            {/* NEW 徽章 */}
            {mode.badge && !isActive && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full shadow-sm">
                {mode.badge}
              </span>
            )}

            {/* 激活状态下的星星装饰 */}
            {isActive && mode.id === 'conversation' && (
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default EditModeSelector
