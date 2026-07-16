import { useState } from "react";
import { Check, Copy, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import type { Message } from "@/types/chat";

const ACTION_BTN =
  "rounded-md p-1.5 transition-all duration-200 hover:bg-chat-user-bubble hover:text-chat-ink hover:scale-110 active:scale-90 dark:hover:bg-slate-800";

interface ConversationFeedbackBarProps {
  messages: Message[];
  isProcessing: boolean;
  onRegenerate: () => void;
}

/**
 * 对话流唯一的反馈栏（复制 / 赞 / 踩 / 重新生成），渲染在消息流最底部。
 *
 * 取代原先 MessageTimeline 里每条 assistant 消息各自一排的反馈按钮——
 * 整份优化多子轮时会出现 N 排复制按钮（2026-07-15 实测 5 排/8 个），且
 * 永远排在简历选择面板之前。上收为单点后：只绑最后一条 assistant 回复、
 * 空闲时显示、天然位于所有面板之后。
 */
export default function ConversationFeedbackBar({
  messages,
  isProcessing,
  onRegenerate,
}: ConversationFeedbackBarProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | undefined>();

  const lastAssistant = [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant" && (msg.content || "").trim());
  if (isProcessing || !lastAssistant) return null;

  return (
    <div className="mt-1 flex items-center gap-0.5 text-chat-ink-muted/70">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(lastAssistant.content);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className={ACTION_BTN}
        title="复制最新回复"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600 animate-icon-pop" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() =>
          setFeedback((previous) => (previous === "like" ? undefined : "like"))
        }
        className={ACTION_BTN}
        title="赞"
      >
        <ThumbsUp
          className={`h-4 w-4 ${feedback === "like" ? "fill-emerald-500/25 text-emerald-600" : ""}`}
        />
      </button>
      <button
        type="button"
        onClick={() =>
          setFeedback((previous) =>
            previous === "dislike" ? undefined : "dislike",
          )
        }
        className={ACTION_BTN}
        title="踩"
      >
        <ThumbsDown
          className={`h-4 w-4 ${feedback === "dislike" ? "fill-rose-500/25 text-rose-600" : ""}`}
        />
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        className={`${ACTION_BTN} group/act`}
        title="重新生成"
      >
        <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover/act:-rotate-180" />
      </button>
    </div>
  );
}
