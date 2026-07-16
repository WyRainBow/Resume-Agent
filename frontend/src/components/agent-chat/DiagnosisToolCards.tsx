import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Target,
} from "lucide-react";
import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";
import type {
  DiagnosisDimension,
  DiagnosisToolStructuredData,
  ResumeDiagnosisStructuredData,
} from "@/types/resumeDiagnosis";

export type { DiagnosisToolStructuredData } from "@/types/resumeDiagnosis";

interface DiagnosisToolCardsProps {
  items: DiagnosisToolStructuredData[];
  className?: string;
  onActionClick?: (message: string) => void;
}

function scoreTone(score: number) {
  if (score >= 82) return "text-emerald-700";
  if (score >= 68) return "text-amber-700";
  return "text-red-600";
}

function OverallScore({ score }: { score: number }) {
  const progress = Math.max(0, Math.min(100, score));
  return (
    <div
      className="relative grid size-28 shrink-0 place-items-center rounded-full p-[7px]"
      style={{
        background: `conic-gradient(rgb(37 99 235) ${progress * 3.6}deg, rgb(226 232 240) 0deg)`,
      }}
      aria-label={`简历综合得分 ${score} 分`}
    >
      <div className="grid size-full place-items-center rounded-full bg-white text-center dark:bg-slate-950">
        <div>
          <div className="text-3xl font-black leading-none text-chat-ink dark:text-slate-100">
            {score}
          </div>
          <div className="mt-1 text-[10px] font-semibold tracking-[0.16em] text-chat-ink-muted">
            综合得分
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionCard({
  title,
  dimension,
  icon,
  onActionClick,
}: {
  title: string;
  dimension: DiagnosisDimension;
  icon: React.ReactNode;
  onActionClick?: (message: string) => void;
}) {
  const score = dimension.score;
  return (
    <div className="rounded-xl border border-chat-border/80 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-semibold text-chat-ink dark:text-slate-100">{title}</div>
            <div className={`text-xl font-black ${scoreTone(score)}`}>
              {score}
              <span className="ml-0.5 text-[10px] font-medium text-chat-ink-muted">/100</span>
            </div>
          </div>
          <p className="mt-1 text-xs leading-5 text-chat-ink-muted">
            {dimension.description}
          </p>
          {onActionClick && (
            <button
              type="button"
              onClick={() => onActionClick(dimension.action_message)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition-colors hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {dimension.action_label}
              <ChevronRight className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "danger" | "warning" | "neutral";
}) {
  if (items.length === 0) return null;
  const toneClasses = {
    danger: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
    warning:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    neutral:
      "border-chat-border bg-chat-canvas/60 text-chat-ink-muted dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  };
  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone]}`}>
      <div className="mb-2 text-xs font-bold">{label}</div>
      <div className="space-y-1.5">
        {items.map((issue, index) => (
          <div key={`${label}-${index}`} className="flex items-start gap-2 text-xs leading-5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-60" />
            <span>{issue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosisBody({
  item,
  onActionClick,
}: {
  item: ResumeDiagnosisStructuredData;
  onActionClick?: (message: string) => void;
}) {
  const { summary, details } = item;
  const overallScore = summary.overall_score;
  const dimensions = details.dimensions;
  const actions = details.actions;
  const traceSteps =
    details.public_trace && details.public_trace.length > 0
      ? details.public_trace.map((summary, index) => ({
          label: details.analysis_steps[index]?.label || `诊断步骤 ${index + 1}`,
          status: "done",
          summary,
        }))
      : details.analysis_steps;
  const sourceLabel =
    details.diagnosis_source === "llm"
      ? "LLM 证据诊断"
      : details.diagnosis_source === "heuristic_fallback"
        ? "基础检查"
        : "历史诊断（来源未记录）";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 dark:border-blue-900/60 dark:from-blue-950/40 dark:via-slate-950 dark:to-indigo-950/40">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <OverallScore score={overallScore} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
              <Sparkles className="size-3.5" />
              综合诊断
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-chat-ink dark:text-slate-100">
              {details.overall_evaluation}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] text-chat-ink-muted sm:justify-start">
              <span className="rounded-full border border-chat-border bg-white/80 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                初筛竞争力 {summary.screening_score}/100 · {sourceLabel}
              </span>
              {onActionClick && (
                <button
                  type="button"
                  onClick={() => onActionClick("重新诊断当前简历")}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white/80 px-2.5 py-1 font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900/80 dark:text-blue-300"
                >
                  <RefreshCw className="size-3" />
                  重新评分
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {traceSteps.length > 0 && (
        <div className="rounded-xl border border-chat-border/70 bg-chat-canvas/40 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-chat-ink dark:text-slate-100">
            <Stethoscope className="size-3.5 text-blue-600" />
            诊断轨迹
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {traceSteps.map((step, index) => (
              <div key={`${step.label}-${index}`} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <div>
                  <div className="text-xs font-semibold text-chat-ink dark:text-slate-200">
                    {step.label}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-4 text-chat-ink-muted">
                    {step.summary}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {details.strengths.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-chat-ink dark:text-slate-100">
            <Lightbulb className="size-3.5 text-emerald-600" />
            已有优势
          </div>
          <div className="flex flex-wrap gap-2">
            {details.strengths.map((strength, index) => (
              <span
                key={`strength-${index}`}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] leading-4 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                {strength}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-chat-ink dark:text-slate-100">
            <AlertTriangle className="size-3.5 text-amber-600" />
            诊断发现
          </div>
          <div className="grid gap-2.5">
            <IssueGroup label="优先处理" items={details.issues.must_fix} tone="danger" />
            <IssueGroup label="建议优化" items={details.issues.should_fix} tone="warning" />
            <IssueGroup label="可选提升" items={details.issues.optional} tone="neutral" />
          </div>
      </div>

      {actions.length > 0 && onActionClick && (
        <div className="border-t border-chat-border/70 pt-4 dark:border-slate-700">
          <div className="mb-2 text-xs font-bold text-chat-ink dark:text-slate-100">
            下一步怎么做？
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={() => onActionClick(action.message)}
                className={
                  action.primary || index === 0
                    ? "inline-flex items-center gap-1.5 rounded-full border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 active:scale-95"
                    : "inline-flex items-center gap-1.5 rounded-full border border-chat-border bg-white px-3.5 py-2 text-xs font-medium text-chat-ink transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }
              >
                {action.label}
                <ChevronRight className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 三维能力评分放在诊断内容最底部：用户读完全部诊断后，各维度的
          「查看修改建议 / 查看面试指导 / 查看投递方向」chip 正好在手边，
          不用滑回顶部再点（2026-07-16 用户反馈 Image #31）。 */}
      <div>
        <div className="mb-2.5 text-xs font-bold tracking-wide text-chat-ink dark:text-slate-100">
          三维能力评分
        </div>
        <div className="grid gap-2.5 lg:grid-cols-3">
          <DimensionCard
            title="简历内容评分"
            dimension={dimensions.content}
            icon={<FileText className="size-4.5" />}
            onActionClick={onActionClick}
          />
          <DimensionCard
            title="面试证据准备度"
            dimension={dimensions.interview}
            icon={<MessageSquareText className="size-4.5" />}
            onActionClick={onActionClick}
          />
          <DimensionCard
            title="匹配度评分"
            dimension={dimensions.matching}
            icon={<Target className="size-4.5" />}
            onActionClick={onActionClick}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 单份诊断：只呈现评分卡（2026-07-16 诊断/建议拆分）。逐条修改建议不再随
 * 诊断产出——点评分卡里各维度的「查看修改建议」等 chip 会发一条真实对话
 * 消息（"查看这次诊断的修改建议"），后端 cv_suggestions_agent 单独生成并
 * 以 resume_suggestions 结构化事件返回建议卡（正常对话流，自带思考 loading）。
 * 见 knowledge-base/specs/2026-07-16-诊断评分与建议分离展示-需求记录.md。
 */
function DiagnosisItemCard({
  item,
  onActionClick,
}: {
  item: ResumeDiagnosisStructuredData;
  onActionClick?: (message: string) => void;
}) {
  return (
    <AgentSpecialCard
      variant="default"
      icon={<Stethoscope className="h-4 w-4" />}
      title="简历诊断报告"
      subtitle={item.resume?.name || "当前简历"}
    >
      <DiagnosisBody item={item} onActionClick={onActionClick} />
    </AgentSpecialCard>
  );
}

export default function DiagnosisToolCards({
  items,
  className = "",
  onActionClick,
}: DiagnosisToolCardsProps) {
  const diagnosisItems = items.filter(
    (item): item is ResumeDiagnosisStructuredData => item.type === "resume_diagnosis",
  );
  if (diagnosisItems.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {diagnosisItems.map((item, index) => (
        <DiagnosisItemCard
          key={`${item.type}-${item.tool || "tool"}-${index}`}
          item={item}
          onActionClick={onActionClick}
        />
      ))}
    </div>
  );
}
