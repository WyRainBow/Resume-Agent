import { Asterisk } from "lucide-react";

/**
 * 处理中「思考 / 解析」占位动画：星芒（Claude 风格 asterisk）缓慢旋转 + 文案脉动。
 * 用于流式开始前（还没有任何 thought / answer 可见）时占位，避免空白。
 */
export function ThinkingIndicator({ label = "思考中…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1 text-chat-ink-muted">
      <Asterisk
        className="h-5 w-5 shrink-0 animate-spin text-chat-accent [animation-duration:1.6s]"
        strokeWidth={2.5}
        aria-hidden
      />
      <span className="text-sm font-medium tracking-wide animate-pulse">{label}</span>
    </div>
  );
}
