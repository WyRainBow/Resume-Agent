import React from "react";
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
  onRemoveAttachment,
  onClickUpload,
  onShowResumeSelector,
  onStartVoiceRecording,
  onStopVoiceRecording,
}: ComposerProps) {
  return (
    <form onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv,application/pdf"
        multiple
        className="hidden"
        onChange={onFileChange}
      />
      <div className="rounded-2xl border border-slate-300 bg-white transition-all focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800">
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {pendingAttachments.map((file) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                <FileText className="size-3.5 shrink-0 text-indigo-500" />
                <span className="max-w-[220px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(file)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="移除已上传文件"
                  title="移除文件"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            isProcessing
              ? "正在处理中，可以继续输入..."
              : "输入消息...（例如：生成一份关于 AI 发展趋势的报告）"
          }
          className="min-h-[92px] w-full resize-none bg-transparent px-4 pt-3 text-base text-slate-700 outline-none placeholder-slate-400 dark:text-slate-200"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClickUpload}
              disabled={isProcessing || isUploadingFile}
              className={`size-8 rounded-full border flex items-center justify-center transition-colors ${
                isProcessing || isUploadingFile
                  ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-600 dark:text-slate-500"
                  : "border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:hover:border-indigo-500"
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
              className={`h-8 rounded-md border px-2.5 flex items-center gap-1.5 transition-colors ${
                isProcessing
                  ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-600 dark:text-slate-500"
                  : isResumePreviewActive
                  ? "border-indigo-300 bg-indigo-50 text-indigo-600 shadow-sm dark:border-indigo-500/60 dark:bg-indigo-500/15 dark:text-indigo-300"
                  : "border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:hover:border-indigo-500"
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
              className={`size-8 rounded-full flex items-center justify-center transition-colors ${
                isProcessing || isUploadingFile
                  ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
              title={isProcessing ? "等待当前消息处理完成" : "发送消息"}
              aria-label="发送消息"
            >
              <ArrowUp className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={isVoiceRecording ? onStopVoiceRecording : onStartVoiceRecording}
              disabled={isProcessing || isVoiceProcessing}
              className={`size-8 rounded-full flex items-center justify-center transition-all ${
                isVoiceRecording
                  ? "animate-pulse bg-red-500 text-white"
                  : isVoiceSpeaking
                  ? "bg-green-500 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800"
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
