import React from "react";

interface ResumeEditDiffCardProps {
  before: string;
  after: string;
}

export default function ResumeEditDiffCard({
  before,
  after,
}: ResumeEditDiffCardProps) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-medium text-slate-500">修改前</div>
          <pre className="whitespace-pre-wrap break-words text-sm text-slate-700">
            {before}
          </pre>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 text-xs font-medium text-emerald-700">修改后</div>
          <pre className="whitespace-pre-wrap break-words text-sm text-emerald-900">
            {after}
          </pre>
        </div>
      </div>
    </div>
  );
}
