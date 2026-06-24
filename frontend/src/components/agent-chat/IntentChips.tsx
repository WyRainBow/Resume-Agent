import type { LucideIcon } from "lucide-react";

export interface IntentChipItem {
  icon: LucideIcon;
  /** 胶囊上展示的文案 */
  label: string;
  /** 悬浮提示，默认取 label */
  title?: string;
  onClick: () => void;
}

interface IntentChipsProps {
  chips: IntentChipItem[];
  /** 容器对齐，默认居中（与空态保持一致） */
  className?: string;
}

/**
 * 一排紧凑意图胶囊（参考 Manus）。纯展示，动作由调用方通过 onClick 注入。
 * 图标统一暖墨强调色（Color Consistency Lock）。空态与问候引导共用同一套样式。
 */
export default function IntentChips({
  chips,
  className = "justify-center",
}: IntentChipsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {chips.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            type="button"
            title={item.title ?? item.label}
            onClick={item.onClick}
            className="inline-flex items-center gap-2 rounded-full border border-chat-border bg-chat-surface px-4 py-2 text-sm font-medium text-chat-ink transition-all hover:border-chat-accent/50 hover:bg-chat-accent/5 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"
          >
            <Icon className="w-4 h-4 text-chat-accent dark:text-amber-400" strokeWidth={2} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
