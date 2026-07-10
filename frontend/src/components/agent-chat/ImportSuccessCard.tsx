import { CheckCircle2, Download, PenLine, Target } from "lucide-react";

/**
 * 状态卡视觉规则（两张卡共用）：白底中性卡，彩色只出现在语义位——
 * ✓ 图标 + 「下载 PDF」主 CTA 用 emerald（成功/拿结果），其余按钮一律中性 ghost；
 * 圆角刻度：pill = 发消息的建议 chip，rounded-lg = 动作按钮。
 */
const CHIP_CLASS =
  "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50/40 hover:text-blue-700 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-900/50 dark:hover:bg-slate-800 dark:hover:text-blue-300";

const GHOST_ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
          strokeWidth={2.25}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            简历「{name}」已导入
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            右侧可实时预览、接下来想优化哪部分？
          </p>
          {suggestions && suggestions.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSuggestionClick?.(s)}
                  className={CHIP_CLASS}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 优化应用完成的收尾卡片：闭环终点——引导用户拿到结果（下载 PDF）或去编辑器精修。
 */
/** 优化应用完成的功能坞:只承载稳定的功能入口(下载/再优化/精修)。
 * "说什么、建议什么"不在这里写死——应用完成后由 Agent 基于本轮真实
 * 改动生成收尾语与动态建议(CocoChat 静默触发),内容归 LLM、入口归卡片。 */
export function ApplyDoneCard({
  count,
  onDownloadPdf,
  onGoEditor,
}: {
  count: number;
  onDownloadPdf?: () => void;
  onGoEditor?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2.25} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            已应用 {count} 处优化、右侧预览已更新
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
              下载 PDF
            </button>
            <button type="button" onClick={onGoEditor} className={GHOST_ACTION_CLASS}>
              <PenLine className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.25} />
              去编辑器精修
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
