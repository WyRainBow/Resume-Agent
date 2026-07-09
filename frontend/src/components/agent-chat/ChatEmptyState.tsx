import { Wand2, Upload, FolderOpen, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ChatEmptyStateProps {
  /** 对话创建简历（引导用户说经历，AI 从零生成） */
  onCreateResume: () => void;
  /** 导入已有简历（打开 AI 智能导入：PDF / Word / 文本） */
  onImportResume: () => void;
  /** 选择已有简历（打开简历选择面板） */
  onSelectExisting: () => void;
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
 * Agent 对话页空态：欢迎语 + 三个主入口（创建 / 导入 / 选择已有）+ 居中输入框。
 * 三条上手路径平等呈现，让用户自己选，而非默认塞一份占位简历。
 * 图标统一暖墨强调色（Color Consistency Lock）。
 */
export default function ChatEmptyState({
  onCreateResume,
  onImportResume,
  onSelectExisting,
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
    {
      icon: FolderOpen,
      title: "选择已有简历",
      desc: "从你存过的简历里挑一份继续",
      onClick: onSelectExisting,
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 transition-all duration-500 ease-in-out flex-1 flex flex-col justify-center">
      <div className="text-center mb-6">
        <h1 className="font-serifcn text-[2.6rem] leading-tight text-chat-ink dark:text-white tracking-tight">
          我能为你做什么？
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {primaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              className="group flex items-start gap-3 rounded-none border-2 border-black bg-chat-surface p-4 text-left shadow-[3px_3px_0px_0px_#000000] transition-all hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] dark:border-white dark:bg-slate-800/60 dark:shadow-[3px_3px_0px_0px_#ffffff]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-none border border-black bg-chat-accent/10 text-chat-accent dark:border-white dark:bg-amber-500/15 dark:text-amber-400">
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
    </div>
  );
}
