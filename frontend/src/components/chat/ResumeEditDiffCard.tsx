import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ResumeEditDiffCardProps {
  before: string;
  after: string;
}

function DiffContent({ text, variant }: { text: string; variant: "before" | "after" }) {
  const lines = text.split("\n");
  const textColor = variant === "before" ? "text-slate-600" : "text-slate-800";

  return (
    <div className={`text-sm leading-relaxed ${textColor}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        const isBullet = /^[-•]\s/.test(trimmed);
        const isNumbered = /^\d+[.)]\s/.test(trimmed);
        const isHeading = /[:：]$/.test(trimmed) && trimmed.length < 30;

        if (isBullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-2 py-0.5">
              <span className="text-slate-400 shrink-0">•</span>
              <span>{trimmed.replace(/^[-•]\s*/, "")}</span>
            </div>
          );
        }
        if (isNumbered) {
          return (
            <div key={i} className="py-0.5 font-medium">
              {trimmed}
            </div>
          );
        }
        if (isHeading) {
          return (
            <div key={i} className="pt-2 pb-0.5 font-medium text-slate-900">
              {trimmed}
            </div>
          );
        }
        return (
          <div key={i} className="py-0.5">
            {trimmed}
          </div>
        );
      })}
    </div>
  );
}

const COLLAPSE_THRESHOLD = 300;

export default function ResumeEditDiffCard({
  before,
  after,
}: ResumeEditDiffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = before.length > COLLAPSE_THRESHOLD || after.length > COLLAPSE_THRESHOLD;
  const showFull = expanded || !isLong;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {isLong && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-end">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {expanded ? (
              <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>展开全部 <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        </div>
      )}
      <div className="grid gap-0 md:grid-cols-2 divide-x divide-slate-200">
        <div className="p-4">
          <div className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">修改前</div>
          <div className={`${!showFull ? "max-h-48 overflow-hidden relative" : ""}`}>
            <DiffContent text={before} variant="before" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
        </div>
        <div className="p-4 bg-emerald-50/30">
          <div className="mb-2 text-xs font-medium text-emerald-600 uppercase tracking-wide">修改后</div>
          <div className={`${!showFull ? "max-h-48 overflow-hidden relative" : ""}`}>
            <DiffContent text={after} variant="after" />
            {!showFull && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-emerald-50/30 to-transparent" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
