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
      'flex flex-col items-center gap-2 p-4 text-center transition-[transform,box-shadow,background-color] duration-100',
      'border-2 border-black dark:border-white',
      active
        ? 'bg-[#D4E4FF] shadow-[2px_2px_0px_0px_#000000] dark:bg-[#1a2a4a] dark:shadow-[2px_2px_0px_0px_#ffffff]'
        : 'bg-[#F0F0E8] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none dark:bg-[#2A2A2A] dark:hover:bg-[#3A3A3A]',
    );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'whitespace-nowrap text-sm font-medium font-mono uppercase tracking-wide',
          'transition-[transform,box-shadow,background-color] duration-100 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
          'disabled:opacity-50',
          'rounded-none h-9 px-5',
          'border border-black dark:border-white',
          'shadow-[2px_2px_0px_0px_#000000] dark:shadow-[2px_2px_0px_0px_#ffffff]',
          'bg-blue-700 text-white',
          'hover:bg-blue-800 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
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
          <div className="w-full max-w-md border-2 border-black bg-[#F0F0E8] p-5 shadow-[4px_4px_0px_0px_#000000] dark:border-white dark:bg-[#2A2A2A] dark:shadow-[4px_4px_0px_0px_#ffffff]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wide text-black dark:text-white">
                  导出简历
                </h3>
                <p className="mt-0.5 font-mono text-[10px] text-[#878E99] dark:text-neutral-400">
                  选择导出格式下载简历
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-none border border-black bg-[#F0F0E8] p-1.5 text-black shadow-[1px_1px_0px_0px_#000000] transition-colors hover:bg-[#E5E5E0] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none dark:border-white dark:bg-[#2A2A2A] dark:text-white dark:shadow-[1px_1px_0px_0px_#ffffff] dark:hover:bg-[#3A3A3A]"
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
                    "flex h-11 w-11 items-center justify-center",
                    format === "pdf"
                      ? "bg-blue-700 text-white border border-black shadow-[2px_2px_0px_0px_#000000]"
                      : "bg-[#F0F0E8] text-black border border-black shadow-[1px_1px_0px_0px_#000000] dark:bg-[#2A2A2A] dark:text-white dark:border-white dark:shadow-[1px_1px_0px_0px_#ffffff]",
                  )}
                >
                  <FileText className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wide text-black dark:text-white">
                  PDF
                </span>
                <span className="font-mono text-[10px] text-[#878E99] dark:text-neutral-400">
                  可打印文档
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    !isHtmlTemplate && quotaIsExhausted
                      ? "text-red-600"
                      : "text-[#878E99] dark:text-neutral-400",
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
                    "flex h-11 w-11 items-center justify-center",
                    format === "json"
                      ? "bg-blue-700 text-white border border-black shadow-[2px_2px_0px_0px_#000000]"
                      : "bg-[#F0F0E8] text-black border border-black shadow-[1px_1px_0px_0px_#000000] dark:bg-[#2A2A2A] dark:text-white dark:border-white dark:shadow-[1px_1px_0px_0px_#ffffff]",
                  )}
                >
                  <FileJson className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wide text-black dark:text-white">
                  JSON
                </span>
                <span className="font-mono text-[10px] text-[#878E99] dark:text-neutral-400">
                  结构化数据
                </span>
                <span className="font-mono text-[10px] text-[#878E99] dark:text-neutral-400">
                  可再次导入编辑
                </span>
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-none border border-black bg-[#F0F0E8] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-black shadow-[2px_2px_0px_0px_#000000] transition-colors hover:bg-[#E5E5E0] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none dark:border-white dark:bg-[#2A2A2A] dark:text-white dark:shadow-[2px_2px_0px_0px_#ffffff] dark:hover:bg-[#3A3A3A]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-none border border-black bg-blue-700 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-[2px_2px_0px_0px_#000000] transition-colors hover:bg-blue-800 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
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
