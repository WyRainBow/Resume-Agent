import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Lightbulb,
  LockKeyhole,
  PencilLine,
  Sparkles,
} from "lucide-react";

import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";
import type {
  ResumeSuggestion,
  ResumeSuggestionSeverity,
} from "@/types/resumeDiagnosis";

const SECTION_LABELS: Record<string, string> = {
  overall: "整体建议",
  basic: "基本信息",
  education: "教育经历",
  experience: "工作经历",
  projects: "项目经历",
  skills: "专业技能",
};

const SEVERITY_META: Record<
  ResumeSuggestionSeverity,
  { label: string; className: string; icon: typeof CircleAlert }
> = {
  critical: {
    label: "重要",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
    icon: CircleAlert,
  },
  warning: {
    label: "建议优化",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    icon: AlertTriangle,
  },
  suggestion: {
    label: "可选提升",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200",
    icon: Lightbulb,
  },
};

export default function ResumeSuggestionsCard({
  suggestions,
  onApply,
  onApplyOne,
}: {
  suggestions: ResumeSuggestion[];
  /** 传入则显示「全部按建议修改」，点击触发按诊断建议整体改简历 */
  onApply?: () => void;
  /** 传入则在 proposed 条显示「帮我改这条」，点击只改当前这一条（1-based 序号 + 标题） */
  onApplyOne?: (index: number, title: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, suggestions.length - 1));
  const active = suggestions[safeIndex];
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    suggestions.forEach((item) => {
      const label = SECTION_LABELS[item.section] || item.section || "整体建议";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [suggestions]);

  if (!active) return null;
  const severity = SEVERITY_META[active.severity];
  const SeverityIcon = severity.icon;

  return (
    <AgentSpecialCard
      icon={<Lightbulb className="size-4" />}
      title="简历修改建议"
      subtitle={`诊断出 ${suggestions.length} 条具体建议`}
      badge={
        <span className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          <LockKeyhole className="size-3" />
          只读建议
        </span>
      }
      footer={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            disabled={safeIndex === 0}
            className="inline-flex items-center gap-1 border border-black fresh:border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-chat-ink disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:bg-slate-900 dark:text-slate-100"
          >
            <ChevronLeft className="size-3.5" />
            上一条
          </button>
          <div className="text-center text-xs font-medium text-chat-ink-muted">
            {safeIndex + 1} / {suggestions.length} · 本轮不会修改简历
          </div>
          <button
            type="button"
            onClick={() =>
              setActiveIndex((index) => Math.min(suggestions.length - 1, index + 1))
            }
            disabled={safeIndex === suggestions.length - 1}
            className="inline-flex items-center gap-1 border border-black fresh:border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-chat-ink disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:bg-slate-900 dark:text-slate-100"
          >
            下一条
            <ChevronRight className="size-3.5" />
          </button>
          {(onApply || onApplyOne) && (
            <div className="col-span-3 mt-1 flex gap-2">
              {onApplyOne && active.status === "proposed" && (
                <button
                  type="button"
                  onClick={() => onApplyOne(safeIndex + 1, active.title)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 border-2 fresh:border border-black fresh:border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-chat-ink transition-all hover:bg-blue-50 active:translate-x-[1px] active:translate-y-[1px] dark:border-white dark:bg-slate-900 dark:text-slate-100"
                >
                  <PencilLine className="size-4" />
                  帮我改这条
                </button>
              )}
              {onApply && (
                <button
                  type="button"
                  onClick={onApply}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 border-2 fresh:border border-black fresh:border-slate-200 bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:translate-x-[1px] active:translate-y-[1px] dark:border-white"
                >
                  <Sparkles className="size-4" />
                  全部按建议修改
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="text-sm font-semibold text-chat-ink dark:text-slate-100">
            诊断出 {suggestions.length} 条优化建议
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map(([label, count]) => (
              <span
                key={label}
                className="border border-chat-border bg-white px-2 py-1 text-[11px] text-chat-ink-muted dark:border-slate-700 dark:bg-slate-900"
              >
                {label} {count} 条
              </span>
            ))}
          </div>
        </div>

        <article className="border border-chat-border bg-chat-canvas/30 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-semibold ${severity.className}`}
              >
                <SeverityIcon className="size-3" />
                {severity.label}
              </span>
              <span className="text-[11px] font-medium text-chat-ink-muted">
                {SECTION_LABELS[active.section] || active.section}
              </span>
            </div>
            <span className="text-[11px] text-chat-ink-muted">
              {safeIndex + 1} / {suggestions.length}
            </span>
          </div>

          <h4 className="mt-3 text-base font-bold text-chat-ink dark:text-slate-100">
            {active.title}
          </h4>

          {active.original && (
            <div className="mt-3 border border-chat-border bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
              <div className="text-[11px] font-semibold text-chat-ink-muted">原文或当前缺口</div>
              <p className="mt-1.5 text-sm leading-6 text-chat-ink dark:text-slate-200">
                {active.original}
              </p>
            </div>
          )}

          <div className="mt-3 border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
              <Sparkles className="size-3" />
              具体修改建议
            </div>
            <p className="mt-1.5 text-sm leading-6 text-emerald-950 dark:text-emerald-100">
              {active.recommendation}
            </p>
          </div>

          {active.proposed && active.status === "proposed" && (
            <div className="mt-3 border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-200">
                可参考改写
              </div>
              <p className="mt-1.5 text-sm leading-6 text-blue-950 dark:text-blue-100">
                {active.proposed}
              </p>
            </div>
          )}

          <div className="mt-3 text-xs leading-5 text-chat-ink-muted">
            <span className="font-semibold text-chat-ink dark:text-slate-200">诊断依据：</span>
            {active.evidence}
          </div>

          {active.requires_facts.length > 0 && (
            <div className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              需要你后续提供真实信息：{active.requires_facts.join("、")}。当前不会生成示例值。
            </div>
          )}
        </article>
      </div>
    </AgentSpecialCard>
  );
}
