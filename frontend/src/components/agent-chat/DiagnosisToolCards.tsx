import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Lightbulb,
  Stethoscope,
  Target,
} from "lucide-react";
import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";

export interface DiagnosisToolStructuredData {
  type: "resume_detail" | "resume_diagnosis";
  status?: string;
  tool?: string;
  resume?: {
    id?: string;
    name?: string;
    updated_at?: string;
    language?: string;
  };
  summary?: {
    screening_probability?: number;
    quality_score?: number;
    competitiveness_score?: number;
    matching_score?: number | null;
  };
  details?: {
    overall_evaluation?: string;
    issues?: {
      must_fix?: string[];
      should_fix?: string[];
      optional?: string[];
    };
    top_actions?: string[];
    next_steps?: string[];
  };
}

interface DiagnosisToolCardsProps {
  items: DiagnosisToolStructuredData[];
  className?: string;
}

function ToolBody({ item }: { item: DiagnosisToolStructuredData }) {
  if (item.type === "resume_detail") {
    const resume = item.resume || {};
    return (
      <div className="rounded-lg border border-chat-border/70 bg-chat-canvas/50 px-3 py-2.5 text-sm">
        <div className="font-medium text-chat-ink">{resume.name || "当前简历"}</div>
        <div className="mt-1 text-xs text-chat-ink-muted">
          {resume.updated_at ? `更新时间 ${resume.updated_at}` : "更新时间未知"}
          {resume.language ? ` · ${resume.language}` : ""}
        </div>
      </div>
    );
  }

  const summary = item.summary || {};
  const details = item.details || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-chat-border/60 bg-chat-canvas/50 p-2 text-center">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-chat-ink-muted">初筛概率</div>
          <div className="text-sm font-bold text-chat-accent-deep">
            {summary.screening_probability ?? "--"}%
          </div>
        </div>
        <div className="rounded-lg border border-chat-border/60 bg-chat-canvas/50 p-2 text-center">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-chat-ink-muted">质量得分</div>
          <div className="text-sm font-bold text-emerald-700">{summary.quality_score ?? "--"}</div>
        </div>
        <div className="rounded-lg border border-chat-border/60 bg-chat-canvas/50 p-2 text-center">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-chat-ink-muted">竞争力</div>
          <div className="text-sm font-bold text-amber-700">
            {summary.competitiveness_score ?? "--"}
          </div>
        </div>
        <div className="rounded-lg border border-chat-border/60 bg-chat-canvas/50 p-2 text-center">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-chat-ink-muted">匹配度</div>
          <div className="text-sm font-bold text-sky-700">{summary.matching_score ?? "待评"}</div>
        </div>
      </div>

      {details.overall_evaluation && (
        <div className="space-y-3">
          <div className="rounded-lg border border-chat-border/60 bg-chat-canvas/40 p-3 text-xs italic leading-relaxed text-chat-ink-muted">
            &ldquo;{details.overall_evaluation}&rdquo;
          </div>

          {details.issues && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-chat-ink">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>待优化问题</span>
              </div>
              <div className="grid gap-1.5">
                {details.issues.must_fix?.map((issue, idx) => (
                  <div
                    key={`must-${idx}`}
                    className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span>
                      <span className="font-medium">必须修改:</span> {issue}
                    </span>
                  </div>
                ))}
                {details.issues.should_fix?.map((issue, idx) => (
                  <div
                    key={`should-${idx}`}
                    className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>
                      <span className="font-medium">建议优化:</span> {issue}
                    </span>
                  </div>
                ))}
                {details.issues.optional?.map((issue, idx) => (
                  <div
                    key={`optional-${idx}`}
                    className="flex items-start gap-2 rounded border border-chat-border bg-chat-canvas/40 px-2 py-1.5 text-xs text-chat-ink-muted"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-chat-ink-muted/50" />
                    <span>
                      <span className="font-medium">可选优化:</span> {issue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {details.top_actions && details.top_actions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-chat-ink">
                <Lightbulb className="h-3.5 w-3.5 text-chat-accent" />
                <span>Top 优化建议</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {details.top_actions.map((action, idx) => (
                  <div
                    key={`action-${idx}`}
                    className="rounded-md border border-chat-accent/20 bg-chat-accent/10 px-2 py-1 text-[11px] text-chat-accent-deep"
                  >
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {details.next_steps && details.next_steps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-chat-ink">
                <Target className="h-3.5 w-3.5 text-emerald-700" />
                <span>建议下一步操作</span>
              </div>
              <div className="space-y-1">
                {details.next_steps.map((step, idx) => (
                  <div
                    key={`step-${idx}`}
                    className="flex items-center gap-2 text-[11px] text-chat-ink-muted"
                  >
                    <Info className="h-3 w-3 text-chat-accent" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiagnosisToolCards({
  items,
  className = "",
}: DiagnosisToolCardsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => {
        const isDetail = item.type === "resume_detail";
        return (
          <AgentSpecialCard
            key={`${item.type}-${item.tool || "tool"}-${index}`}
            variant="default"
            icon={
              isDetail ? (
                <FileText className="h-4 w-4" />
              ) : (
                <Stethoscope className="h-4 w-4" />
              )
            }
            title={isDetail ? "获取简历详情" : "简历诊断"}
            subtitle={item.tool || undefined}
            badge={
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {item.status === "success" ? "执行成功" : item.status || "已完成"}
              </span>
            }
          >
            <ToolBody item={item} />
          </AgentSpecialCard>
        );
      })}
    </div>
  );
}
