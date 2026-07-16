import React, { useEffect, useRef, useState } from "react";
import { EyeOff, Minus, Plus, RefreshCw, X, Download, Save, Check, Loader2 } from "lucide-react";
import { PDFViewerSelector } from "@/components/PDFEditor";
import CustomScrollbar from "@/components/common/CustomScrollbar";

interface AgentPdfPreviewPanelProps {
  resumeName?: string;
  pdfBlob: Blob | null;
  loading: boolean;
  progress?: string;
  error?: string | null;
  onRerender: () => void;
  onClose: () => void;
  /** 保存当前预览的简历；返回 Promise 以便按钮呈现「保存中 / 已保存 / 保存失败」状态 */
  onSave?: () => Promise<void> | void;
  /** 刚应用优化：短暂高亮预览面板，引导视线看「结果在这更新」 */
  justUpdated?: boolean;
  /** 视觉隐藏但保持挂载渲染（display:none）：对话区看起来是纯聊天，
   *  PDF/缩放/滚动状态全保留，展开即时呈现，不重新渲染 */
  concealed?: boolean;
  /** 头部「收起预览」按钮回调；不传则不渲染该按钮 */
  onToggleConceal?: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.25;
const BASE_PDF_WIDTH = 595;

export default function AgentPdfPreviewPanel({
  resumeName,
  pdfBlob,
  loading,
  progress,
  error,
  onRerender,
  onClose,
  onSave,
  justUpdated = false,
  concealed = false,
  onToggleConceal,
}: AgentPdfPreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(1);
  const [userScale, setUserScale] = useState<number | null>(null);
  const [scalePercentInput, setScalePercentInput] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveResetRef = useRef<number | null>(null);

  const effectiveScale = userScale ?? autoScale;
  const displayPercent = Math.round(effectiveScale * 100);

  useEffect(() => {
    if (!containerRef.current || !pdfBlob) return;

    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;
      const padding = 48;
      const containerWidth = Math.max(container.clientWidth - padding, 280);
      const nextScale = containerWidth / BASE_PDF_WIDTH;
      setAutoScale((prev) => {
        const clamped = Math.max(MIN_SCALE, Math.min(nextScale, MAX_SCALE));
        // 忽略微小变化：滚动条出现/消失会让容器宽度小幅抖动，
        // 若据此反复改 scale 会触发 PDF 反复重绘（闪烁），加阈值挡掉
        return Math.abs(clamped - prev) < 0.01 ? prev : clamped;
      });
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [pdfBlob]);

  const applyPercentInput = (raw: string) => {
    const value = parseFloat(raw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(value)) return;
    setUserScale(Math.max(50, Math.min(250, value)) / 100);
    setScalePercentInput("");
  };

  const handleZoomOut = () => {
    setUserScale(Math.max(MIN_SCALE, effectiveScale - ZOOM_STEP));
    setScalePercentInput("");
  };

  const handleZoomIn = () => {
    setUserScale(Math.min(MAX_SCALE, effectiveScale + ZOOM_STEP));
    setScalePercentInput("");
  };

  const handleFitWidth = () => {
    setUserScale(null);
    setScalePercentInput("");
  };

  useEffect(
    () => () => {
      if (saveResetRef.current) window.clearTimeout(saveResetRef.current);
    },
    [],
  );

  const handleSave = async () => {
    if (!onSave || saveState === "saving") return;
    if (saveResetRef.current) window.clearTimeout(saveResetRef.current);
    setSaveState("saving");
    try {
      await onSave();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
    saveResetRef.current = window.setTimeout(() => setSaveState("idle"), 2000);
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${resumeName || "resume"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <CustomScrollbar
      as="aside"
      className={`relative flex-col border-l border-chat-border bg-chat-canvas transition-all duration-500 dark:border-slate-800 dark:bg-slate-950 ${
        // concealed：display:none 视觉隐藏但保持挂载——PDF blob、缩放、滚动
        // 位置全保留，展开零等待；对话区随 flex 自动占满整行
        concealed ? "hidden" : "flex w-[45%] min-w-[420px]"
      } ${justUpdated && !concealed ? "ring-2 ring-inset ring-blue-400/70 animate-pulse" : ""}`}
    >
      <div className="sticky top-0 z-20 shrink-0 border-b border-chat-border/80 bg-chat-canvas/95 px-5 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-chat-ink dark:text-slate-100">
              简历 PDF 预览
            </h2>
            {resumeName && (
              <p className="mt-0.5 truncate text-xs text-chat-ink-muted">{resumeName}</p>
            )}
          </div>
          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-chat-surface p-1 shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm dark:border-white dark:bg-slate-900/90 dark:shadow-[2px_2px_0px_0px_#ffffff]">
            {onSave && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === "saving"}
                title="保存简历"
                className={`inline-flex items-center gap-1.5 rounded-none fresh:rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  saveState === "saved"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : saveState === "error"
                      ? "text-red-500 dark:text-red-400"
                      : "text-chat-ink-muted hover:bg-chat-canvas hover:text-chat-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {saveState === "saving" ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                ) : saveState === "saved" ? (
                  <Check className="size-3.5" strokeWidth={2.25} />
                ) : (
                  <Save className="size-3.5" strokeWidth={2.25} />
                )}
                {saveState === "saving"
                  ? "保存中"
                  : saveState === "saved"
                    ? "已保存"
                    : saveState === "error"
                      ? "保存失败"
                      : "保存"}
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!pdfBlob}
              title="下载 PDF"
              className="inline-flex items-center gap-1.5 rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="size-3.5" strokeWidth={2.25} />
              下载
            </button>
            <span className="mx-0.5 h-4 w-px bg-black/80 dark:bg-slate-700" aria-hidden />
            {onToggleConceal && (
              <button
                type="button"
                onClick={onToggleConceal}
                title="收起预览"
                aria-label="收起预览"
                className="inline-flex size-8 items-center justify-center rounded-none fresh:rounded-lg text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <EyeOff className="size-3.5" strokeWidth={2.25} />
              </button>
            )}
            <button
              type="button"
              onClick={onRerender}
              disabled={loading}
              title={loading ? "正在渲染" : "刷新预览"}
              className="inline-flex size-8 items-center justify-center rounded-none fresh:rounded-lg text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="关闭预览"
              className="inline-flex size-8 items-center justify-center rounded-none fresh:rounded-lg text-chat-ink-muted transition-colors hover:bg-chat-canvas hover:text-chat-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-chat-canvas dark:bg-slate-950" style={{ scrollbarGutter: 'stable' }}>
        {!pdfBlob && loading && (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-sm text-chat-ink-muted">{progress || "正在渲染简历 PDF..."}</p>
            </div>
          </div>
        )}

        {!pdfBlob && !loading && error && (
          <div className="flex h-full min-h-[320px] items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={onRerender}
                className="mt-4 inline-flex items-center gap-1.5 rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
              >
                <RefreshCw className="size-3.5" /> 点击重试
              </button>
            </div>
          </div>
        )}

        {pdfBlob && (
          <div className="flex min-h-full justify-center px-4 py-6 pb-20">
            <div className="h-fit rounded-sm bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
              <PDFViewerSelector pdfBlob={pdfBlob} scale={effectiveScale} />
            </div>
          </div>
        )}
      </div>

      {pdfBlob && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-white px-3 py-1.5 shadow-[3px_3px_0px_0px_#000000] fresh:shadow-sm dark:border-white dark:bg-slate-900/95 dark:shadow-[3px_3px_0px_0px_#ffffff]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={effectiveScale <= MIN_SCALE}
              className="inline-flex size-8 items-center justify-center rounded-none fresh:rounded-lg text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
              title="缩小"
            >
              <Minus className="size-4" />
            </button>

            <div className="flex items-center gap-0.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              <input
                type="text"
                inputMode="numeric"
                value={scalePercentInput !== "" ? scalePercentInput : String(displayPercent)}
                onChange={(e) => setScalePercentInput(e.target.value)}
                onBlur={() => scalePercentInput !== "" && applyPercentInput(scalePercentInput)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-10 bg-transparent text-center outline-none focus:rounded focus:ring-1 focus:ring-blue-500"
                title="输入缩放比例（50–250）"
              />
              <span>%</span>
            </div>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={effectiveScale >= MAX_SCALE}
              className="inline-flex size-8 items-center justify-center rounded-none fresh:rounded-lg text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
              title="放大"
            >
              <Plus className="size-4" />
            </button>

            {userScale !== null && (
              <>
                <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={handleFitWidth}
                  className="rounded-none fresh:rounded-lg px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
                >
                  适应宽度
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </CustomScrollbar>
  );
}
