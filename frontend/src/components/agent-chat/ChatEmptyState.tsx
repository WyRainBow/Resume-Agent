import { Wand2, Upload, Search, Briefcase, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import IntentChips, { type IntentChipItem } from "./IntentChips";

interface ChatEmptyStateProps {
  /** 对话创建简历（直接发送创建提示语） */
  onCreateResume: () => void;
  /** 导入已有简历（打开 AI 智能导入：PDF / Word / 文本） */
  onImportResume: () => void;
  /** 次级胶囊：把示例文案填入输入框，由用户确认后发送 */
  onSetInput: (text: string) => void;
  /** 居中展示的输入框（参考 Manus：开屏时输入框在正中，标题在上、引导在下） */
  composerSlot?: ReactNode;
}

interface PrimaryAction {
  icon: LucideIcon;
  title: string;
  desc: string;
  onClick: () => void;
}

/**
 * Agent 对话页空态：欢迎语 + 两个主入口（创建 / 导入）+ 居中输入框 + 一排次级引导胶囊。
 * 主入口承载新用户的第一动作（先有简历），次级承载依赖简历的进阶能力。
 * 图标统一暖墨强调色（Color Consistency Lock）。
 */
export default function ChatEmptyState({
  onCreateResume,
  onImportResume,
  onSetInput,
  composerSlot,
}: ChatEmptyStateProps) {
  const primaryActions: PrimaryAction[] = [
    {
      icon: Wand2,
      title: "对话创建简历",
      desc: "说说你的经历、AI 从零帮你生成",
      onClick: onCreateResume,
    },
    {
      icon: Upload,
      title: "导入已有简历",
      desc: "上传 PDF / Word、自动结构化并优化",
      onClick: onImportResume,
    },
  ];

  const secondaryChips: IntentChipItem[] = [
    {
      icon: Search,
      label: "岗位分析",
      title: "分析这个 JD，看看我的简历还要补充什么",
      onClick: () => onSetInput("分析这个 JD，看看我的简历还要补充什么"),
    },
    {
      icon: Briefcase,
      label: "模拟面试",
      title: "针对我的简历，出几道后端技术面试题",
      onClick: () => onSetInput("针对我的简历，出几道后端技术面试题"),
    },
    {
      icon: Zap,
      label: "快速问答",
      title: "怎么写出让 HR 眼前一亮的简历总结",
      onClick: () => onSetInput("怎么写出让 HR 眼前一亮的简历总结"),
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 transition-all duration-500 ease-in-out flex-1 flex flex-col justify-center">
      <div className="text-center mb-6">
        <h1 className="font-serifcn text-[2.6rem] leading-tight text-chat-ink dark:text-white tracking-tight">
          我能为你做什么？
        </h1>
        <p className="mt-2 text-sm text-chat-ink-muted dark:text-slate-400">
          从零创建或导入简历、AI 帮你优化内容、匹配岗位、模拟面试
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {primaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              className="group flex items-start gap-3 rounded-2xl border border-chat-border bg-chat-surface p-4 text-left transition-all hover:border-chat-accent/50 hover:bg-chat-accent/5 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chat-accent/10 text-chat-accent dark:bg-amber-500/15 dark:text-amber-400">
                <Icon className="size-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-chat-ink dark:text-slate-100">
                  {action.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-chat-ink-muted dark:text-slate-400">
                  {action.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {composerSlot && <div className="mb-5">{composerSlot}</div>}

      <IntentChips chips={secondaryChips} />
    </div>
  );
}
