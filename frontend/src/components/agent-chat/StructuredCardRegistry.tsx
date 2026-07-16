/**
 * 结构化事件 type → 卡片组件注册表(与后端「structured 通用透传」对应的前端半边)。
 *
 * 后端任何工具把 {type, payload} 放进 ToolResult.system 即可直达这里:
 * 已注册的 type 渲染专属卡片;未注册的 type 渲染折叠 JSON 兜底卡(可观测,
 * 不静默丢弃)。新增一种卡片 = 写组件 + 在 REGISTRY 加一行,无需改事件管线。
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Puzzle } from "lucide-react";
import AskQuestionCard from "./AskQuestionCard";
import {
  AskQuestionContext,
  type AskQuestionContextValue,
} from "./AskQuestionContext";
import ResumeSuggestionsCard from "./ResumeSuggestionsCard";
import { filterAgentStructuredEvents } from "@/lib/runtimeEnv";
import { classifyStructuredToolPresentation } from "@/utils/toolPresentation";
import type { ResumeSuggestion } from "@/types/resumeDiagnosis";

export interface StructuredEventData {
  type: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StructuredCardProps {
  data: StructuredEventData;
  /** 卡内动作按钮（如建议卡「帮我按建议修改」）：以用户消息发出一轮对话 */
  onAction?: (message: string) => void;
}

/** 建议轮（cv_suggestions_agent）的只读建议卡：type="resume_suggestions"。
 *  payload.suggestions 为空/形状不对时不渲染（数据缺失兜底，不崩不裸露）。 */
function ResumeSuggestionsStructuredCard({ data, onAction }: StructuredCardProps) {
  const rawSuggestions = (data.payload as { suggestions?: unknown } | undefined)
    ?.suggestions;
  if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) {
    console.warn("[StructuredCards] resume_suggestions payload 无建议，跳过渲染");
    return null;
  }
  return (
    <ResumeSuggestionsCard
      suggestions={rawSuggestions as ResumeSuggestion[]}
      onApply={
        onAction ? () => onAction("按照诊断建议帮我修改简历") : undefined
      }
    />
  );
}

function FallbackJsonCard({ data }: StructuredCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-none fresh:rounded-lg border border-black fresh:border-slate-200/40 bg-chat-canvas/60 px-3 py-2 text-xs text-chat-ink-muted dark:border-slate-700 dark:bg-slate-900/60">
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

// 通用结构化透传注册表:邮件确认卡(approval_request → ApprovalCard)下线后
// 首个注册类型是 AskQuestionCard(Asking 模式),未注册 type 走 FallbackJsonCard
// 兜底不静默丢弃。新增一种卡片 = 写组件 + 在这里加一行。
const REGISTRY: Record<string, React.FC<StructuredCardProps>> = {
  ask_question: AskQuestionCard,
  resume_suggestions: ResumeSuggestionsStructuredCard,
};

export function StructuredCards({
  items,
  className = "",
  askQuestionHandler,
  onAction,
}: {
  items: StructuredEventData[];
  className?: string;
  /** Asking 模式提交回调;不传则 AskQuestionCard 拿不到 onSubmit(开发期可见、但提交无效) */
  askQuestionHandler?: AskQuestionContextValue;
  /** 卡内动作按钮回调（如建议卡 apply chip）；不传则相应按钮不渲染 */
  onAction?: (message: string) => void;
}) {
  const visibleItems = filterAgentStructuredEvents(items).filter(
    (item) => classifyStructuredToolPresentation(item.type) === "artifact",
  );
  if (!visibleItems || visibleItems.length === 0) return null;
  const content = (
    <div className={`space-y-3 ${className}`}>
      {visibleItems.map((item, index) => {
        const Component = REGISTRY[item.type] ?? FallbackJsonCard;
        return (
          <Component
            key={`structured-${item.type}-${index}`}
            data={item}
            onAction={onAction}
          />
        );
      })}
    </div>
  );
  // 含 ask_question 卡片时,用 Context 把 onSubmit 注入进去(否则卡片拿不到回调)
  const hasAskQuestion = visibleItems.some((i) => i.type === "ask_question");
  if (hasAskQuestion && askQuestionHandler) {
    return (
      <AskQuestionContext.Provider value={askQuestionHandler}>
        {content}
      </AskQuestionContext.Provider>
    );
  }
  return content;
}
