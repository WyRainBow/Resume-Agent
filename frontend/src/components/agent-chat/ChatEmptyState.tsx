import { Wand2, Search, Briefcase, Zap } from "lucide-react";

interface ChatEmptyStateProps {
  /** 「创建默认简历」提示语，点击「创建简历」卡片时自动发送 */
  createDefaultPrompt: string;
  onSendMessage: (text: string) => void;
  onSetInput: (text: string) => void;
}

/**
 * Agent 对话页空态：欢迎语 + 四张引导卡。
 * 从 SophiaChat 抽出的纯展示组件，行为与原内联实现一致。
 */
export default function ChatEmptyState({
  createDefaultPrompt,
  onSendMessage,
  onSetInput,
}: ChatEmptyStateProps) {
  const cards = [
    {
      icon: <Wand2 className="w-5 h-5 text-amber-500" />,
      title: "创建简历",
      desc: createDefaultPrompt,
      color: "bg-amber-50 dark:bg-amber-900/20",
      autoSend: true,
    },
    {
      icon: <Search className="w-5 h-5 text-blue-500" />,
      title: "岗位分析",
      desc: "“分析这个 JD，看我的简历还需要补充什么？”",
      color: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      icon: <Briefcase className="w-5 h-5 text-emerald-500" />,
      title: "模拟面试",
      desc: "“针对我的简历，问我几个后端开发的技术问题。”",
      color: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      icon: <Zap className="w-5 h-5 text-indigo-500" />,
      title: "快速问答",
      desc: "“如何写出一份让 HR 眼前一亮的简历总结？”",
      color: "bg-indigo-50 dark:bg-indigo-900/20",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 transition-all duration-500 ease-in-out flex-1 flex flex-col">
      {/* 顶部占位，控制下移比例 */}
      <div className="flex-[0.8]" />

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-chat-ink dark:text-white mb-3 tracking-tight">
          你好：我是你的 Resume AI 助手
        </h1>
        <p className="text-chat-ink-muted dark:text-slate-400 text-lg max-w-md mx-auto">
          试试说「{createDefaultPrompt}」，我会在对话区创建并展示；也可以让我优化、诊断已有简历。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {cards.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              const text = item.desc.replace(/[“”]/g, "");
              if ("autoSend" in item && item.autoSend) {
                onSendMessage(text);
              } else {
                onSetInput(text);
              }
            }}
            className="flex flex-col items-start p-4 rounded-xl border border-chat-border dark:border-slate-800 bg-chat-surface dark:bg-slate-900 hover:border-chat-accent/50 dark:hover:border-amber-500/30 hover:shadow-md transition-all text-left group"
          >
            <div
              className={`p-2 rounded-lg ${item.color} mb-3 group-hover:scale-110 transition-transform`}
            >
              {item.icon}
            </div>
            <h3 className="font-semibold text-chat-ink dark:text-white mb-1">
              {item.title}
            </h3>
            <p className="text-sm text-chat-ink-muted dark:text-slate-400 line-clamp-2">
              {item.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
