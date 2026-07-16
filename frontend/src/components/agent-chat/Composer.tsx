import React, { useEffect, useState } from "react";
import {
  ArrowUp,
  Eye,
  FileText,
  Plus,
  Square,
  X,
} from "lucide-react";

interface ComposerProps {
  input: string;
  isProcessing: boolean;
  isUploadingFile: boolean;
  isResumePreviewActive: boolean;
  pendingAttachments: File[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPasteFiles: (files: File[]) => void;
  onRemoveAttachment: (file: File) => void;
  onClickUpload: () => void;
  onShowResumeSelector: () => void;
  /** 生成中点击停止（中止当前流式回复） */
  onStop?: () => void;
  /** 预览处于「视觉隐藏但保持渲染」时为 true：显示低调的展开入口 */
  previewConcealed?: boolean;
  /** 点击低调入口重新展开预览 */
  onRevealPreview?: () => void;
}

export default function Composer({
  input,
  isProcessing,
  isUploadingFile,
  isResumePreviewActive,
  pendingAttachments,
  fileInputRef,
  onSubmit,
  onInputChange,
  onKeyDown,
  onFileChange,
  onPasteFiles,
  onRemoveAttachment,
  onClickUpload,
  onShowResumeSelector,
  onStop,
  previewConcealed = false,
  onRevealPreview,
}: ComposerProps) {
  // 图片附件缩略图：为图片型附件生成 objectURL，随附件变化重建并回收，避免内存泄漏
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Map<File, string>>(
    () => new Map(),
  );
  useEffect(() => {
    const map = new Map<File, string>();
    pendingAttachments.forEach((file) => {
      if (file.type.startsWith("image/")) {
        map.set(file, URL.createObjectURL(file));
      }
    });
    setImagePreviewUrls(map);
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingAttachments]);

  // 截图 / 剪贴板图片粘贴进输入框：拦截图片、交给上层作为简历附件解析；纯文本粘贴不拦截
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    Array.from(items).forEach((item) => {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    });
    if (imageFiles.length > 0) {
      event.preventDefault();
      onPasteFiles(imageFiles);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.json,.csv,.png,.jpg,.jpeg,text/plain,text/markdown,application/json,text/csv,application/pdf,image/png,image/jpeg"
        multiple
        className="hidden"
        onChange={onFileChange}
      />
      <div className="rounded-none fresh:rounded-lg border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-chat-surface shadow-[3px_3px_0px_0px_#000000] fresh:shadow-sm transition-all focus-within:shadow-[1px_1px_0px_0px_#000000] focus-within:translate-x-[1px] focus-within:translate-y-[1px] dark:border-white dark:shadow-[3px_3px_0px_0px_#ffffff] dark:bg-slate-800">
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {pendingAttachments.map((file) => {
              const previewUrl = imagePreviewUrls.get(file);
              return (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-none fresh:rounded-lg border border-black fresh:border-slate-200 bg-chat-canvas py-1 pl-1 pr-2 text-xs text-chat-ink-muted dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="size-8 shrink-0 rounded-none fresh:rounded-lg object-cover"
                    />
                  ) : (
                    <FileText className="ml-1 size-3.5 shrink-0 text-chat-accent" />
                  )}
                  <span className="max-w-[220px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file)}
                    className="rounded-none fresh:rounded-lg p-0.5 text-chat-ink-muted hover:text-chat-ink dark:hover:text-slate-200"
                    aria-label="移除已上传文件"
                    title="移除文件"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={
            isProcessing
              ? "正在生成回复…（可点右侧停止）"
              : "输入消息…（例如：应聘后端开发、帮我优化简历）"
          }
          className="min-h-[92px] w-full resize-none bg-transparent px-4 pt-3 text-base text-chat-ink outline-none placeholder:text-chat-ink-muted/70 dark:text-slate-200"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClickUpload}
              disabled={isProcessing || isUploadingFile}
              className={`size-8 rounded-none fresh:rounded-lg border-2 flex items-center justify-center transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                isProcessing || isUploadingFile
                  ? "cursor-not-allowed border-black fresh:border-slate-200/30 text-chat-ink-muted/40 dark:border-slate-600 dark:text-slate-500"
                  : "border-black fresh:border-slate-200 text-chat-ink-muted shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:text-chat-accent-deep hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
              }`}
              title={isUploadingFile ? "上传中..." : "上传文件"}
              aria-label="上传文件"
            >
              <Plus className="size-4" />
            </button>

            <button
              type="button"
              onClick={onShowResumeSelector}
              disabled={isProcessing}
              className={`h-8 rounded-none fresh:rounded-lg border-2 px-2.5 flex items-center gap-1.5 transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                isProcessing
                  ? "cursor-not-allowed border-black fresh:border-slate-200/30 text-chat-ink-muted/40 dark:border-slate-600 dark:text-slate-500"
                  : isResumePreviewActive
                  ? "border-black fresh:border-slate-200 bg-chat-canvas text-chat-accent-deep shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm dark:border-white dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-black fresh:border-slate-200 text-chat-ink-muted shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:text-chat-accent-deep hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
              }`}
              title="展示简历"
              aria-label="展示简历"
            >
              <FileText className="size-4" />
              <span className="text-sm font-medium">展示简历</span>
            </button>

            {/* 预览「视觉隐藏但保持渲染」时的低调展开入口：无边框无文字的
                ghost 图标，不惹眼；点击即时展开（内容一直挂载着，零等待） */}
            {previewConcealed && onRevealPreview && (
              <button
                type="button"
                onClick={onRevealPreview}
                title="展开预览"
                aria-label="展开预览"
                className="size-8 rounded-none fresh:rounded-lg flex items-center justify-center text-chat-ink-muted/50 transition-colors hover:text-chat-ink dark:text-slate-500 dark:hover:text-slate-200"
              >
                <Eye className="size-4" />
              </button>
            )}
          </div>

          {isProcessing && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="size-8 rounded-none fresh:rounded-lg flex items-center justify-center border-2 fresh:border border-black fresh:border-slate-200 fresh:border-slate-200 bg-red-600 text-white shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm transition-all hover:bg-red-700 hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
              title="停止生成"
              aria-label="停止生成"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                isProcessing ||
                isUploadingFile ||
                (!input.trim() && pendingAttachments.length === 0)
              }
              className={`size-8 rounded-none fresh:rounded-lg flex items-center justify-center border-2 transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                isProcessing ||
                isUploadingFile ||
                (!input.trim() && pendingAttachments.length === 0)
                  ? "cursor-not-allowed border-black fresh:border-slate-200/30 bg-chat-canvas text-chat-ink-muted dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  : "border-black fresh:border-slate-200 bg-chat-accent text-white shadow-[2px_2px_0px_0px_#000000] fresh:shadow-sm hover:bg-chat-accent-deep hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
              }`}
              title="发送消息"
              aria-label="发送消息"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
