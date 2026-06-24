import { Wand2, Search, Briefcase, Zap } from "lucide-react";
import type { ReactNode } from "react";

interface ChatEmptyStateProps {
  /** 「创建默认简历」提示语，点击「创建简历」时自动发送 */
  createDefaultPrompt: string;
  onSendMessage: (text: string) => void;
  onSetInput: (text: string) => void;
  /** 居中展示的输入框（参考 Manus：开屏时输入框在正中，标题在上、引导胶囊在下） */
  composerSlot?: ReactNode;
}

/**
 * Agent 对话页空态：欢迎语 + 居中输入框 + 一排紧凑引导胶囊（参考 Manus）。
 * 图标统一暖墨强调色（Color Consistency Lock）。
 */
export default function ChatEmptyState({
  createDefaultPrompt,
  onSendMessage,
  onSetInput,
  composerSlot,
}: ChatEmptyStateProps) {
  const chips: { icon: typeof Wand2; title: string; desc: string; autoSend?: boolean }[] = [
    { icon: Wand2, title: "创建简历", desc: createDefaultPrompt, autoSend: true },
    { icon: Search, title: "岗位分析", desc: "分析这个 JD，看看我的简历还要补充什么" },
    { icon: Briefcase, title: "模拟面试", desc: "针对我的简历，出几道后端技术面试题" },
    { icon: Zap, title: "快速问答", desc: "怎么写出让 HR 眼前一亮的简历总结" },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 transition-all duration-500 ease-in-out flex-1 flex flex-col justify-center">
      <div className="text-center mb-7">
        <h1 className="font-serifcn text-[2.6rem] leading-tight text-chat-ink dark:text-white tracking-tight">
          我能为你做什么？
        </h1>
      </div>

      {composerSlot && <div className="mb-5">{composerSlot}</div>}

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {chips.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              title={item.desc}
              onClick={() => (item.autoSend ? onSendMessage(item.desc) : onSetInput(item.desc))}
              className="inline-flex items-center gap-2 rounded-full border border-chat-border bg-chat-surface px-4 py-2 text-sm font-medium text-chat-ink transition-all hover:border-chat-accent/50 hover:bg-chat-accent/5 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"
            >
              <Icon className="w-4 h-4 text-chat-accent dark:text-amber-400" strokeWidth={2} />
              {item.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
