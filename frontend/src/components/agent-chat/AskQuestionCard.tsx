/**
 * Asking 模式选择框卡片。
 *
 * 后端 agent 调 ask_user_question 工具 → tool_result 带 structured_data
 * {type:"ask_question", questions:[...]} → useToolEventRouter 通用分支
 * upsertStructuredEvent → StructuredCardRegistry 按 type 渲染本卡片。
 *
 * 设计见 knowledge-base/specs/2026-07-12-asking-mode-interaction-design.md:
 * - 每问两选项:直接填写(展开 textarea)/ 直接跳过
 * - 全部问题答完才出现提交按钮
 * - 提交后通过 AskQuestionContext.onSubmit 把答案回传给 CocoChat
 */
import { useContext, useState } from "react";
import { HelpCircle, Send } from "lucide-react";
import { AgentSpecialCard } from "./AgentSpecialCard";
import {
  AskQuestionContext,
  type AskQuestionAnswer,
} from "./AskQuestionContext";
import type { StructuredCardProps } from "./StructuredCardRegistry";

interface QuestionOption {
  label: string;
  description?: string;
}
interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

export function AskQuestionCard({ data }: StructuredCardProps) {
  const ctx = useContext(AskQuestionContext);
  const questions = (data.questions as Question[]) || [];

  // 每问的状态:undefined=未答, "fill"=选了填写, "skip"=选了跳过
  const [choices, setChoices] = useState<Record<number, "fill" | "skip">>({});
  const [fillValues, setFillValues] = useState<Record<number, string>>({});

  const allAnswered = questions.length > 0 && questions.every((_, i) => choices[i]);
  const submitted = ctx?.submitted ?? false;

  const handleChoose = (idx: number, choice: "fill" | "skip") => {
    setChoices((prev) => ({ ...prev, [idx]: choice }));
  };

  const handleSubmit = () => {
    console.log("[AskQuestionCard] handleSubmit clicked", { allAnswered, submitted, hasCtx: !!ctx, hasOnSubmit: !!ctx?.onSubmit, choices, fillValues, questionsCount: questions.length });
    if (!allAnswered || submitted) {
      console.log("[AskQuestionCard] 提交被拦:", { allAnswered, submitted });
      return;
    }
    const answers: AskQuestionAnswer[] = questions.map((q, i) => ({
      question: q.question,
      header: q.header,
      choice: choices[i],
      value: choices[i] === "fill" ? (fillValues[i] || "").trim() : undefined,
    }));
    console.log("[AskQuestionCard] 调 ctx.onSubmit", { answers });
    ctx?.onSubmit(answers);
  };

  return (
    <AgentSpecialCard
      icon={<HelpCircle className="size-4" />}
      title="确认几项信息"
      subtitle="逐项选择，答完点提交会自动继续"
      variant="accent"
      footer={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitted}
          className={`flex w-full items-center justify-center gap-2 border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 px-4 py-2 text-sm font-semibold transition-all ${
            allAnswered && !submitted
              ? "bg-chat-accent text-white shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              : "cursor-not-allowed bg-chat-canvas/50 text-chat-ink-muted"
          }`}
        >
          <Send className="size-4" />
          {submitted ? "已提交" : "提交并继续"}
        </button>
      }
    >
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const choice = choices[idx];
          return (
            <div key={`q-${idx}`} className="border-b border-chat-border/40 pb-3 last:border-0 last:pb-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="shrink-0 border border-chat-accent/60 bg-chat-accent/10 px-2 py-0.5 text-[11px] font-semibold text-chat-accent-deep">
                  {q.header}
                </span>
                <span className="text-sm text-chat-ink">{q.question}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleChoose(idx, "fill")}
                  className={`flex-1 border-2 px-3 py-2 text-xs font-medium transition-all ${
                    choice === "fill"
                      ? "border-chat-accent bg-chat-accent text-white"
                      : "border-black fresh:border-slate-200/40 bg-chat-canvas/50 text-chat-ink hover:border-chat-accent/60"
                  }`}
                >
                  直接填写
                </button>
                <button
                  type="button"
                  onClick={() => handleChoose(idx, "skip")}
                  className={`flex-1 border-2 px-3 py-2 text-xs font-medium transition-all ${
                    choice === "skip"
                      ? "border-black fresh:border-slate-200 bg-chat-ink-muted text-white"
                      : "border-black fresh:border-slate-200/40 bg-chat-canvas/50 text-chat-ink hover:border-black fresh:border-slate-200/70"
                  }`}
                >
                  直接跳过
                </button>
              </div>
              {choice === "fill" && (
                <textarea
                  value={fillValues[idx] || ""}
                  onChange={(e) =>
                    setFillValues((prev) => ({ ...prev, [idx]: e.target.value }))
                  }
                  placeholder="在这里填写（填什么都行，GPA、排名、奖项名都OK）"
                  rows={2}
                  disabled={submitted}
                  className="mt-2 w-full resize-none border border-black fresh:border-slate-200/40 bg-white px-3 py-2 text-sm text-chat-ink placeholder:text-chat-ink-muted/60 focus:border-chat-accent focus:outline-none disabled:bg-chat-canvas/40"
                />
              )}
              {choice === "skip" && (
                <div className="mt-2 text-xs text-chat-ink-muted">
                  ✓ 该项保持原样，不补充
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AgentSpecialCard>
  );
}

export default AskQuestionCard;
