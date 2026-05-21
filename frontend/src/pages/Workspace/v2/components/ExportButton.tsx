/**
 * 导出按钮组件
 * 支持 PDF、JSON 导出
 * 优化后的现代化样式
 */
import { useState, useRef, useEffect } from "react";
import { Download, FileJson, ChevronDown, FileText } from "lucide-react";
import { cn } from "../../../../lib/utils";
import {
  getPDFExportPreferences,
  getDefaultPDFDirectoryHandle,
  getDefaultPDFDirectoryLabel,
  ensureDirectoryPermission,
  writePdfToDirectory,
} from "@/services/pdfExportPreferences";
import {
  fetchPdfDownloadQuota,
  recordPdfDownload,
  type PdfDownloadQuota,
} from "@/services/api";
import { getStoredAuthRole } from "@/lib/runtimeEnv";

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
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = getStoredAuthRole() === "admin";

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
    if (quota.unlimited) return "PDF 下载不限次数";
    return `剩余 ${quota.remaining ?? 0}/${quota.limit ?? 10} 次下载`;
  };

  const quotaIsExhausted = Boolean(
    quota && !quota.unlimited && (quota.remaining ?? 0) <= 0,
  );

  // 导出 PDF - 仅用于 LaTeX 模板
  const handleExportPDF = async () => {
    setIsOpen(false);
    try {
      if (pdfBlob) {
        if (onDownloadPDF) {
          await onDownloadPDF();
        } else {
          await recordPdfDownload();
          downloadBlob(pdfBlob, getPdfFileName());
        }
        void refreshQuota();
        return;
      }
      if (!pdfBlob) {
        alert('请先点击"渲染 PDF"按钮生成 PDF，然后再下载');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "PDF 下载失败，请重试");
    }
  };

  // 另存为：允许用户自定义保存路径（不支持时降级为普通下载）
  const handleSavePDFAs = async () => {
    setIsOpen(false);
    if (!pdfBlob) {
      alert('请先点击"渲染 PDF"按钮生成 PDF，然后再下载');
      return;
    }
    const filename = getPdfFileName();
    try {
      const prefs = getPDFExportPreferences();
      if (prefs.behavior === "preferDefault") {
        const dirHandle = await getDefaultPDFDirectoryHandle();
        if (dirHandle) {
          const granted = await ensureDirectoryPermission(dirHandle);
          if (granted) {
            await recordPdfDownload();
            await writePdfToDirectory(dirHandle, filename, pdfBlob);
            void refreshQuota();
            const dirLabel =
              getDefaultPDFDirectoryLabel() ||
              (typeof dirHandle?.name === "string" ? dirHandle.name : "默认目录");
            alert(`已保存到：${dirLabel}/${filename}`);
            return;
          }
        }
      }
    } catch (error) {
      console.warn("默认路径保存失败，将回退到手动另存为:", error);
    }

    const showSaveFilePickerFn = (window as any).showSaveFilePicker as
      | ((options?: {
          suggestedName?: string;
          types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
          }>;
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>)
      | undefined;
    if (typeof showSaveFilePickerFn !== "function") {
      if (onDownloadPDF) {
        await onDownloadPDF();
      } else {
        await recordPdfDownload();
        downloadBlob(pdfBlob, filename);
      }
      void refreshQuota();
      alert("当前浏览器不支持自定义路径，已使用默认下载方式");
      return;
    }
    try {
      const fileHandle = await showSaveFilePickerFn({
        suggestedName: filename,
        types: [
          { description: "PDF 文件", accept: { "application/pdf": [".pdf"] } },
        ],
      });
      await recordPdfDownload();
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      void refreshQuota();
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("另存为 PDF 失败:", error);
      alert(error instanceof Error ? error.message : "另存为失败，请重试");
    }
  };

  // 导出 JSON
  const handleExportJSONClick = () => {
    if (!isAdmin) {
      return;
    }
    if (onExportJSON) {
      onExportJSON();
    } else {
      // 默认的 JSON 导出逻辑
      try {
        const jsonString = JSON.stringify(resumeData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${resumeName}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("导出 JSON 失败:", error);
        alert("导出失败，请重试");
      }
    }
    setIsOpen(false);
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      void refreshQuota();
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* 导出按钮 - 优化后的样式 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "px-6 py-2.5 rounded-lg",
          "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          "text-white text-sm font-bold transition-all duration-300",
          "transition-all duration-300 ease-out",
          "flex items-center gap-2",
          "shadow-lg shadow-blue-100 dark:shadow-blue-900/20",
          "border-2 border-blue-500",
          "hover:scale-[1.05] active:scale-[0.95]",
        )}
      >
        <Download className="w-4 h-4" strokeWidth={3} />
        <span>导出</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* 下拉菜单 - 优化后的卡片式设计 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50 backdrop-blur-sm">
          {/* PDF 导出卡片 - 仅对 LaTeX 模板显示 */}
          {resumeData?.templateType !== "html" && (
            <button
              onClick={handleExportPDF}
              className={cn(
                "w-full px-5 py-4 text-left",
                "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                "transition-all duration-150",
                "flex items-center gap-4",
                "border-b border-slate-100 dark:border-slate-700/50",
                "group",
                !pdfBlob && "opacity-60",
              )}
            >
              {/* PDF 图标 */}
              <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <FileText
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  strokeWidth={2}
                />
              </div>
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  下载 PDF
                </div>
                {!pdfBlob && (
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    需要先渲染 PDF
                  </div>
                )}
                <div
                  className={cn(
                    "text-xs mt-1",
                    quotaIsExhausted
                      ? "text-red-500 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {getQuotaText()}
                </div>
              </div>
            </button>
          )}

          {/* PDF 另存为卡片（可自定义路径） - 仅对 LaTeX 模板显示 */}
          {resumeData?.templateType !== "html" && (
            <button
              onClick={handleSavePDFAs}
              className={cn(
                "w-full px-5 py-4 text-left",
                "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                "transition-all duration-150",
                "flex items-center gap-4",
                "border-b border-slate-100 dark:border-slate-700/50",
                "group",
                !pdfBlob && "opacity-60",
              )}
            >
              <div className="w-12 h-12 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <FileText
                  className="w-6 h-6 text-amber-600 dark:text-amber-400"
                  strokeWidth={2}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">
                  另存为 PDF
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  选择保存路径与文件名
                </div>
                <div
                  className={cn(
                    "text-xs mt-1",
                    quotaIsExhausted
                      ? "text-red-500 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {getQuotaText()}
                </div>
              </div>
            </button>
          )}

          {/* JSON 导出卡片（仅管理员可见） */}
          {isAdmin && (
          <button
            onClick={handleExportJSONClick}
            className={cn(
              "w-full px-5 py-4 text-left",
              "hover:bg-slate-50 dark:hover:bg-slate-700/50",
              "transition-all duration-150",
              "flex items-center gap-4",
              "border-b border-slate-100 dark:border-slate-700/50",
              "group",
            )}
          >
            {/* JSON 图标 */}
            <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <FileJson
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                strokeWidth={2}
              />
            </div>
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">
                导出 JSON
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                下载 JSON 格式的简历快照。用于备份简历数据。
              </div>
            </div>
          </button>
          )}
        </div>
      )}
    </div>
  );
}
