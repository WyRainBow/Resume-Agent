/**
 * 结构化事件 type → 卡片组件注册表(与后端「structured 通用透传」对应的前端半边)。
 *
 * 后端任何工具把 {type, payload} 放进 ToolResult.system 即可直达这里:
 * 已注册的 type 渲染专属卡片;未注册的 type 渲染折叠 JSON 兜底卡(可观测,
 * 不静默丢弃)。新增一种卡片 = 写组件 + 在 REGISTRY 加一行,无需改事件管线。
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Puzzle } from "lucide-react";
import ApprovalCard from "@/components/agent-chat/ApprovalCard";

export interface StructuredEventData {
  type: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StructuredCardProps {
  data: StructuredEventData;
}

function FallbackJsonCard({ data }: StructuredCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-none border border-black/40 bg-chat-canvas/60 px-3 py-2 text-xs text-chat-ink-muted dark:border-slate-700 dark:bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 font-mono"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Puzzle className="size-3" />
        {data.type}
      </button>
      {open && (
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[10px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

const REGISTRY: Record<string, React.FC<StructuredCardProps>> = {
  approval_request: ApprovalCard,
};

export function StructuredCards({
  items,
  className = "",
}: {
  items: StructuredEventData[];
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => {
        const Component = REGISTRY[item.type] ?? FallbackJsonCard;
        return <Component key={`structured-${item.type}-${index}`} data={item} />;
      })}
    </div>
  );
}
