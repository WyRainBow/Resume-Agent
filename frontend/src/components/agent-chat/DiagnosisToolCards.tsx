import React from "react";
import { AlertTriangle, CheckCircle2, FileText, Info, Lightbulb, Stethoscope, Target } from "lucide-react";

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

function ToolTitle({ item }: { item: DiagnosisToolStructuredData }) {
  if (item.type === "resume_detail") {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-300" />
        <span className="font-medium text-white">获取简历详情</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Stethoscope className="h-4 w-4 text-slate-300" />
      <span className="font-medium text-white">resume-diagnosis</span>
    </div>
  );
}

function ToolBody({ item }: { item: DiagnosisToolStructuredData }) {
  if (item.type === "resume_detail") {
    const resume = item.resume || {};
    return (
      <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm">
        <div className="font-medium text-white">{resume.name || "当前简历"}</div>
        <div className="mt-1 text-xs text-slate-400">
          {resume.updated_at ? `更新时间 ${resume.updated_at}` : "更新时间未知"}
          {resume.language ? ` · ${resume.language}` : ""}
        </div>
      </div>
    );
  }

  const summary = item.summary || {};
  const details = item.details || {};

  return (
    <div className="mt-3 space-y-4">
      {/* 评分简报 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-white/10 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">初筛概率</div>
          <div className="text-sm font-bold text-indigo-400">{summary.screening_probability ?? "--"}%</div>
        </div>
        <div className="rounded-lg bg-white/10 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">质量得分</div>
          <div className="text-sm font-bold text-emerald-400">{summary.quality_score ?? "--"}</div>
        </div>
        <div className="rounded-lg bg-white/10 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">竞争力</div>
          <div className="text-sm font-bold text-amber-400">{summary.competitiveness_score ?? "--"}</div>
        </div>
        <div className="rounded-lg bg-white/10 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">匹配度</div>
          <div className="text-sm font-bold text-blue-400">{summary.matching_score ?? "待评"}</div>
        </div>
      </div>

      {/* 详细报告 (如果存在) */}
      {details.overall_evaluation && (
        <div className="space-y-3">
          <div className="text-xs text-slate-300 leading-relaxed bg-white/5 rounded-lg p-3 italic">
            &ldquo;{details.overall_evaluation}&rdquo;
          </div>

          {/* 问题清单 */}
          {details.issues && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span>待优化问题</span>
              </div>
              <div className="grid gap-1.5">
                {details.issues.must_fix && details.issues.must_fix.length > 0 && details.issues.must_fix.map((issue, idx) => (
                  <div key={`must-${idx}`} className="flex items-start gap-2 text-xs text-slate-300 bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <span><span className="font-medium text-red-400">必须修改:</span> {issue}</span>
                  </div>
                ))}
                {details.issues.should_fix && details.issues.should_fix.length > 0 && details.issues.should_fix.map((issue, idx) => (
                  <div key={`should-${idx}`} className="flex items-start gap-2 text-xs text-slate-300 bg-amber-500/10 rounded px-2 py-1.5 border border-amber-500/20">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span><span className="font-medium text-amber-400">建议优化:</span> {issue}</span>
                  </div>
                ))}
                {details.issues.optional && details.issues.optional.length > 0 && details.issues.optional.map((issue, idx) => (
                  <div key={`optional-${idx}`} className="flex items-start gap-2 text-xs text-slate-400 bg-white/5 rounded px-2 py-1.5 border border-white/10">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
                    <span><span className="font-medium text-slate-400">可选优化:</span> {issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 建议 */}
          {details.top_actions && details.top_actions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Lightbulb className="h-3.5 w-3.5 text-indigo-400" />
                <span>Top 优化建议</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {details.top_actions.map((action, idx) => (
                  <div key={`action-${idx}`} className="text-[11px] text-indigo-300 bg-indigo-500/15 px-2 py-1 rounded-md border border-indigo-500/20">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 下一步 */}
          {details.next_steps && details.next_steps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Target className="h-3.5 w-3.5 text-emerald-400" />
                <span>建议下一步操作</span>
              </div>
              <div className="space-y-1">
                {details.next_steps.map((step, idx) => (
                  <div key={`step-${idx}`} className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Info className="h-3 w-3 text-slate-500" />
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
      {items.map((item, index) => (
        <div
          key={`${item.type}-${item.tool || "tool"}-${index}`}
          className="rounded-lg bg-slate-800 px-4 py-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <ToolTitle item={item} />
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {item.status === "success" ? "执行成功" : item.status || "已完成"}
            </span>
          </div>
          <ToolBody item={item} />
        </div>
      ))}
    </div>
  );
}
