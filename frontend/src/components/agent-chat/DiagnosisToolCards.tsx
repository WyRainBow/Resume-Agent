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
        <FileText className="h-4 w-4 text-blue-600" />
        <span className="font-medium text-slate-900">获取简历详情</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Stethoscope className="h-4 w-4 text-indigo-600" />
      <span className="font-medium text-slate-900">resume-diagnosis</span>
    </div>
  );
}

function ToolBody({ item }: { item: DiagnosisToolStructuredData }) {
  if (item.type === "resume_detail") {
    const resume = item.resume || {};
    return (
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm text-slate-700">
        <div className="font-medium text-slate-900">{resume.name || "当前简历"}</div>
        <div className="mt-1 text-xs text-slate-500">
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
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">初筛概率</div>
          <div className="text-sm font-bold text-indigo-600">{summary.screening_probability ?? "--"}%</div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">质量得分</div>
          <div className="text-sm font-bold text-emerald-600">{summary.quality_score ?? "--"}</div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">竞争力</div>
          <div className="text-sm font-bold text-amber-600">{summary.competitiveness_score ?? "--"}</div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">匹配度</div>
          <div className="text-sm font-bold text-blue-600">{summary.matching_score ?? "待评"}</div>
        </div>
      </div>

      {/* 详细报告 (如果存在) */}
      {details.overall_evaluation && (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 rounded-lg p-3 border border-slate-100 italic">
            "{details.overall_evaluation}"
          </div>

          {/* 问题清单 */}
          {details.issues && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>待优化问题</span>
              </div>
              <div className="grid gap-1.5">
                {details.issues.must_fix && details.issues.must_fix.length > 0 && details.issues.must_fix.map((issue, idx) => (
                  <div key={`must-${idx}`} className="flex items-start gap-2 text-xs text-slate-600 bg-red-50/30 rounded px-2 py-1.5 border border-red-100/50">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <span><span className="font-medium text-red-700">必须修改:</span> {issue}</span>
                  </div>
                ))}
                {details.issues.should_fix && details.issues.should_fix.length > 0 && details.issues.should_fix.map((issue, idx) => (
                  <div key={`should-${idx}`} className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50/30 rounded px-2 py-1.5 border border-amber-100/50">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span><span className="font-medium text-amber-700">建议优化:</span> {issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 建议 */}
          {details.top_actions && details.top_actions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Lightbulb className="h-3.5 w-3.5 text-indigo-500" />
                <span>Top 优化建议</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {details.top_actions.map((action, idx) => (
                  <div key={`action-${idx}`} className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 下一步 */}
          {details.next_steps && details.next_steps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Target className="h-3.5 w-3.5 text-emerald-500" />
                <span>建议下一步操作</span>
              </div>
              <div className="space-y-1">
                {details.next_steps.map((step, idx) => (
                  <div key={`step-${idx}`} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <Info className="h-3 w-3 text-slate-400" />
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
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <ToolTitle item={item} />
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
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
