import React, { useEffect, useState } from "react";
import {
  ArrowUp,
  FileText,
  Loader2,
  Mic,
  Plus,
  StopCircle,
  X,
} from "lucide-react";

interface ComposerProps {
  input: string;
  isProcessing: boolean;
  isUploadingFile: boolean;
  isVoiceRecording: boolean;
  isVoiceProcessing: boolean;
  isVoiceSpeaking: boolean;
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
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
}

export default function Composer({
  input,
  isProcessing,
  isUploadingFile,
  isVoiceRecording,
  isVoiceProcessing,
  isVoiceSpeaking,
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
  onStartVoiceRecording,
  onStopVoiceRecording,
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
      <div className="rounded-2xl border border-chat-border bg-chat-surface shadow-sm transition-all focus-within:border-chat-accent/60 focus-within:ring-2 focus-within:ring-chat-accent/15 dark:border-slate-700 dark:bg-slate-800">
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {pendingAttachments.map((file) => {
              const previewUrl = imagePreviewUrls.get(file);
              return (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-chat-border bg-chat-canvas py-1 pl-1 pr-2 text-xs text-chat-ink-muted dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="size-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <FileText className="ml-1 size-3.5 shrink-0 text-chat-accent" />
                  )}
                  <span className="max-w-[220px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file)}
                    className="rounded p-0.5 text-chat-ink-muted hover:text-chat-ink dark:hover:text-slate-200"
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
              ? "正在处理中、可以继续输入..."
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
              className={`size-8 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                isProcessing || isUploadingFile
                  ? "cursor-not-allowed border-chat-border/60 text-chat-ink-muted/40 dark:border-slate-600 dark:text-slate-500"
                  : "border-chat-border text-chat-ink-muted hover:border-chat-accent/50 hover:text-chat-accent-deep dark:border-slate-600"
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
              className={`h-8 rounded-lg border px-2.5 flex items-center gap-1.5 transition-all active:scale-95 ${
                isProcessing
                  ? "cursor-not-allowed border-chat-border/60 text-chat-ink-muted/40 dark:border-slate-600 dark:text-slate-500"
                  : isResumePreviewActive
                  ? "border-chat-accent/50 bg-chat-canvas text-chat-accent-deep shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-chat-border text-chat-ink-muted hover:border-chat-accent/50 hover:text-chat-accent-deep dark:border-slate-600"
              }`}
              title="展示简历"
              aria-label="展示简历"
            >
              <FileText className="size-4" />
              <span className="text-sm font-medium">展示简历</span>
            </button>
          </div>

          {input.trim() || pendingAttachments.length > 0 ? (
            <button
              type="submit"
              disabled={isProcessing || isUploadingFile}
              className={`size-8 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                isProcessing || isUploadingFile
                  ? "cursor-not-allowed border border-chat-border bg-chat-canvas text-chat-ink-muted dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  : "border border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"
              }`}
              title={isProcessing ? "等待当前消息处理完成" : "发送消息"}
              aria-label="发送消息"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={isVoiceRecording ? onStopVoiceRecording : onStartVoiceRecording}
              disabled={isProcessing || isVoiceProcessing}
              className={`size-8 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isVoiceRecording
                  ? "animate-pulse bg-red-500 text-white"
                  : isVoiceSpeaking
                  ? "bg-emerald-600 text-white"
                  : "bg-chat-canvas text-chat-ink-muted hover:bg-chat-user-bubble hover:text-chat-accent-deep dark:bg-slate-800"
              } ${isVoiceProcessing ? "cursor-not-allowed opacity-50" : ""}`}
              title={
                isVoiceProcessing
                  ? "识别中..."
                  : isVoiceRecording
                  ? "正在录音，点击停止"
                  : "语音输入"
              }
              aria-label="语音输入"
            >
              {isVoiceProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isVoiceRecording ? (
                <StopCircle className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
