import { Wand2, Search, Briefcase, Zap } from "lucide-react";
import type { ReactNode } from "react";
import IntentChips, { type IntentChipItem } from "./IntentChips";

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
  const chips: IntentChipItem[] = [
    {
      icon: Wand2,
      label: "创建简历",
      title: createDefaultPrompt,
      onClick: () => onSendMessage(createDefaultPrompt),
    },
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
      <div className="text-center mb-7">
        <h1 className="font-serifcn text-[2.6rem] leading-tight text-chat-ink dark:text-white tracking-tight">
          我能为你做什么？
        </h1>
      </div>

      {composerSlot && <div className="mb-5">{composerSlot}</div>}

      <IntentChips chips={chips} />
    </div>
  );
}
