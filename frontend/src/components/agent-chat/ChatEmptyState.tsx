import { Wand2, Search, Briefcase, Zap } from "lucide-react";

interface ChatEmptyStateProps {
  /** 「创建默认简历」提示语，点击「创建简历」卡片时自动发送 */
  createDefaultPrompt: string;
  onSendMessage: (text: string) => void;
  onSetInput: (text: string) => void;
}

/**
 * Agent 对话页空态：欢迎语 + 四张引导卡。
 * 从 SophiaChat 抽出的纯展示组件。图标统一暖墨强调色（Color Consistency Lock，不用彩虹色）。
 */
export default function ChatEmptyState({
  createDefaultPrompt,
  onSendMessage,
  onSetInput,
}: ChatEmptyStateProps) {
  const cards: { icon: typeof Wand2; title: string; desc: string; autoSend?: boolean }[] = [
    { icon: Wand2, title: "创建简历", desc: createDefaultPrompt, autoSend: true },
    { icon: Search, title: "岗位分析", desc: "分析这个 JD，看看我的简历还要补充什么" },
    { icon: Briefcase, title: "模拟面试", desc: "针对我的简历，出几道后端技术面试题" },
    { icon: Zap, title: "快速问答", desc: "怎么写出让 HR 眼前一亮的简历总结" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 transition-all duration-500 ease-in-out flex-1 flex flex-col">
      {/* 顶部占位，控制下移比例 */}
      <div className="flex-[0.6]" />

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-chat-ink dark:text-white mb-3 tracking-tight">
          你好，我是你的 Resume AI 助手
        </h1>
        <p className="text-chat-ink-muted dark:text-slate-400 text-lg max-w-md mx-auto">
          试试说「{createDefaultPrompt}」，我会直接在对话区帮你创建；也能优化、诊断你已有的简历。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {cards.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={() => (item.autoSend ? onSendMessage(item.desc) : onSetInput(item.desc))}
              className="flex flex-col items-start p-4 rounded-xl border border-chat-border dark:border-slate-800 bg-chat-surface dark:bg-slate-900 hover:border-chat-accent/50 dark:hover:border-amber-500/30 hover:shadow-md active:scale-[0.98] transition-all text-left group"
            >
              <div className="p-2 rounded-lg bg-chat-accent/10 dark:bg-amber-500/15 mb-3 group-hover:scale-105 transition-transform">
                <Icon className="w-5 h-5 text-chat-accent dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-chat-ink dark:text-white mb-1">
                {item.title}
              </h3>
              <p className="text-sm text-chat-ink-muted dark:text-slate-400 line-clamp-2">
                {item.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
