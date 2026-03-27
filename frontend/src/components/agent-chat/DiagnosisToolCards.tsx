import React from "react";
import { CheckCircle2, FileText, Stethoscope } from "lucide-react";

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
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
        初筛概率 {summary.screening_probability ?? "--"}%
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
        质量 {summary.quality_score ?? "--"}/100
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
        竞争力 {summary.competitiveness_score ?? "--"}/100
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
        匹配度 {summary.matching_score ?? "待评估"}
      </div>
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
