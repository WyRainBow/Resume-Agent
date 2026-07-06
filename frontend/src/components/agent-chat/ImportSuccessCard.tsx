import { CheckCircle2, Download, PenLine, Target } from "lucide-react";

/**
 * 简历导入/解析成功卡片：替代原来干巴巴的「已通过 AI 解析导入简历「X」…」纯文本。
 * ✓ + 简历名 + 一句引导 + 可点的下一步建议 chip（点击填入输入框）。
 */
export function ImportSuccessCard({
  name,
  suggestions,
  onSuggestionClick,
}: {
  name: string;
  suggestions?: string[];
  onSuggestionClick?: (msg: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
          strokeWidth={2.25}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-chat-ink dark:text-slate-100">
            简历「{name}」已导入
          </p>
          <p className="mt-0.5 text-xs text-chat-ink-muted">
            右侧可实时预览、接下来想优化哪部分？
          </p>
        </div>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 sm:pl-8">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestionClick?.(s)}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 优化应用完成的收尾卡片：闭环终点——引导用户拿到结果（下载 PDF）或去编辑器精修。
 */
export function ApplyDoneCard({
  count,
  refine,
  onSuggestionClick,
  onDownloadPdf,
  onGoEditor,
  onOptimizeForJd,
}: {
  count: number;
  refine?: { text: string; msg: string }[];
  onSuggestionClick?: (msg: string) => void;
  onDownloadPdf?: () => void;
  onGoEditor?: () => void;
  onOptimizeForJd?: () => void;
}) {
  const hasRefine = !!(refine && refine.length && onSuggestionClick);
  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2.25} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-chat-ink dark:text-slate-100">
            已应用 {count} 处优化、右侧预览已更新
          </p>
          <p className="mt-0.5 text-xs text-chat-ink-muted">
            {hasRefine
              ? "满意吗？可以直接下载，或让我把这段再打磨一版："
              : "简历改好了、接下来可以："}
          </p>
        </div>
      </div>
      {hasRefine && (
        <div className="mt-3 flex flex-wrap gap-2 sm:pl-8">
          {refine!.map((chip) => (
            <button
              key={chip.text}
              type="button"
              onClick={() => onSuggestionClick!(chip.msg)}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
            >
              {chip.text}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 sm:pl-8">
        <button
          type="button"
          onClick={onDownloadPdf}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95 dark:border-emerald-800"
        >
          <Download className="h-3.5 w-3.5" />
          下载 PDF
        </button>
        {/* 回访钩子：刚优化完是价值峰值，引导「投下一个岗位再来一版」——把低频做成高频 */}
        {onOptimizeForJd && (
          <button
            type="button"
            onClick={onOptimizeForJd}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-medium text-blue-700 transition-all hover:bg-blue-50 active:scale-95 dark:border-blue-900/50 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
          >
            <Target className="h-3.5 w-3.5" />
            针对某个岗位再优化一版
          </button>
        )}
        <button
          type="button"
          onClick={onGoEditor}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-medium text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
        >
          <PenLine className="h-3.5 w-3.5" />
          去编辑器精修
        </button>
      </div>
    </div>
  );
}
