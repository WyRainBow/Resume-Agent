import { toast } from '@/lib/toast'
/**
 * 导出按钮 + 导出格式弹窗
 * 点「导出」弹出格式选择（PDF / JSON），选中后统一从底部「导出」执行。
 */
import { useEffect, useState } from "react";
import { Download, FileJson, FileText, X } from "lucide-react";
import { cn } from "../../../../lib/utils";
import {
  fetchPdfDownloadQuota,
  recordPdfDownload,
  type PdfDownloadQuota,
} from "@/services/api";

type ExportFormat = "pdf" | "json";

interface ExportButtonProps {
  resumeData: Record<string, any>;
  resumeName?: string;
  onExportJSON?: () => void;
  pdfBlob?: Blob | null;
  onDownloadPDF?: () => void | Promise<void>;
}

export function ExportButton({
  resumeData,
  resumeName = "我的简历",
  onExportJSON,
  pdfBlob,
  onDownloadPDF,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quota, setQuota] = useState<PdfDownloadQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const isHtmlTemplate = resumeData?.templateType === "html";
  const [format, setFormat] = useState<ExportFormat>("pdf");

  const getPdfFileName = () => {
    const safeName = (resumeName || "简历")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ");
    const name = safeName || "简历";
    const date = new Date().toISOString().split("T")[0];
    return `${name}_简历_${date}.pdf`;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const refreshQuota = async () => {
    setQuotaLoading(true);
    setQuotaError(null);
    try {
      setQuota(await fetchPdfDownloadQuota());
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法读取下载额度";
      setQuotaError(message);
    } finally {
      setQuotaLoading(false);
    }
  };

  const getQuotaText = () => {
    if (quotaLoading) return "正在读取下载额度";
    if (quotaError) return "下载额度读取失败";
    if (!quota) return "下载次数额度";
    if (quota.unlimited) return "下载不限次数";
    return `剩余 ${quota.remaining ?? 0}/${quota.limit ?? 10} 次下载`;
  };

  const quotaIsExhausted = Boolean(
    quota && !quota.unlimited && (quota.remaining ?? 0) <= 0,
  );

  // 导出 PDF：LaTeX 模板走后端渲染好的 pdfBlob（占下载额度）；HTML 模板走前端导出（onDownloadPDF，不占额度）
  const exportPdf = async () => {
    if (!isHtmlTemplate && !pdfBlob) {
      toast.error('请先点击"渲染 PDF"按钮生成 PDF，然后再下载');
      return;
    }
    setIsOpen(false);
    try {
      if (onDownloadPDF) {
        await onDownloadPDF();
      } else if (pdfBlob) {
        await recordPdfDownload();
        downloadBlob(pdfBlob, getPdfFileName());
      }
      if (!isHtmlTemplate) void refreshQuota();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 下载失败，请重试");
    }
  };

  // 导出 JSON（结构化简历数据，本地生成不耗下载额度）
  const exportJson = () => {
    setIsOpen(false);
    if (onExportJSON) {
      onExportJSON();
      return;
    }
    try {
      const jsonString = JSON.stringify(resumeData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      downloadBlob(
        blob,
        `${resumeName}-${new Date().toISOString().split("T")[0]}.json`,
      );
    } catch (error) {
      console.error("导出 JSON 失败:", error);
      toast.error("导出失败，请重试");
    }
  };

  const handleExport = () => {
    if (format === "pdf") void exportPdf();
    else exportJson();
  };

  useEffect(() => {
    if (isOpen) {
      setFormat("pdf");
      if (!isHtmlTemplate) void refreshQuota();
    }
  }, [isOpen, isHtmlTemplate]);

  const formatCardClass = (active: boolean) =>
    cn(
      "flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors",
      active
        ? "border-blue-500 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30"
        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
    );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "px-6 py-2.5 rounded-lg",
          "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          "text-white text-sm font-bold",
          "transition-all duration-300 ease-out",
          "flex items-center gap-2",
          "shadow-lg shadow-blue-100 dark:shadow-blue-900/20",
          "border-2 border-blue-500",
          "hover:scale-[1.05] active:scale-[0.95]",
        )}
      >
        <Download className="w-4 h-4" strokeWidth={3} />
        <span>导出</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  导出简历
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  选择导出格式下载简历
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="-mr-1 -mt-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 grid-cols-2">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={formatCardClass(format === "pdf")}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg",
                    format === "pdf"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  <FileText className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  PDF
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  可打印文档
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    !isHtmlTemplate && quotaIsExhausted
                      ? "text-red-500 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {isHtmlTemplate
                    ? "前端实时导出，不占下载额度"
                    : !pdfBlob
                      ? "需要先渲染 PDF"
                      : getQuotaText()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("json")}
                className={formatCardClass(format === "json")}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg",
                    format === "json"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  <FileJson className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  JSON
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  结构化数据
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  可再次导入编辑
                </span>
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.98]"
              >
                导出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
